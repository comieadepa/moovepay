import { NextRequest, NextResponse } from 'next/server'
import { requirePlanFeature } from '@/lib/plan-guard'
import { supabase } from '@/lib/supabase-server'
import { isTenantMember } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

const TIMEZONE = 'America/Sao_Paulo'

export interface PaymentMethodStat {
  method: string
  count: number
  grossValue: number
}

export interface SalesTimelineItem {
  date: string
  count: number
  grossValue: number
}

export interface CheckinHourlyStat {
  hour: string
  count: number
}

export interface OperatorStat {
  operatorId: string
  operatorName: string
  totalScans: number
  successCount: number
  alreadyUsedCount: number
  notPaidCount: number
  otherCount: number
}

export interface RefusalStat {
  reason: string
  count: number
}

export interface EventReportsResponse {
  success: boolean
  eventId: string
  eventName: string
  period: {
    startDate?: string
    endDate?: string
    timeZone: string
  }
  sales: {
    totalRevenue: number
    confirmedPaymentsCount: number
    byMethod: PaymentMethodStat[]
    timeline: SalesTimelineItem[]
  }
  checkin: {
    totalScans: number
    successfulCheckins: number
    byHour: CheckinHourlyStat[]
    byOperator: OperatorStat[]
    refusals: RefusalStat[]
  }
}

function formatInTimeZone(date: Date | string, timeZone: string = TIMEZONE): { date: string; hour: string } {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) {
    return { date: '1970-01-01', hour: '00:00' }
  }

  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  })

  const parts = formatter.formatToParts(d)
  const partMap: Record<string, string> = {}
  for (const p of parts) {
    partMap[p.type] = p.value
  }

  const yyyy = partMap.year || '1970'
  const mm = partMap.month || '01'
  const dd = partMap.day || '01'
  const hh = partMap.hour || '00'

  return {
    date: `${yyyy}-${mm}-${dd}`,
    hour: `${hh}:00`,
  }
}

/**
 * Converte data limite (início ou fim) garantindo que datas no formato YYYY-MM-DD
 * sejam interpretadas estritamente no fuso horário do projeto (America/Sao_Paulo).
 * Para início: 00:00:00.000 (inclusive)
 * Para fim: 23:59:59.999 (inclusive)
 */
function parsePeriodBoundary(dateStr: string | null | undefined, isEnd: boolean): number {
  if (!dateStr || typeof dateStr !== 'string') {
    return isEnd ? Infinity : -Infinity
  }

  const trimmed = dateStr.trim()
  if (!trimmed) return isEnd ? Infinity : -Infinity

  // Formato civil YYYY-MM-DD
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (match) {
    const [, yyyy, mm, dd] = match
    const timePart = isEnd ? '23:59:59.999' : '00:00:00.000'
    // America/Sao_Paulo é UTC-3 permanente (sem horário de verão desde 2019)
    const isoString = `${yyyy}-${mm}-${dd}T${timePart}-03:00`
    const parsed = new Date(isoString).getTime()
    if (!isNaN(parsed)) return parsed
  }

  // Fallback para strings ISO já completas com timezone ou timestamp
  const d = new Date(trimmed)
  if (!isNaN(d.getTime())) {
    return d.getTime()
  }

  return isEnd ? Infinity : -Infinity
}

