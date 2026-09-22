import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'
import { getAuthContext } from '@/lib/rbac'
import { getPayment as getAsaasPayment } from '@/lib/asaas'
import { sendEmail, emailTemplates } from '@/lib/email'
import QRCode from 'qrcode'

export const dynamic = 'force-dynamic'

// Status do Asaas que representam pagamento confirmado
const ASAAS_PAID_STATUSES = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'])

/**
 * GET /api/checkout/status
 * Consulta o status em tempo real de um pagamento para o polling da página de confirmação.
 * 
 * Reconciliação Passiva:
 * Se o pagamento local ainda estiver com status 'pending' (ou 'creating') e tiver um externalId do Asaas,
 * consulta diretamente a API oficial do Asaas no servidor. Se o Asaas confirmar o recebimento do PIX,
 * executa de forma atômica e idempotente a baixa do pagamento, atualização das inscrições e emissão dos vouchers.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const paymentId = searchParams.get('paymentId')?.trim()
    const orderReference = searchParams.get('orderReference')?.trim()

    if (!paymentId && !orderReference) {
      return NextResponse.json(
        { error: 'paymentId ou orderReference é obrigatório' },
        { status: 400 }
      )
    }

    // 1. Buscar Payment pelo paymentId ou orderReference (cartId)
    let paymentQuery = supabase
      .from('Payment')
      .select('id, cartId, eventId, method, status, value, externalId, paidAt, createdAt')

    if (paymentId) {
      paymentQuery = paymentQuery.eq('id', paymentId)
    } else if (orderReference) {
      paymentQuery = paymentQuery.eq('cartId', orderReference)
    }

    let { data: payment, error: payError } = await paymentQuery.maybeSingle()

    if (payError || !payment) {
      return NextResponse.json(
        { error: 'Pagamento não encontrado' },
        { status: 404 }
      )
    }

    // ── 2. RECONCILIAÇÃO PASSIVA COM O GATEWAY ASAAS ────────────────────────────
    // Se o pagamento ainda estiver pendente e possuir externalId (cobrança gerada no Asaas),
    // consulta a API do Asaas para verificar se o PIX já foi recebido.
    if (payment.status !== 'paid' && payment.externalId) {
      try {
        const asaasData = await getAsaasPayment(payment.externalId)
        const asaasStatus = String(asaasData?.status ?? '').toUpperCase()

        // Validação rigorosa: ID idêntico, valor correspondente e status confirmado
        const isMatchedPayment = asaasData?.id === payment.externalId
        const isMatchedValue = Math.abs(Number(asaasData?.value ?? 0) - Number(payment.value ?? 0)) < 0.05
        const isAsaasPaid = ASAAS_PAID_STATUSES.has(asaasStatus)

        if (isMatchedPayment && isMatchedValue && isAsaasPaid) {
          console.log(`[checkout/status] Reconciliação confirmada no Asaas: paymentId=${payment.id} externalId=${payment.externalId} status=${asaasStatus}`)
          
          const paidAt = asaasData?.paymentDate || asaasData?.confirmedDate || new Date().toISOString()

          // 2.1 Atualizar Payment para 'paid'
          await supabase
            .from('Payment')
            .update({ status: 'paid', paidAt, updatedAt: new Date().toISOString() })
            .eq('id', payment.id)

          // 2.2 Buscar e atualizar inscrições
          let regQueryToUpdate = supabase
            .from('Registration')
            .select('id, fullName, email, eventId, event:Event(name)')

          if (payment.cartId?.startsWith('order:') || payment.cartId?.startsWith('order_')) {
            const raw = payment.cartId.startsWith('order:')
              ? payment.cartId.replace('order:', '')
              : payment.cartId.replace('order_', '')
            const regIds = raw.includes(':') ? raw.split(':').filter(Boolean) : [raw]
            regQueryToUpdate = regQueryToUpdate.in('id', regIds).eq('eventId', payment.eventId)
          } else if (payment.cartId) {
            regQueryToUpdate = regQueryToUpdate.eq('cartId', payment.cartId).eq('eventId', payment.eventId)
          } else {
            regQueryToUpdate = regQueryToUpdate.eq('eventId', payment.eventId).eq('status', 'pending')
          }

          const { data: regsToConfirm } = await regQueryToUpdate

          if (regsToConfirm && regsToConfirm.length > 0) {
            for (const reg of regsToConfirm) {
              // Atualizar status da inscrição
              await supabase
                .from('Registration')
                .update({ status: 'paid', updatedAt: new Date().toISOString() })
                .eq('id', reg.id)

              // Gerar QR Code canônico para check-in
              const qrPayload = `congregapay:voucher:${reg.id}`
              const qrCode = await QRCode.toDataURL(qrPayload, { errorCorrectionLevel: 'H' })

              // Upsert idempotente do Voucher
              await supabase
                .from('Voucher')
                .upsert({ registrationId: reg.id, qrCode, used: false }, { onConflict: 'registrationId' })

              // Disparar e-mail de voucher (best-effort)
              const eventObj = Array.isArray((reg as any).event) ? (reg as any).event[0] : (reg as any).event
              const eventName = eventObj?.name || 'Evento'
              const appBaseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_ORIGIN || 'https://congregapay.com.br').replace(/\/$/, '')
              const voucherUrl = `${appBaseUrl}/voucher/${reg.id}`

              try {
                const template = emailTemplates.voucherEmail(reg.fullName, eventName, voucherUrl)
                await sendEmail({ to: reg.email, subject: template.subject, html: template.html })
                console.log(`[checkout/status] E-mail de voucher enviado pós-reconciliação para ${reg.email} (inscrição ${reg.id})`)
              } catch (emailErr) {
                console.warn('[checkout/status] Erro ao enviar e-mail de voucher pós-reconciliação:', emailErr)
              }
            }
          }

          // Atualizar objeto em memória para refletir imediatamente a baixa
          payment.status = 'paid'
          payment.paidAt = paidAt
        }
      } catch (reconcileErr) {
        // Falhas de rede com o Asaas são tratadas como fail-closed (mantém pending)
        console.warn('[checkout/status] Aviso durante reconciliação Asaas:', reconcileErr)
      }
    }

    // 3. Buscar inscrições associadas ao pagamento para montagem da resposta
    let regQuery = supabase
      .from('Registration')
      .select(`
        id, fullName, email, status, totalValue, cartId,
        inscriptionType:InscriptionType(id, name),
        voucher:Voucher(id, used, usedAt)
      `)

    if (payment.cartId?.startsWith('order:') || payment.cartId?.startsWith('order_')) {
      const raw = payment.cartId.startsWith('order:')
        ? payment.cartId.replace('order:', '')
        : payment.cartId.replace('order_', '')
      const regIds = raw.includes(':') ? raw.split(':').filter(Boolean) : [raw]
      regQuery = regQuery.in('id', regIds).eq('eventId', payment.eventId)
    } else if (payment.cartId) {
      regQuery = regQuery.eq('cartId', payment.cartId).eq('eventId', payment.eventId)
    } else {
      regQuery = regQuery.eq('eventId', payment.eventId)
    }

    const { data: registrations } = await regQuery

    // 4. Validação de Autorização:
    // Se o usuário estiver autenticado (logado), verificar se é o criador/dono do evento,
    // membro da equipe ou se o e-mail coincide com algum dos participantes do pedido.
    const auth = getAuthContext(request)
    if (auth) {
      const { data: event } = await supabase
        .from('Event')
        .select('tenantId, creatorId')
        .eq('id', payment.eventId)
        .maybeSingle()

      const isStaffOrOwner =
        event?.tenantId === auth.tenantId ||
        event?.creatorId === auth.userId ||
        auth.role === 'admin'

      const isParticipant = (registrations || []).some(
        (r) => r.email?.toLowerCase() === auth.email?.toLowerCase()
      )

      // Se o usuário logado NÃO é participante, nem organizador, nem admin -> bloqueia
      if (!isStaffOrOwner && !isParticipant && registrations && registrations.length > 0) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
      }
    }

    // 5. Montar resposta segura e otimizada para o frontend
    const isPaid = payment.status === 'paid'

    // Formatar vouchers apenas para inscrições confirmadas/pagas
    const vouchers = (registrations || [])
      .filter((r) => r.status === 'paid' || r.status === 'confirmed' || isPaid)
      .map((r) => {
        const it = Array.isArray(r.inscriptionType) ? r.inscriptionType[0] : r.inscriptionType
        const v = Array.isArray(r.voucher) ? r.voucher[0] : r.voucher
        return {
          registrationId: r.id,
          fullName: r.fullName,
          inscriptionTypeName: it?.name || 'Inscrição',
          voucherUrl: `/voucher/${r.id}`,
          isUsed: v?.used ?? false,
        }
      })

    const response = NextResponse.json(
      {
        success: true,
        payment: {
          id: payment.id,
          method: payment.method,
          status: payment.status,
          isPaid,
          paidAt: payment.paidAt,
          totalValue: payment.value,
          registrationsCount: registrations?.length || 0,
          vouchers: isPaid ? vouchers : [],
        },
      },
      { status: 200 }
    )

    // Garantir que a resposta do polling nunca seja armazenada em cache
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    return response
  } catch (error: any) {
    console.error('[checkout/status] Erro ao consultar status:', error)
    return NextResponse.json({ error: 'Erro interno ao consultar status' }, { status: 500 })
  }
}
