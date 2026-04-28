import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'
import { sendEmail, emailTemplates } from '@/lib/email'
import QRCode from 'qrcode'

// Status ASAAS que indicam pagamento confirmado
const PAID_STATUSES = new Set(['RECEIVED', 'CONFIRMED'])

export async function POST(request: NextRequest) {
  try {
    // 1. Validar token do webhook (configurado no painel ASAAS → Webhooks)
    const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN
    if (webhookToken) {
      const headerToken = request.headers.get('asaas-access-token')
      if (headerToken !== webhookToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const body = await request.json()
    const asaasPayment = body?.payment

    if (!asaasPayment?.id) {
      return NextResponse.json({ ok: true }) // evento sem pagamento, ignorar
    }

    if (!PAID_STATUSES.has(String(asaasPayment.status ?? ''))) {
      return NextResponse.json({ ok: true }) // outros status (PENDING, OVERDUE, etc.), ignorar
    }

    // 2. Buscar Payment interno pelo externalId
    const { data: payment, error: payError } = await supabase
      .from('Payment')
      .select('id, cartId, eventId, status')
      .eq('externalId', asaasPayment.id)
      .maybeSingle()

    if (payError || !payment) {
      console.warn('[webhook/asaas] Payment não encontrado para externalId:', asaasPayment.id)
      return NextResponse.json({ ok: true })
    }

    // 3. Idempotência: já foi processado
    if (payment.status === 'paid') {
      return NextResponse.json({ ok: true })
    }

    // 4. Marcar Payment como pago
    await supabase
      .from('Payment')
      .update({ status: 'paid', paidAt: new Date().toISOString() })
      .eq('id', payment.id)

    // 5. Buscar inscrições vinculadas
    let regQuery = supabase
      .from('Registration')
      .select('id, fullName, email, eventId, event:Event(name)')

    if (payment.cartId) {
      regQuery = regQuery.eq('cartId', payment.cartId)
    } else {
      regQuery = regQuery
        .eq('eventId', payment.eventId)
        .eq('status', 'pending')
    }

    const { data: registrations } = await regQuery

    if (!registrations?.length) {
      console.warn('[webhook/asaas] Nenhuma inscrição vinculada ao payment:', payment.id)
      return NextResponse.json({ ok: true })
    }

    // 6. Para cada inscrição: atualizar status + gerar voucher + enviar e-mail
    for (const reg of registrations) {
      // Atualizar status
      await supabase
        .from('Registration')
        .update({ status: 'paid' })
        .eq('id', reg.id)

      // Gerar QR Code
      const qrPayload = `congregapay:voucher:${reg.id}`
      const qrCode = await QRCode.toDataURL(qrPayload, { errorCorrectionLevel: 'H' })

      // Criar/atualizar Voucher (upsert para idempotência)
      await supabase
        .from('Voucher')
        .upsert({ registrationId: reg.id, qrCode, used: false }, { onConflict: 'registrationId' })

      // Enviar e-mail com voucher
      const eventName = (reg as any).event?.name || 'Evento'
      const voucherUrl = `${process.env.NEXT_PUBLIC_APP_URL}/voucher/${reg.id}`

      try {
        const template = emailTemplates.voucherEmail(reg.fullName, eventName, voucherUrl)
        await sendEmail({ to: reg.email, subject: template.subject, html: template.html })
      } catch (emailErr) {
        console.error('[webhook/asaas] Erro ao enviar voucher por e-mail:', emailErr)
        // best-effort: não falha o webhook por causa do e-mail
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[webhook/asaas] Erro interno:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