function aggregateReportData(params: {
  payments: any[]
  checkinLogs: any[]
  startDate?: string | null
  endDate?: string | null
  timeZone?: string
}) {
  const tz = params.timeZone || TIMEZONE

  const startMs = parsePeriodBoundary(params.startDate, false)
  const endMs = parsePeriodBoundary(params.endDate, true)

  const confirmedPayments = (params.payments || []).filter((p) => {
    const st = String(p.status || '').toLowerCase()
    const isConfirmed = st === 'paid' || st === 'received'
    if (!isConfirmed) return false

    const ts = new Date(p.paidAt || p.createdAt).getTime()
    if (isNaN(ts)) return false
    return ts >= startMs && ts <= endMs
  })

  let totalRevenue = 0
  const methodMap: Record<string, { count: number; grossValue: number }> = {}
  const timelineMap: Record<string, { count: number; grossValue: number }> = {}

  for (const p of confirmedPayments) {
    const val = Number(p.value || 0)
    totalRevenue += val

    const rawMethod = String(p.method || 'outro').toLowerCase()
    const method =
      rawMethod === 'pix'
        ? 'PIX'
        : rawMethod === 'credit_card'
        ? 'Cartão de Crédito'
        : rawMethod === 'boleto'
        ? 'Boleto Bancário'
        : rawMethod === 'free'
        ? 'Gratuito'
        : rawMethod.toUpperCase()

    if (!methodMap[method]) {
      methodMap[method] = { count: 0, grossValue: 0 }
    }
    methodMap[method].count += 1
    methodMap[method].grossValue = Number((methodMap[method].grossValue + val).toFixed(2))

    const { date: dateStr } = formatInTimeZone(p.paidAt || p.createdAt, tz)
    if (!timelineMap[dateStr]) {
      timelineMap[dateStr] = { count: 0, grossValue: 0 }
    }
    timelineMap[dateStr].count += 1
    timelineMap[dateStr].grossValue = Number((timelineMap[dateStr].grossValue + val).toFixed(2))
  }

  const byMethod: PaymentMethodStat[] = Object.entries(methodMap)
    .map(([method, data]) => ({
      method,
      count: data.count,
      grossValue: data.grossValue,
    }))
    .sort((a, b) => b.grossValue - a.grossValue)

  const timeline: SalesTimelineItem[] = Object.entries(timelineMap)
    .map(([date, data]) => ({
      date,
      count: data.count,
      grossValue: data.grossValue,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const filteredLogs = (params.checkinLogs || []).filter((l) => {
    const ts = new Date(l.scannedAt).getTime()
    if (isNaN(ts)) return false
    return ts >= startMs && ts <= endMs
  })

  let successfulCheckins = 0
  const hourlyMap: Record<string, number> = {}
  const operatorMap: Record<string, OperatorStat> = {}
  const refusalMap: Record<string, number> = {}

  for (const log of filteredLogs) {
    const result = String(log.result || '').toLowerCase()
    const isSuccess = result === 'ok' || result === 'success'

    if (isSuccess) {
      successfulCheckins += 1
    }

    if (isSuccess) {
      const { hour: hourStr } = formatInTimeZone(log.scannedAt, tz)
      hourlyMap[hourStr] = (hourlyMap[hourStr] || 0) + 1
    }

    const opId = String(log.scannedBy || 'desconhecido')
    const opName = String(log.scannedByName || opId)
    if (!operatorMap[opId]) {
      operatorMap[opId] = {
        operatorId: opId,
        operatorName: opName,
        totalScans: 0,
        successCount: 0,
        alreadyUsedCount: 0,
        notPaidCount: 0,
        otherCount: 0,
      }
    }
    operatorMap[opId].totalScans += 1
    if (isSuccess) {
      operatorMap[opId].successCount += 1
    } else if (result === 'already_used') {
      operatorMap[opId].alreadyUsedCount += 1
    } else if (result === 'not_paid') {
      operatorMap[opId].notPaidCount += 1
    } else {
      operatorMap[opId].otherCount += 1
    }

    if (!isSuccess) {
      const reasonLabel =
        result === 'already_used'
          ? 'Voucher já utilizado'
          : result === 'not_paid'
          ? 'Pagamento não confirmado'
          : result === 'not_found'
          ? 'Inscrição não encontrada'
          : result || 'Outro motivo'
      refusalMap[reasonLabel] = (refusalMap[reasonLabel] || 0) + 1
    }
  }

  const byHour: CheckinHourlyStat[] = Object.entries(hourlyMap)
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => a.hour.localeCompare(b.hour))

  const byOperator: OperatorStat[] = Object.values(operatorMap).sort(
    (a, b) => b.totalScans - a.totalScans
  )

  const refusals: RefusalStat[] = Object.entries(refusalMap)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)

  return {
    sales: {
      totalRevenue: Number(totalRevenue.toFixed(2)),
      confirmedPaymentsCount: confirmedPayments.length,
      byMethod,
      timeline,
    },
    checkin: {
      totalScans: filteredLogs.length,
      successfulCheckins,
      byHour,
      byOperator,
      refusals,
    },
  }
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

    const guard = await requirePlanFeature(request, 'advancedReports')
    if (guard.response) {
      return guard.response
    }

    const { auth, tenantId } = guard.context!

    const member = await isTenantMember(tenantId, auth.userId)
    if (!member && tenantId !== auth.userId && auth.role !== 'admin') {
      return NextResponse.json({ error: 'Não autorizado (tenant)' }, { status: 403 })
    }

    let eventQuery = supabase
      .from('Event')
      .select('id, name, tenantId, creatorId')
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

    const searchParams = request.nextUrl.searchParams
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    if (startDateParam && endDateParam) {
      const startMs = parsePeriodBoundary(startDateParam, false)
      const endMs = parsePeriodBoundary(endDateParam, true)
      if (startMs > endMs) {
        return NextResponse.json(
          { error: 'Data inicial não pode ser posterior à data final' },
          { status: 400 }
        )
      }
    }

    const [paymentsResult, checkinLogsResult] = await Promise.all([
      supabase
        .from('Payment')
        .select('id, eventId, method, status, value, paidAt, createdAt')
        .eq('eventId', event.id),
      supabase
        .from('CheckinLog')
        .select('id, eventId, scannedBy, scannedByName, result, scannedAt')
        .eq('eventId', event.id)
        .order('scannedAt', { ascending: true }),
    ])

    if (paymentsResult.error) {
      console.error('[reports] Erro ao buscar pagamentos:', paymentsResult.error)
      return NextResponse.json({ error: 'Erro ao consultar dados de vendas' }, { status: 500 })
    }

    if (checkinLogsResult.error) {
      console.error('[reports] Erro ao buscar logs de check-in:', checkinLogsResult.error)
      return NextResponse.json({ error: 'Erro ao consultar dados de portaria' }, { status: 500 })
    }

    const aggregated = aggregateReportData({
      payments: paymentsResult.data || [],
      checkinLogs: checkinLogsResult.data || [],
      startDate: startDateParam,
      endDate: endDateParam,
      timeZone: TIMEZONE,
    })

    const responsePayload: EventReportsResponse = {
      success: true,
      eventId: event.id,
      eventName: event.name,
      period: {
        startDate: startDateParam || undefined,
        endDate: endDateParam || undefined,
        timeZone: TIMEZONE,
      },
      sales: aggregated.sales,
      checkin: aggregated.checkin,
    }

    return NextResponse.json(responsePayload, { status: 200 })
  } catch (err: any) {
    console.error('[reports] Erro inesperado ao gerar relatórios:', err)
    return NextResponse.json(
      { error: 'Erro interno ao processar relatórios' },
      { status: 500 }
    )
  }
}
