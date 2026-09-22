import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'
import { getAuthContext } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

/**
 * GET /api/checkout/status
 * Consulta o status em tempo real de um pagamento para o polling da página de confirmação.
 *
 * Query Params suportados:
 * - paymentId: ID interno do pagamento (Payment.id)
 * - orderReference: Chave determinística ou cartId (Payment.cartId)
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
      .select('id, cartId, eventId, method, status, value, paidAt, createdAt')

    if (paymentId) {
      paymentQuery = paymentQuery.eq('id', paymentId)
    } else if (orderReference) {
      paymentQuery = paymentQuery.eq('cartId', orderReference)
    }

    const { data: payment, error: payError } = await paymentQuery.maybeSingle()

    if (payError || !payment) {
      return NextResponse.json(
        { error: 'Pagamento não encontrado' },
        { status: 404 }
      )
    }

    // 2. Buscar inscrições associadas ao pagamento
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
      regQuery = regQuery.eq('eventId', payment.eventId).eq('status', 'pending')
    }

    const { data: registrations } = await regQuery

    // 3. Validação de Autorização:
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

    // 4. Montar resposta segura e otimizada para o frontend
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
