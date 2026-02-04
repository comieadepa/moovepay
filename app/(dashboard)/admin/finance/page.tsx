'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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
    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Financeiro (Admin)</h1>
        <p className="text-slate-600">Resumo de recebidos e taxa de 10%</p>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 text-red-700">{error}</CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card><CardContent className="pt-6 text-slate-500">Carregando...</CardContent></Card>
      ) : !totals ? (
        <Card><CardContent className="pt-6 text-slate-500">Sem dados.</CardContent></Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Total recebido</CardTitle></CardHeader>
              <CardContent className="text-2xl font-bold">{money.format(totals.gross)}</CardContent>
            </Card>
            <Card className="border-amber-200">
              <CardHeader className="pb-2"><CardTitle className="text-base">Taxa (10%)</CardTitle></CardHeader>
              <CardContent className="text-2xl font-bold text-amber-700">{money.format(totals.fee)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Repasse (90%)</CardTitle></CardHeader>
              <CardContent className="text-2xl font-bold text-emerald-700">{money.format(totals.net)}</CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Por tenant</CardTitle>
              <CardDescription>Ordenado por maior taxa</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {summary.length === 0 ? (
                <p className="text-slate-500">Sem pagamentos recebidos.</p>
              ) : (
                summary.map((r) => (
                  <div key={r.tenantId} className="flex items-center justify-between border rounded-md px-3 py-2">
                    <div className="text-sm text-slate-700">Tenant {r.tenantId}</div>
                    <div className="text-sm font-semibold">{money.format(r.fee)}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
