'use client'

import { useEffect, useMemo, useState } from 'react'
import { TrendingUp, DollarSign, ArrowDownRight, CreditCard, BarChart3 } from 'lucide-react'

type Totals = { gross: number; fee: number; net: number; count: number }
type Row = { tenantId: string; gross: number; fee: number; net: number; count: number }

export default function AdminFinancePage() {
  const [totals, setTotals] = useState<Totals | null>(null)
  const [summary, setSummary] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const money = useMemo(() => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }), [])

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        setIsLoading(true)
        setError(null)
        const res = await fetch('/api/admin/finance')
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Erro ao carregar financeiro')
        if (!mounted) return
        setTotals(data?.totals || null)
        setSummary(data?.summary || [])
      } catch (e: any) {
        if (!mounted) return
        setError(e?.message || 'Erro ao carregar financeiro')
      } finally {
        if (!mounted) return
        setIsLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const maxFee = summary.length ? Math.max(...summary.map(r => r.fee)) : 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Financeiro</h1>
        <p className="text-slate-500 text-sm mt-1">Resumo de recebidos e taxa de 10% da plataforma</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm">{error}</div>
      )}

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400 text-sm">Carregando...</div>
      ) : !totals ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400 text-sm">Sem dados financeiros.</div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
            <div className="rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 p-5 text-white shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium opacity-80">Pagamentos</span>
                <CreditCard className="w-5 h-5 opacity-60" />
              </div>
              <p className="text-3xl font-bold">{totals.count}</p>
              <p className="text-xs opacity-60 mt-1">transações recebidas</p>
            </div>

            <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 p-5 text-white shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium opacity-80">Volume Bruto</span>
                <TrendingUp className="w-5 h-5 opacity-60" />
              </div>
              <p className="text-2xl font-bold">{money.format(totals.gross)}</p>
              <p className="text-xs opacity-60 mt-1">total transacionado</p>
            </div>

            <div className="rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 p-5 text-white shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium opacity-80">Taxa CongregaPay (10%)</span>
                <DollarSign className="w-5 h-5 opacity-60" />
              </div>
              <p className="text-2xl font-bold">{money.format(totals.fee)}</p>
              <p className="text-xs opacity-60 mt-1">receita da plataforma</p>
            </div>

            <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-white shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium opacity-80">Repasse (90%)</span>
                <ArrowDownRight className="w-5 h-5 opacity-60" />
              </div>
              <p className="text-2xl font-bold">{money.format(totals.net)}</p>
              <p className="text-xs opacity-60 mt-1">repassado aos tenants</p>
            </div>
          </div>

          {/* Taxa rate visual */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-700">Distribuição do Volume</span>
              <span className="text-xs text-slate-400">Bruto: {money.format(totals.gross)}</span>
            </div>
            <div className="h-3 rounded-full bg-slate-100 overflow-hidden flex">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all"
                style={{ width: totals.gross > 0 ? `${(totals.fee / totals.gross * 100).toFixed(1)}%` : '0%' }}
                title={`Taxa: ${(totals.fee / totals.gross * 100).toFixed(1)}%`}
              />
              <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 flex-1" title="Repasse" />
            </div>
            <div className="flex items-center gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Taxa 10%</span>
              <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" /> Repasse 90%</span>
            </div>
          </div>

          {/* Per-tenant breakdown */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              <span className="font-semibold text-slate-800 text-sm">Breakdown por Tenant</span>
              <span className="ml-auto text-xs text-slate-400">{summary.length} tenant{summary.length !== 1 ? 's' : ''}</span>
            </div>

            {summary.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">Sem pagamentos recebidos.</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {summary.map((r, i) => (
                  <div key={r.tenantId} className="px-5 py-4 hover:bg-slate-50 transition">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-slate-800 truncate max-w-[220px]">{r.tenantId}</p>
                          <p className="text-xs text-slate-400">{r.count} pagamento{r.count !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p className="text-sm font-bold text-amber-600">{money.format(r.fee)}</p>
                        <p className="text-xs text-slate-400">de {money.format(r.gross)}</p>
                      </div>
                    </div>
                    {/* Bar */}
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden ml-9">
                      <div
                        className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all"
                        style={{ width: `${Math.round((r.fee / maxFee) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Total footer */}
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Total Geral</span>
              <div className="text-right">
                <p className="text-sm font-bold text-amber-600">{money.format(totals.fee)} <span className="text-slate-400 font-normal text-xs">taxa</span></p>
                <p className="text-xs text-slate-400">{money.format(totals.gross)} bruto · {money.format(totals.net)} repasse</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
