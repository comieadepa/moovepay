import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'
import { getAuthContext } from '@/lib/rbac'

// POST /api/checkin
// Body: { qrPayload?: string, registrationId?: string }
// qrPayload esperado: "congregapay:voucher:<registrationId>" OU registrationId direto para check-in manual
export async function POST(request: NextRequest) {
  const ctx = getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  let body: { qrPayload?: string; registrationId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  let registrationId = body.registrationId?.trim()

  if (!registrationId && body.qrPayload && typeof body.qrPayload === 'string') {
    // Extrai registrationId do payload "congregapay:voucher:<id>" ou "congregapay:reg:<id>"
    const match = body.qrPayload.match(/^congregapay:(?:voucher|reg):(.+)$/)
    if (match) {
      registrationId = match[1]
    } else {
      return NextResponse.json(
        { result: 'not_found', message: 'QR Code inválido para esta plataforma' },
        { status: 422 }
      )
    }
  }

  if (!registrationId) {
    return NextResponse.json({ error: 'registrationId ou qrPayload é obrigatório' }, { status: 400 })
  }

  // Busca inscrição + voucher + evento
  const { data: reg } = await supabase
    .from('Registration')
    .select(`
      id, fullName, email, cpf, status,
      event:Event ( id, name, tenantId, creatorId ),
      voucher:Voucher ( id, used, usedAt )
    `)
    .eq('id', registrationId)
    .maybeSingle()

  if (!reg) {
    return NextResponse.json(
      { result: 'not_found', message: 'Inscrição não encontrada' },
      { status: 404 }
    )
  }

  const event = Array.isArray(reg.event) ? reg.event[0] : (reg.event as any)
  const voucher = Array.isArray(reg.voucher) ? reg.voucher[0] : (reg.voucher as any)

  // Verifica se o operador tem acesso ao evento:
  // 1. É dono (mesmo tenant ou criador), OU
  // 2. É EventStaff com role checkin_operator/event_manager
  const isOwner = event?.tenantId === ctx.tenantId || event?.creatorId === ctx.userId

  let isStaff = false
  if (!isOwner) {
    const { data: staffEntry } = await supabase
      .from('EventStaff')
      .select('id, role')
      .eq('eventId', event?.id)
      .eq('userId', ctx.userId)
      .maybeSingle()
    isStaff = !!staffEntry
  }

  if (!isOwner && !isStaff) {
    return NextResponse.json({ error: 'Sem permissão para este evento' }, { status: 403 })
  }

  // Monta dados para log
  const logBase = {
    registrationId: reg.id,
    eventId: event?.id,
    scannedBy: ctx.userId,
    scannedByName: ctx.email ?? null,
    voucherId: voucher?.id ?? null,
  }

  // Pagamento não confirmado ('paid' = pago | 'confirmed' = gratuito confirmado)
  if (reg.status !== 'paid' && reg.status !== 'confirmed') {
    await supabase.from('CheckinLog').insert({
      ...logBase,
      voucherId: voucher?.id ?? 'unknown',
      result: 'not_paid',
    })
    return NextResponse.json(
      {
        result: 'not_paid',
        message: 'Pagamento não confirmado',
        participant: reg.fullName,
      },
      { status: 422 }
    )
  }

  // Voucher já utilizado
  if (voucher?.used) {
    await supabase.from('CheckinLog').insert({ ...logBase, result: 'already_used' })
    return NextResponse.json(
      {
        result: 'already_used',
        message: 'Voucher já utilizado',
        participant: reg.fullName,
        usedAt: voucher.usedAt,
      },
      { status: 409 }
    )
  }

  const now = new Date().toISOString()
  let voucherId = voucher?.id

  // Se a inscrição está válida mas não possui registro de Voucher, gera e marca como usado atomicamente
  if (!voucher) {
    const { data: newVoucher, error: createVoucherErr } = await supabase
      .from('Voucher')
      .insert({
        registrationId: reg.id,
        qrCode: `congregapay:voucher:${reg.id}`,
        used: true,
        usedAt: now,
      })
      .select('id')
      .single()

    if (createVoucherErr || !newVoucher) {
      return NextResponse.json({ error: 'Erro ao gerar voucher para check-in' }, { status: 500 })
    }
    voucherId = newVoucher.id
  } else {
    // Voucher existente: marca como usado atomicamente
    const { error: updateErr } = await supabase
      .from('Voucher')
      .update({ used: true, usedAt: now })
      .eq('id', voucher.id)
      .eq('used', false) // guard extra contra race condition

    if (updateErr) {
      return NextResponse.json({ error: 'Erro ao confirmar check-in' }, { status: 500 })
    }
    voucherId = voucher.id
  }

  await supabase.from('CheckinLog').insert({
    ...logBase,
    voucherId,
    result: 'ok',
  })

  return NextResponse.json({
    result: 'ok',
    message: 'Check-in realizado com sucesso!',
    participant: reg.fullName,
    event: event?.name,
    checkedInAt: now,
  })
}
