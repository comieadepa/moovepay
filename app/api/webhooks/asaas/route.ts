import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'
import { sendEmail, emailTemplates } from '@/lib/email'
import QRCode from 'qrcode'

// Status ASAAS que indicam pagamento confirmado
const PAID_STATUSES = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'])

// Status ASAAS que indicam estorno, reembolso ou contestação
const REFUND_STATUSES = new Set([
  'REFUNDED',
  'REFUND_REQUESTED',
  'CHARGEBACK_REQUESTED',
  'CHARGEBACK_DISPUTE',
  'AWAITING_CHARGEBACK_REVERSAL',
])

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
    const eventName = String(body?.event ?? '')
    const asaasPayment = body?.payment

    if (!asaasPayment?.id) {
      return NextResponse.json({ ok: true }) // evento sem pagamento, ignorar
    }

    const asaasStatus = String(asaasPayment.status ?? '').toUpperCase()
    const isPaidEvent = PAID_STATUSES.has(asaasStatus) || eventName === 'PAYMENT_RECEIVED' || eventName === 'PAYMENT_CONFIRMED'
    const isRefundEvent =
      REFUND_STATUSES.has(asaasStatus) ||
      eventName === 'PAYMENT_REFUNDED' ||
      eventName.startsWith('PAYMENT_CHARGEBACK')

    // Se não for nem pagamento confirmado nem reembolso/chargeback, ignora
    if (!isPaidEvent && !isRefundEvent) {
      return NextResponse.json({ ok: true })
    }

    // 2. Buscar Payment interno pelo externalId
    let { data: payment, error: payError } = await supabase
      .from('Payment')
      .select('id, cartId, eventId, status, externalId')
      .eq('externalId', asaasPayment.id)
      .maybeSingle()

    // ── Tratamento da corrida Checkout vs Webhook ─────────────────────────────
    // Se o webhook chegar milissegundos antes do checkout atualizar o externalId,
    // busca o Payment em 'creating' pelo cartId (externalReference do Asaas)
    if (!payment && asaasPayment.externalReference) {
      const { data: creatingPayment } = await supabase
        .from('Payment')
        .select('id, cartId, eventId, status, externalId')
        .eq('cartId', asaasPayment.externalReference)
        .eq('status', 'creating')
        .maybeSingle()

      if (creatingPayment) {
        // Vincula atômica e imediatamente o externalId ao Payment provisório
        await supabase
          .from('Payment')
          .update({
            externalId: asaasPayment.id,
            updatedAt: new Date().toISOString(),
          })
          .eq('id', creatingPayment.id)

        payment = { ...creatingPayment, externalId: asaasPayment.id }
      }
    }

    if (payError || !payment) {
      console.warn('[webhook/asaas] Payment não encontrado para externalId:', asaasPayment.id)
      return NextResponse.json({ ok: true })
    }

    // ── FLUXO DE REEMBOLSO / ESTORNO / CHARGEBACK ──────────────────────────────
    if (isRefundEvent) {
      const targetPaymentStatus = asaasStatus.includes('CHARGEBACK') ? 'chargeback' : 'refunded'

      // Idempotência: se já estiver marcado com status de estorno/chargeback, ignora
      if (payment.status === targetPaymentStatus) {
        return NextResponse.json({ ok: true, note: 'already processed refund' })
      }

      // Atualizar Payment para 'refunded' ou 'chargeback'
      await supabase
        .from('Payment')
        .update({
          status: targetPaymentStatus,
          updatedAt: new Date().toISOString(),
        })
        .eq('id', payment.id)

      // Atualizar Inscrições vinculadas para 'cancelled'
      let cancelRegQuery = supabase
        .from('Registration')
        .update({
          status: 'cancelled',
          updatedAt: new Date().toISOString(),
        })

      if (payment.cartId?.startsWith('order:') || payment.cartId?.startsWith('order_')) {
        // Pedido originado de registrationIds diretos (ex: individual ou sem cartId)
        const raw = payment.cartId.startsWith('order:')
          ? payment.cartId.replace('order:', '')
          : payment.cartId.replace('order_', '')
        const regIds = raw.includes(':') ? raw.split(':').filter(Boolean) : [raw]
        cancelRegQuery = cancelRegQuery.in('id', regIds).eq('eventId', payment.eventId)
      } else if (payment.cartId) {
        cancelRegQuery = cancelRegQuery.eq('cartId', payment.cartId).eq('eventId', payment.eventId)
      } else {
        cancelRegQuery = cancelRegQuery.eq('eventId', payment.eventId)
      }

      await cancelRegQuery

      console.log(`[webhook/asaas] Pagamento estornado: externalId=${asaasPayment.id} status=${targetPaymentStatus}`)
      return NextResponse.json({ ok: true, refunded: true })
    }

    // ── FLUXO DE PAGAMENTO CONFIRMADO ──────────────────────────────────────────
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

    if (payment.cartId?.startsWith('order:') || payment.cartId?.startsWith('order_')) {
      // Inscrição(ões) sem cartId: extrai os registrationIds do orderReference
      const raw = payment.cartId.startsWith('order:')
        ? payment.cartId.replace('order:', '')
        : payment.cartId.replace('order_', '')
      const regIds = raw.includes(':') ? raw.split(':').filter(Boolean) : [raw]
      regQuery = regQuery
        .in('id', regIds)
        .eq('eventId', payment.eventId) // Valida que pertence ao mesmo evento do Payment
    } else if (payment.cartId) {
      regQuery = regQuery
        .eq('cartId', payment.cartId)
        .eq('eventId', payment.eventId)
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
