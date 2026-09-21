'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { useReactToPrint } from 'react-to-print'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  Crown,
  FileSpreadsheet,
  Printer,
  QrCode,
  RefreshCw,
  TrendingUp,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react'
import type { EventReportsResponse } from '@/app/api/events/[id]/reports/route'

export default function EventReportsPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isProAllowed, setIsProAllowed] = useState<boolean | null>(null)
  const [currentPlan, setCurrentPlan] = useState<string>('essencial')

  // Filtros de período
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  // Dados da API
  const [reportsData, setReportsData] = useState<EventReportsResponse | null>(null)

  // Ref de impressão para relatório consolidado
  const printReportRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({
    content: () => printReportRef.current,
    documentTitle: `Relatorio-Evento-${eventId}`,
  })

  // 1. Carregar dados da API
  const loadReports = useCallback(async () => {
    if (!eventId) return
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const url = `/api/events/${eventId}/reports${params.toString() ? `?${params.toString()}` : ''}`
      const res = await fetch(url)
      const data = await res.json()

      if (res.status === 403 && data.upgradeRequired) {
        setIsProAllowed(false)
        setCurrentPlan(data.currentPlan || 'essencial')
        return
      }

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao carregar relatórios')
      }

      setIsProAllowed(true)
      setReportsData(data)
    } catch (err: any) {
      setError(err.message || 'Erro inesperado')
    } finally {
      setLoading(false)
    }
  }, [eventId, startDate, endDate])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  // Formatação de Moeda
  const money = useMemo(
    () => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
    []
  )

  // 2. Exportação para Excel
  const handleExportExcel = () => {
    if (!reportsData) return

    const wb = XLSX.utils.book_new()

    // Aba 1: Vendas por Método
    const methodRows = reportsData.sales.byMethod.map((m) => ({
      'Método de Pagamento': m.method,
      'Quantidade de Transações': m.count,
      'Valor Total (R$)': m.grossValue,
    }))
    const wsMethods = XLSX.utils.json_to_sheet(methodRows)
    XLSX.utils.book_append_sheet(wb, wsMethods, 'Métodos de Pagamento')

    // Aba 2: Evolução Diária
    const timelineRows = reportsData.sales.timeline.map((t) => ({
      Data: t.date,
      'Novas Inscrições': t.count,
      'Receita Bruta (R$)': t.grossValue,
    }))
    const wsTimeline = XLSX.utils.json_to_sheet(timelineRows)
    XLSX.utils.book_append_sheet(wb, wsTimeline, 'Evolução Diária')

    // Aba 3: Check-in por Operador
    const opRows = reportsData.checkin.byOperator.map((o) => ({
      Operador: o.operatorName,
      'Total de Leituras': o.totalScans,
      'Entradas Confirmadas': o.successCount,
      'Já Utilizados': o.alreadyUsedCount,
      'Não Pagos': o.notPaidCount,
    }))
    const wsOps = XLSX.utils.json_to_sheet(opRows)
    XLSX.utils.book_append_sheet(wb, wsOps, 'Operadores de Portaria')

    // Aba 4: Fluxo por Hora
    const hourlyRows = reportsData.checkin.byHour.map((h) => ({
      Horário: h.hour,
      'Entradas Validadas': h.count,
    }))
    const wsHourly = XLSX.utils.json_to_sheet(hourlyRows)
    XLSX.utils.book_append_sheet(wb, wsHourly, 'Picos por Horário')

    const dateStr = format(new Date(), 'yyyyMMdd')
    XLSX.writeFile(wb, `relatorio-analitico-${eventId}-${dateStr}.xlsx`)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ── CABEÇALHO ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-slate-900">Relatórios Analíticos</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
              <Crown className="w-3.5 h-3.5 text-amber-500" />
              Pro
            </span>
          </div>
          <p className="text-slate-600 mt-1">
            {reportsData?.eventName || 'Métricas analíticas de vendas, evolução e portaria'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/eventos/${eventId}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar ao evento
          </Button>

          <Button
            variant="outline"
            onClick={() => router.push(`/eventos/${eventId}/inscritos`)}
            className="gap-1.5"
          >
            <Users className="h-4 w-4" />
            Inscritos
          </Button>

          {isProAllowed && (
            <>
              <Button
                variant="outline"
                onClick={handlePrint}
                disabled={loading || !reportsData}
                className="gap-1.5"
              >
                <Printer className="h-4 w-4" />
                Imprimir Relatório
              </Button>

              <Button
                variant="outline"
                onClick={handleExportExcel}
                disabled={loading || !reportsData}
                className="border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 gap-1.5"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Exportar Excel
              </Button>
            </>
          )}

          <Button
            variant="outline"
            onClick={loadReports}
            disabled={loading}
            title="Atualizar dados"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* ── BARRA DE FILTROS DE PERÍODO ── */}
      {isProAllowed && (
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  Filtrar Período:
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-40 bg-white"
                  />
                  <span className="text-slate-400 text-sm">até</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-40 bg-white"
                  />
                </div>
                {(startDate || endDate) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStartDate('')
                      setEndDate('')
                    }}
                    className="text-xs text-slate-600 hover:text-slate-900"
                  >
                    Limpar
                  </Button>
                )}
              </div>
              <div className="text-xs text-slate-500">
                Fuso Horário: <strong>America/Sao_Paulo (UTC-3)</strong>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── ESTADO DE CARREGAMENTO ── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <RefreshCw className="h-8 w-8 animate-spin text-purple-600 mb-3" />
          <p className="text-sm font-medium">Consolidando métricas e auditoria do evento...</p>
        </div>
      )}

      {/* ── ESTADO DE ERRO ── */}
      {!loading && error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 pb-6 flex items-center gap-3 text-red-700">
            <AlertCircle className="h-6 w-6 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">Não foi possível carregar os relatórios</p>
              <p className="text-xs mt-0.5">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── ESTADO PLANO ESSENCIAL / FREE (CTA UPGRADE PRO) ── */}
      {!loading && isProAllowed === false && (
        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 via-white to-indigo-50 shadow-md">
          <CardContent className="py-12 px-6 flex flex-col items-center text-center max-w-2xl mx-auto space-y-6">
            <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shadow-sm border border-purple-200">
              <Crown className="w-8 h-8 text-amber-500" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-slate-900">Relatórios Analíticos Avançados</h2>
              <p className="text-slate-600 mt-2 text-sm leading-relaxed">
                Você está utilizando o plano <strong>{currentPlan === 'free' ? 'Gratuito' : 'Essencial'}</strong>.
                Os relatórios avançados de vendas por canal, evolução diária e auditoria de fluxo de portaria estão disponíveis no plano <strong>Pro</strong>.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left w-full text-xs">
              <div className="p-3 bg-white border border-purple-100 rounded-lg flex items-start gap-2 shadow-xs">
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Gráficos de vendas divididos por PIX, Cartão e Boleto</span>
              </div>
              <div className="p-3 bg-white border border-purple-100 rounded-lg flex items-start gap-2 shadow-xs">
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Linha do tempo diária de novas inscrições e faturamento</span>
              </div>
              <div className="p-3 bg-white border border-purple-100 rounded-lg flex items-start gap-2 shadow-xs">
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Auditoria de portaria por operador e horários de pico</span>
              </div>
              <div className="p-3 bg-white border border-purple-100 rounded-lg flex items-start gap-2 shadow-xs">
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Taxa reduzida por inscrição (apenas 5% vs 10% no Essencial)</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                onClick={() => router.push('/admin/tenants')}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold gap-1.5 px-6"
              >
                <Crown className="w-4 h-4 text-amber-300" />
                Fazer Upgrade para o Pro
              </Button>

              <Button
                variant="outline"
                onClick={() => router.push(`/eventos/${eventId}/inscritos`)}
                className="border-slate-300 text-slate-700"
              >
                Continuar com Lista de Inscritos
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── CONTEÚDO ANALÍTICO COMPLETO (PRO & CUSTOM) ── */}
      {!loading && isProAllowed && reportsData && (
        <div ref={printReportRef} className="space-y-6">
          {/* Cabeçalho impresso exclusivo */}
          <div className="hidden print:block border-b-2 border-slate-900 pb-3 mb-4">
            <h1 className="text-xl font-bold uppercase">{reportsData.eventName}</h1>
            <p className="text-xs text-slate-500">
              Relatório Analítico Consolidado · Emitido em{' '}
              {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>

          {/* Cards de Métricas Top-Level */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-emerald-500">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-500">Receita Confirmada</span>
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                </div>
                <p className="text-2xl font-bold text-emerald-700">
                  {money.format(reportsData.sales.totalRevenue)}
                </p>
                <p className="text-xs text-slate-400 mt-1">Apenas pagamentos confirmados</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-500">Vendas Confirmadas</span>
                  <CreditCard className="w-4 h-4 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-blue-700">
                  {reportsData.sales.confirmedPaymentsCount}
                </p>
                <p className="text-xs text-slate-400 mt-1">Pedidos pagos / gratuitos</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-500">Check-ins Validados</span>
                  <UserCheck className="w-4 h-4 text-purple-500" />
                </div>
                <p className="text-2xl font-bold text-purple-700">
                  {reportsData.checkin.successfulCheckins}
                </p>
                <p className="text-xs text-slate-400 mt-1">Presenças confirmadas</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-500">Total de Leituras</span>
                  <QrCode className="w-4 h-4 text-amber-500" />
                </div>
                <p className="text-2xl font-bold text-amber-700">
                  {reportsData.checkin.totalScans}
                </p>
                <p className="text-xs text-slate-400 mt-1">Tentativas na portaria</p>
              </CardContent>
            </Card>
          </div>

          {/* Seção 1: Vendas por Método e Evolução Diária */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Vendas por Método de Pagamento */}
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  Vendas por Método de Pagamento
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {reportsData.sales.byMethod.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">
                    Nenhum pagamento confirmado no período.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {reportsData.sales.byMethod.map((m) => {
                      const pct =
                        reportsData.sales.totalRevenue > 0
                          ? Math.round((m.grossValue / reportsData.sales.totalRevenue) * 100)
                          : 0
                      return (
                        <div key={m.method} className="space-y-1.5">
                          <div className="flex justify-between text-sm">
                            <span className="font-semibold text-slate-800">{m.method}</span>
                            <span className="text-slate-600">
                              {money.format(m.grossValue)} ({m.count} pedidos)
                            </span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Evolução Diária das Inscrições */}
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-600" />
                  Evolução Diária de Inscrições
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {reportsData.sales.timeline.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">
                    Nenhuma inscrição registrada no período selecionado.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {reportsData.sales.timeline.map((item) => (
                      <div
                        key={item.date}
                        className="flex items-center justify-between text-sm p-2 rounded-md bg-slate-50 border border-slate-100"
                      >
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-medium text-slate-700">
                            {format(new Date(item.date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-900">{item.count} inscr.</span>
                          <span className="text-xs text-slate-500 ml-2">
                            ({money.format(item.grossValue)})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Seção 2: Portaria & Auditoria de Check-in */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Picos de Horário */}
            <Card className="md:col-span-1">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-600" />
                  Fluxo de Check-in por Horário
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {reportsData.checkin.byHour.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">
                    Nenhum check-in registrado ainda.
                  </p>
                ) : (
                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {reportsData.checkin.byHour.map((h) => (
                      <div
                        key={h.hour}
                        className="flex items-center justify-between text-sm border-b pb-1.5 last:border-b-0"
                      >
                        <span className="text-slate-600 font-mono">{h.hour}</span>
                        <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded text-xs">
                          {h.count} entradas
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Validações por Operador */}
            <Card className="md:col-span-1">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  Atividade por Operador
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {reportsData.checkin.byOperator.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">
                    Nenhum operador com leitura registrada.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {reportsData.checkin.byOperator.map((op) => (
                      <div
                        key={op.operatorId}
                        className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 space-y-1 text-xs"
                      >
                        <div className="flex justify-between font-semibold text-slate-800">
                          <span className="truncate max-w-[140px]" title={op.operatorName}>
                            {op.operatorName}
                          </span>
                          <span>{op.totalScans} scans</span>
                        </div>
                        <div className="flex gap-2 text-[11px] text-slate-500">
                          <span className="text-emerald-600 font-medium">
                            ✓ {op.successCount} OK
                          </span>
                          {op.alreadyUsedCount > 0 && (
                            <span className="text-amber-600">⚠ {op.alreadyUsedCount} duplicados</span>
                          )}
                          {op.notPaidCount > 0 && (
                            <span className="text-red-600">✗ {op.notPaidCount} não pagos</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Motivos de Rejeição */}
            <Card className="md:col-span-1">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-600" />
                  Motivos de Recusa na Portaria
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {reportsData.checkin.refusals.length === 0 ? (
                  <div className="py-6 text-center text-slate-500">
                    <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                    <p className="text-xs font-medium">Nenhuma tentativa de acesso rejeitada!</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {reportsData.checkin.refusals.map((r) => (
                      <div
                        key={r.reason}
                        className="flex items-center justify-between text-xs p-2 rounded bg-red-50/50 border border-red-100"
                      >
                        <span className="font-medium text-slate-800">{r.reason}</span>
                        <span className="font-bold text-red-700">{r.count} vezes</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
