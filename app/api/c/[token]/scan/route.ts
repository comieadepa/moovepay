import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabase } from '@/lib/supabase-server'
import { hashCheckInToken, calculateEventExpiration } from '@/lib/checkin-token'

// POST /api/c/[token]/scan
// Body: { password?: string, qrPayload: string }
// Valida o token do link, elegibilidade da inscrição e executa o check-in atômico
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = params.token?.trim()
  if (!token) {
    return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 })
  }

  let body: { password?: string; qrPayload?: string; registrationId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { password, qrPayload, registrationId: directRegId } = body
  const payloadToProcess = (qrPayload || directRegId || '').trim()

  if (!payloadToProcess) {
    return NextResponse.json({ error: 'Payload de QR Code ou ID de inscrição obrigatório' }, { status: 400 })
  }

  const tokenHash = hashCheckInToken(token)

  // 1. Carrega o link com dados do evento por tokenHash (ou fallback por id legado)
  let { data: link } = await supabase
    .from('EventCheckInLink')
    .select('id, label, passwordHash, revokedAt, event:Event(id, name, startDate, endDate, tenantId, creatorId)')
    .eq('tokenHash', tokenHash)
    .maybeSingle()

  if (!link) {
    const { data: legacyLink } = await supabase
      .from('EventCheckInLink')
      .select('id, label, passwordHash, revokedAt, event:Event(id, name, startDate, endDate, tenantId, creatorId)')
      .eq('id', token)
      .maybeSingle()
    link = legacyLink
  }

  if (!link) {
    return NextResponse.json({ error: 'Link de check-in inválido' }, { status: 404 })
  }

  if (link.revokedAt) {
    return NextResponse.json({ error: 'Este link foi revogado pelo organizador' }, { status: 403 })
  }

  // 2. Valida senha se o link tiver passwordHash configurado
  if (link.passwordHash) {
    if (!password) {
      return NextResponse.json({ error: 'Senha de acesso obrigatória' }, { status: 401 })
    }
    const validPassword = await bcrypt.compare(password, link.passwordHash)
    if (!validPassword) {
      return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
    }
  }

  // Ping de teste de senha
  if (payloadToProcess === '__ping__') {
    return NextResponse.json({ success: true, message: 'Autenticado' })
  }

  const event = Array.isArray(link.event) ? link.event[0] : (link.event as any)
  if (!event) {
    return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
  }

  // 3. Verifica expiração no fuso America/Sao_Paulo
  const { expired } = calculateEventExpiration(event.startDate, event.endDate)
  if (expired) {
    return NextResponse.json({ error: 'Evento encerrado — link expirado' }, { status: 403 })
  }

  // 4. Extrai registrationId do payload ("congregapay:voucher:<id>", "congregapay:reg:<id>" ou id direto)
  let registrationId = payloadToProcess
  const match = payloadToProcess.match(/^congregapay:(?:voucher|reg):(.+)$/)
  if (match) {
    registrationId = match[1]
  } else if (!/^[a-zA-Z0-9_-]{10,64}$/.test(payloadToProcess)) {
    return NextResponse.json(
      { result: 'not_found', message: 'QR Code inválido para esta plataforma' },
      { status: 422 }
    )
  }

  // 5. Busca inscrição + voucher + tipo de ingresso (garantindo estritamente eventId correspondente)
  const { data: reg, error: regError } = await supabase
    .from('Registration')
    .select(`
      id, fullName, email, status,
      event:Event ( id, name ),
      inscriptionType:InscriptionType ( id, name ),
      voucher:Voucher ( id, used, usedAt )
    `)
    .eq('id', registrationId)
    .eq('eventId', event.id)
    .maybeSingle()

  if (regError || !reg) {
    return NextResponse.json(
      { result: 'not_found', message: 'Inscrição não localizada neste evento' },
      { status: 404 }
    )
  }

  const regEvent = Array.isArray(reg.event) ? reg.event[0] : (reg.event as any)
  const inscriptionType = Array.isArray(reg.inscriptionType) ? reg.inscriptionType[0] : (reg.inscriptionType as any)
  const voucher = Array.isArray(reg.voucher) ? reg.voucher[0] : (reg.voucher as any)

  const logBase = {
    registrationId: reg.id,
    eventId: event.id,
    scannedBy: `link:${link.id}`,
    scannedByName: link.label || 'Portaria Móvel',
    voucherId: voucher?.id ?? null,
  }

  // 6. Validar status do pagamento ('paid' = pago | 'confirmed' = gratuito confirmado)
  if (reg.status !== 'paid' && reg.status !== 'confirmed') {
    await supabase.from('CheckinLog').insert({
      ...logBase,
      voucherId: voucher?.id ?? 'unknown',
      result: 'not_paid',
    })
    return NextResponse.json(
      {
        result: 'not_paid',
        message: 'Pagamento não confirmado para esta inscrição',
        participant: reg.fullName,
        inscriptionType: inscriptionType?.name || 'Inscrição',
      },
      { status: 422 }
    )
  }

  // 7. Se voucher já constava como usado
  if (voucher?.used) {
    await supabase.from('CheckinLog').insert({ ...logBase, result: 'already_used' })
    return NextResponse.json(
      {
        result: 'already_used',
        message: 'Voucher já utilizado anteriormente',
        participant: reg.fullName,
        inscriptionType: inscriptionType?.name || 'Inscrição',
        usedAt: voucher.usedAt,
      },
      { status: 409 }
    )
  }

  const now = new Date().toISOString()
  let voucherId = voucher?.id

  // 8. Operação Atômica de Check-in
  if (!voucher) {
    // Inscrição válida sem voucher: cria e marca como usado atomicamente
    const { data: newVoucher, error: createVoucherErr } = await supabase
      .from('Voucher')
      .insert({
        registrationId: reg.id,
        qrCode: `congregapay:voucher:${reg.id}`,
        used: true,
        usedAt: now,
      })
      .select('id, used, usedAt')
      .single()

    if (createVoucherErr || !newVoucher) {
      // Se deu conflito de chave única, outro processo acabou de criar
      return NextResponse.json(
        {
          result: 'already_used',
          message: 'Voucher já utilizado',
          participant: reg.fullName,
          inscriptionType: inscriptionType?.name || 'Inscrição',
          usedAt: now,
        },
        { status: 409 }
      )
    }
    voucherId = newVoucher.id
  } else {
    // ATOMIC UPDATE: Só altera se used for estritamente false
    const { data: updatedVoucher, error: updateErr } = await supabase
      .from('Voucher')
      .update({ used: true, usedAt: now })
      .eq('id', voucher.id)
      .eq('used', false)
      .select('id, used, usedAt')
      .maybeSingle()

    if (updateErr || !updatedVoucher) {
      // Condição de corrida evitada: outro operador validou no mesmo instante
      await supabase.from('CheckinLog').insert({ ...logBase, result: 'already_used' })
      return NextResponse.json(
        {
          result: 'already_used',
          message: 'Voucher já utilizado',
          participant: reg.fullName,
          inscriptionType: inscriptionType?.name || 'Inscrição',
          usedAt: voucher.usedAt || now,
        },
        { status: 409 }
      )
    }
    voucherId = updatedVoucher.id
  }

  // 9. Registra auditoria do check-in com sucesso e atualiza lastUsedAt no link
  await Promise.all([
    supabase.from('CheckinLog').insert({ ...logBase, voucherId, result: 'ok' }),
    supabase.from('EventCheckInLink').update({ lastUsedAt: now }).eq('id', link.id),
  ])

  return NextResponse.json({
    result: 'ok',
    message: 'Check-in realizado com sucesso!',
    participant: reg.fullName,
    inscriptionType: inscriptionType?.name || 'Inscrição',
    event: regEvent?.name ?? event.name,
    checkedInAt: now,
  })
}
