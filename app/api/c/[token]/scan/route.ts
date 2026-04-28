import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabase } from '@/lib/supabase-server'

// POST /api/c/[token]/scan
// Body: { password: string, qrPayload: string }
// Valida a senha do link e executa o check-in — sem necessidade de conta
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  let body: { password?: string; qrPayload?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Body inválido' }, { status: 400 }) }

  const { password, qrPayload } = body

  if (!password || !qrPayload) {
    return NextResponse.json({ error: 'Campos obrigatórios: password, qrPayload' }, { status: 400 })
  }

  // Carrega o link com dados do evento
  const { data: link } = await supabase
    .from('EventCheckInLink')
    .select('id, label, passwordHash, revokedAt, event:Event(id, name, startDate, endDate, tenantId, creatorId)')
    .eq('id', params.token)
    .maybeSingle()

  if (!link) {
    return NextResponse.json({ error: 'Link inválido' }, { status: 404 })
  }

  if (link.revokedAt) {
    return NextResponse.json({ error: 'Link revogado' }, { status: 403 })
  }

  // Valida senha
  const valid = await bcrypt.compare(password, link.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
  }

  const event = Array.isArray(link.event) ? link.event[0] : (link.event as any)
  if (!event) {
    return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
  }

  // Verifica expiração (endDate + 24h de tolerância)
  const referenceDate = event.endDate ?? event.startDate
  const expiresAt = new Date(referenceDate).getTime() + 24 * 60 * 60 * 1000
  if (Date.now() > expiresAt) {
    return NextResponse.json({ error: 'Evento encerrado — link expirado' }, { status: 403 })
  }

  // Extrai registrationId do payload "congregapay:voucher:<id>"
  const match = qrPayload.match(/^congregapay:voucher:(.+)$/)
  if (!match) {
    return NextResponse.json(
      { result: 'not_found', message: 'QR Code inválido para esta plataforma' },
      { status: 422 }
    )
  }
  const registrationId = match[1]

  // Busca inscrição + voucher
  const { data: reg } = await supabase
    .from('Registration')
    .select(`
      id, fullName, email, status,
      event:Event ( id, name ),
      voucher:Voucher ( id, used, usedAt )
    `)
    .eq('id', registrationId)
    .eq('eventId', event.id)
    .maybeSingle()

  if (!reg) {
    return NextResponse.json(
      { result: 'not_found', message: 'Inscrição não encontrada neste evento' },
      { status: 404 }
    )
  }

  const regEvent = Array.isArray(reg.event) ? reg.event[0] : (reg.event as any)
  const voucher = Array.isArray(reg.voucher) ? reg.voucher[0] : (reg.voucher as any)

  const logBase = {
    registrationId: reg.id,
    eventId: event.id,
    scannedBy: null,
    scannedByName: link.label,
    voucherId: voucher?.id ?? null,
  }

  // Apenas inscrições pagas são aceitas neste fluxo (eventos pagos)
  if (reg.status !== 'paid') {
    await supabase.from('CheckinLog').insert({ ...logBase, voucherId: voucher?.id ?? 'unknown', result: 'not_paid' })
    return NextResponse.json(
      { result: 'not_paid', message: 'Pagamento não confirmado', participant: reg.fullName },
      { status: 422 }
    )
  }

  // Voucher já utilizado
  if (voucher?.used) {
    await supabase.from('CheckinLog').insert({ ...logBase, result: 'already_used' })
    return NextResponse.json(
      { result: 'already_used', message: 'Voucher já utilizado', participant: reg.fullName, usedAt: voucher.usedAt },
      { status: 409 }
    )
  }

  // Sem voucher
  if (!voucher) {
    return NextResponse.json(
      { result: 'not_found', message: 'Voucher não gerado para esta inscrição' },
      { status: 404 }
    )
  }

  // Marca como usado
  const now = new Date().toISOString()
  const { error: updateErr } = await supabase
    .from('Voucher')
    .update({ used: true, usedAt: now })
    .eq('id', voucher.id)
    .eq('used', false)

  if (updateErr) {
    return NextResponse.json({ error: 'Erro ao confirmar check-in' }, { status: 500 })
  }

  await supabase.from('CheckinLog').insert({ ...logBase, result: 'ok' })

  return NextResponse.json({
    result: 'ok',
    message: 'Check-in realizado com sucesso!',
    participant: reg.fullName,
    event: regEvent?.name ?? event.name,
    checkedInAt: now,
  })
}
