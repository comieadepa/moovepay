import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// Mapeia status do Asaas → status interno
const PAYMENT_STATUS_MAP: Record<string, string> = {
  CONFIRMED: 'paid',
  RECEIVED: 'paid',
  RECEIVED_IN_CASH: 'paid',
  OVERDUE: 'overdue',
  REFUNDED: 'refunded',
  REFUND_REQUESTED: 'refund_requested',
  CHARGEBACK_REQUESTED: 'chargeback',
  CHARGEBACK_DISPUTE: 'chargeback',
  AWAITING_CHARGEBACK_REVERSAL: 'chargeback',
  DUNNING_REQUESTED: 'overdue',
  DUNNING_RECEIVED: 'paid',
  AWAITING_RISK_ANALYSIS: 'pending',
  PENDING: 'pending',
  CANCELLED: 'cancelled',
}

// Status de pagamento que confirmam a inscrição
const PAID_STATUSES = new Set(['paid'])

export async function POST(request: NextRequest) {
  try {
    // Verificação do token de autenticação
    const authHeader = request.headers.get('asaas-access-token')
    const expectedSecret = process.env.ASSAS_WEBHOOK_SECRET

    if (expectedSecret && authHeader !== expectedSecret) {
      console.warn('[webhook/asaas] Token inválido')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { event, payment } = body as {
      event: string
      payment: {
        id: string
        externalReference?: string
        status: string
        value: number
        paymentDate?: string
        confirmedDate?: string
        netValue?: number
      }
    }

    if (!payment?.id) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
    }

    const asaasStatus = payment.status
    const internalStatus = PAYMENT_STATUS_MAP[asaasStatus] ?? 'pending'
    const paidAt =
      PAID_STATUSES.has(internalStatus)
        ? (payment.paymentDate || payment.confirmedDate || new Date().toISOString())
        : null

    // Atualiza Payment pelo externalId (ID do Asaas)
    const updatePayload: Record<string, any> = {
      status: internalStatus,
      updatedAt: new Date().toISOString(),
    }
    if (paidAt) updatePayload.paidAt = paidAt

    const { data: paymentRow, error: paymentError } = await supabase
      .from('Payment')
      .update(updatePayload)
      .eq('externalId', payment.id)
      .select('id, registrationId, cartId')
      .maybeSingle()

    if (paymentError) {
      console.error('[webhook/asaas] Erro ao atualizar Payment:', paymentError)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }

    if (!paymentRow) {
      // Pagamento não encontrado — pode ser de outro sistema, ignorar silenciosamente
      return NextResponse.json({ ok: true, note: 'payment not found' }, { status: 200 })
    }

    // Se pago, atualiza a(s) Registration(s) vinculada(s)
    if (PAID_STATUSES.has(internalStatus)) {
      if (paymentRow.registrationId) {
        await supabase
          .from('Registration')
          .update({ status: 'confirmed', updatedAt: new Date().toISOString() })
          .eq('id', paymentRow.registrationId)
      } else if (paymentRow.cartId) {
        // Pagamento por carrinho — confirma todas as inscrições do cart
        await supabase
          .from('Registration')
          .update({ status: 'confirmed', updatedAt: new Date().toISOString() })
          .eq('cartId', paymentRow.cartId)
      }
    } else if (internalStatus === 'cancelled' || internalStatus === 'refunded') {
      // Pagamento cancelado/reembolsado → reverte inscrição para pending
      if (paymentRow.registrationId) {
        await supabase
          .from('Registration')
          .update({ status: 'pending', updatedAt: new Date().toISOString() })
          .eq('id', paymentRow.registrationId)
          .eq('status', 'confirmed') // só reverte se estava confirmado
      } else if (paymentRow.cartId) {
        await supabase
          .from('Registration')
          .update({ status: 'pending', updatedAt: new Date().toISOString() })
          .eq('cartId', paymentRow.cartId)
          .eq('status', 'confirmed')
      }
    }

    console.log(`[webhook/asaas] event=${event} asaas_id=${payment.id} status=${asaasStatus} → ${internalStatus}`)
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e) {
    console.error('[webhook/asaas] Erro inesperado:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
