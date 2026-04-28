import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'
import { getAuthContext } from '@/lib/rbac'

// POST /api/checkin
// Body: { qrPayload: string }
// qrPayload esperado: "congregapay:voucher:<registrationId>"
export async function POST(request: NextRequest) {
  const ctx = getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  let body: { qrPayload?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { qrPayload } = body
  if (!qrPayload || typeof qrPayload !== 'string') {
    return NextResponse.json({ error: 'qrPayload obrigatório' }, { status: 400 })
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

  // Busca inscrição + voucher + evento
  const { data: reg } = await supabase
    .from('Registration')
    .select(`
      id, fullName, email, status,
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

  // Verifica se o operador tem acesso ao evento
  const ownsEvent = event?.tenantId === ctx.tenantId || event?.creatorId === ctx.userId
  if (!ownsEvent) {
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

  // Pagamento não confirmado
  if (reg.status !== 'paid') {
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

  // Sem voucher gerado ainda
  if (!voucher) {
    return NextResponse.json(
      { result: 'not_found', message: 'Voucher não gerado para esta inscrição' },
      { status: 404 }
    )
  }

  // Tudo OK — marca como usado atomicamente
  const now = new Date().toISOString()
  const { error: updateErr } = await supabase
    .from('Voucher')
    .update({ used: true, usedAt: now })
    .eq('id', voucher.id)
    .eq('used', false) // guard extra contra race condition

  if (updateErr) {
    return NextResponse.json({ error: 'Erro ao confirmar check-in' }, { status: 500 })
  }

  await supabase.from('CheckinLog').insert({ ...logBase, result: 'ok' })

  return NextResponse.json({
    result: 'ok',
    message: 'Check-in realizado com sucesso!',
    participant: reg.fullName,
    event: event?.name,
    checkedInAt: now,
  })
}
