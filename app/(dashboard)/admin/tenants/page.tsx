'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PLAN_COLORS, PLAN_ORDER, PLANS, type PlanId } from '@/lib/plans'

type Tenant = {
  id: string
  name: string
  planId: string | null
  createdAt: string
}

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [changingId, setChangingId] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        setIsLoading(true)
        setError(null)
        const res = await fetch('/api/admin/tenants')
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Erro ao carregar tenants')
        if (!mounted) return
        setTenants(data?.tenants || [])
      } catch (e: any) {
        if (!mounted) return
        setError(e?.message || 'Erro ao carregar tenants')
      } finally {
        if (!mounted) return
        setIsLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  async function handlePlanChange(tenantId: string, planId: PlanId) {
    setChangingId(tenantId)
    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, planId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Erro ao atualizar plano')
      setTenants((prev) =>
        prev.map((t) => (t.id === tenantId ? { ...t, planId } : t))
      )
      setSuccessMsg('Plano atualizado com sucesso.')
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setChangingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Tenants</h1>
        <p className="text-slate-600">Contas cadastradas e seus planos</p>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md text-sm">
          {successMsg}
        </div>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 text-red-700">{error}</CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card><CardContent className="pt-6 text-slate-500">Carregando...</CardContent></Card>
      ) : tenants.length === 0 ? (
        <Card><CardContent className="pt-6 text-slate-500">Nenhum tenant encontrado.</CardContent></Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border rounded-lg overflow-hidden bg-white shadow-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left">
                <th className="px-4 py-3 font-medium text-slate-600">Nome</th>
                <th className="px-4 py-3 font-medium text-slate-600">Plano atual</th>
                <th className="px-4 py-3 font-medium text-slate-600">Taxa</th>
                <th className="px-4 py-3 font-medium text-slate-600">Mensalidade</th>
                <th className="px-4 py-3 font-medium text-slate-600">Criado em</th>
                <th className="px-4 py-3 font-medium text-slate-600">Alterar plano</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => {
                const planId = (t.planId || 'essencial') as PlanId
                const plan = PLANS[planId] ?? PLANS.essencial
                const colorClass = PLAN_COLORS[planId] ?? PLAN_COLORS.essencial
                return (
                  <tr key={t.id} className="border-b hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{t.name}</div>
                      <div className="text-xs text-slate-400 font-mono">{t.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${colorClass}`}>
                        {plan.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 tabular-nums">
                      {plan.feePercent > 0 ? `${plan.feePercent}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-700 tabular-nums">
                      {plan.monthlyPrice > 0
                        ? plan.monthlyPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {format(new Date(t.createdAt), 'dd/MM/yyyy', { locale: ptBR })}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={planId}
                        disabled={changingId === t.id}
                        onChange={(e) => handlePlanChange(t.id, e.target.value as PlanId)}
                        className="text-sm border rounded-md px-2 py-1.5 bg-white disabled:opacity-50 cursor-pointer"
                      >
                        {PLAN_ORDER.map((p) => (
                          <option key={p} value={p}>
                            {PLANS[p].name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="text-xs text-slate-500 mt-2 px-1">
            {tenants.length} tenant(s) registrado(s)
          </p>
        </div>
      )}
    </div>
  )
}
