import { NextRequest, NextResponse } from 'next/server'
import { requirePlanFeature } from '@/lib/plan-guard'
import { supabase } from '@/lib/supabase-server'
import { isTenantMember } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

export interface BadgeItem {
  id: string
  fullName: string
  cpf?: string
  inscriptionTypeName: string
  qrPayload: string
}

export interface EventBadgesResponse {
  success: boolean
  eventId: string
  eventName: string
  startDate?: string | null
  ticketConfig?: {
    ticketType?: string
    ticketSize?: string
    ticketLayout?: string
    backgroundColor?: string | null
    logoUrl?: string | null
  } | null
  badges: BadgeItem[]
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = params.id
    if (!eventId) {
      return NextResponse.json({ error: 'ID do evento obrigatório' }, { status: 400 })
    }

    // 1. Guard de Feature Premium: apenas Pro e Custom possuem advancedReports
    const guard = await requirePlanFeature(request, 'advancedReports')
    if (guard.response) {
      return guard.response
    }

    const { auth, tenantId } = guard.context!

    // 2. Validação de membro do tenant
    const member = await isTenantMember(tenantId, auth.userId)
    if (!member && tenantId !== auth.userId && auth.role !== 'admin') {
      return NextResponse.json({ error: 'Não autorizado (tenant)' }, { status: 403 })
    }

    // 3. Validação de propriedade do evento e isolamento multi-tenant
    let eventQuery = supabase
      .from('Event')
      .select('id, name, startDate, tenantId, creatorId')
      .eq('id', eventId)

    if (auth.role !== 'admin') {
      eventQuery = eventQuery.or(`tenantId.eq.${tenantId},creatorId.eq.${auth.userId}`)
    }

    const { data: event, error: eventError } = await eventQuery.maybeSingle()

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Evento não encontrado ou acesso não autorizado' },
        { status: 404 }
      )
    }

    // 4. Buscar TicketConfig opcional (se configurado para o evento)
    const { data: ticketConfig } = await supabase
      .from('TicketConfig')
      .select('ticketType, ticketSize, ticketLayout, backgroundColor, logoUrl')
      .eq('eventId', event.id)
      .maybeSingle()

    // 5. Buscar inscrições confirmadas (elegíveis: paid ou confirmed)
    const { data: registrations, error: regError } = await supabase
      .from('Registration')
      .select(`
        id, fullName, cpf, status,
        inscriptionType:InscriptionType(name)
      `)
      .eq('eventId', event.id)
      .in('status', ['paid', 'confirmed'])
      .order('fullName', { ascending: true })

    if (regError) {
      console.error('[badges] Erro ao buscar inscrições para crachás:', regError)
      return NextResponse.json({ error: 'Erro ao consultar participantes' }, { status: 500 })
    }

    // 6. Montar crachás padronizados reutilizando estritamente o identificador seguro da plataforma
    // O payload `congregapay:reg:<id>` é o padrão oficial aceito pelo leitor de check-in sem expor dados sensíveis
    const badges: BadgeItem[] = (registrations || []).map((r: any) => {
      const typeData = Array.isArray(r.inscriptionType) ? r.inscriptionType[0] : r.inscriptionType
      return {
        id: r.id,
        fullName: r.fullName,
        cpf: r.cpf || undefined,
        inscriptionTypeName: typeData?.name || 'Inscrição',
        qrPayload: `congregapay:reg:${r.id}`,
      }
    })

    const payload: EventBadgesResponse = {
      success: true,
      eventId: event.id,
      eventName: event.name,
      startDate: event.startDate,
      ticketConfig: ticketConfig || null,
      badges,
    }

    return NextResponse.json(payload, { status: 200 })
  } catch (err: any) {
    console.error('[badges] Erro inesperado ao gerar crachás:', err)
    return NextResponse.json(
      { error: 'Erro interno ao gerar dados de crachás' },
      { status: 500 }
    )
  }
}
