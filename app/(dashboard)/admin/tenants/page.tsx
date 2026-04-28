'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PLAN_COLORS, PLAN_ORDER, PLANS, type PlanId } from '@/lib/plans'
import { Building2, Trash2, AlertTriangle, X, ChevronDown, CheckCircle2 } from 'lucide-react'

type Tenant = {
  id: string
  name: string
  planId: string | null
  createdAt: string
  ownerEmail: string | null
}

type DeleteModal = {
  tenant: Tenant
  eventCount: number | null
  loading: boolean
}

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [changingId, setChangingId] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [deleteModal, setDeleteModal] = useState<DeleteModal | null>(null)
  const [deleting, setDeleting] = useState(false)

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
      setTenants((prev) => prev.map((t) => (t.id === tenantId ? { ...t, planId } : t)))
      setSuccessMsg('Plano atualizado com sucesso.')
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setChangingId(null)
    }
  }

  async function openDeleteModal(tenant: Tenant) {
    setDeleteModal({ tenant, eventCount: null, loading: true })
    try {
      const res = await fetch(`/api/admin/events?tenantId=${encodeURIComponent(tenant.id)}`)
      const data = await res.json()
      const count = typeof data?.count === 'number' ? data.count : 0
      setDeleteModal((prev) => prev ? { ...prev, eventCount: count, loading: false } : null)
    } catch {
      setDeleteModal((prev) => prev ? { ...prev, eventCount: 0, loading: false } : null)
    }
  }

  async function confirmDelete() {
    if (!deleteModal) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/tenants?tenantId=${encodeURIComponent(deleteModal.tenant.id)}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Erro ao deletar tenant')
      setTenants((prev) => prev.filter((t) => t.id !== deleteModal.tenant.id))
      setDeleteModal(null)
      setSuccessMsg(`Tenant "${deleteModal.tenant.name}" e seus eventos foram removidos.`)
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Tenants</h1>
          <p className="text-slate-500 text-sm mt-1">Contas cadastradas e seus planos</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-sm">
          <Building2 className="w-4 h-4" />
          {tenants.length} tenant{tenants.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Success */}
      {successMsg && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {successMsg}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm">{error}</div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400 text-sm">Carregando...</div>
      ) : tenants.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400 text-sm">Nenhum tenant encontrado.</div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left">
                <th className="px-5 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Tenant</th>
                <th className="px-5 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Plano</th>
                <th className="px-5 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Taxa</th>
                <th className="px-5 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Mensalidade</th>
                <th className="px-5 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Criado em</th>
                <th className="px-5 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Alterar plano</th>
                <th className="px-5 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tenants.map((t) => {
                const planId = (t.planId || 'essencial') as PlanId
                const plan = PLANS[planId] ?? PLANS.essencial
                const colorClass = PLAN_COLORS[planId] ?? PLAN_COLORS.essencial
                return (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4 text-violet-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{t.name}</div>
                          <div className="text-xs text-slate-400 truncate max-w-[200px]">{t.ownerEmail ?? t.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${colorClass}`}>
                        {plan.name}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-700 tabular-nums font-medium">
                      {plan.feePercent > 0 ? `${plan.feePercent}%` : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-5 py-4 text-slate-700 tabular-nums">
                      {plan.monthlyPrice > 0
                        ? plan.monthlyPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-5 py-4 text-slate-500 text-xs">
                      {format(new Date(t.createdAt), 'dd MMM yyyy', { locale: ptBR })}
                    </td>
                    <td className="px-5 py-4">
                      <div className="relative inline-block">
                        <select
                          value={planId}
                          disabled={changingId === t.id}
                          onChange={(e) => handlePlanChange(t.id, e.target.value as PlanId)}
                          className="text-sm border border-slate-200 rounded-lg pl-3 pr-8 py-1.5 bg-white disabled:opacity-50 cursor-pointer appearance-none hover:border-slate-300 transition focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {PLAN_ORDER.map((p) => (
                            <option key={p} value={p}>{PLANS[p].name}</option>
                          ))}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => openDeleteModal(t)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition font-medium"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Deletar
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900">Deletar Tenant</h2>
                  <p className="text-xs text-slate-500">Ação irreversível</p>
                </div>
              </div>
              <button
                onClick={() => setDeleteModal(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-700">
                Você está prestes a deletar permanentemente o tenant:
              </p>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="font-semibold text-slate-900">{deleteModal.tenant.name}</p>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{deleteModal.tenant.id}</p>
              </div>

              {deleteModal.loading ? (
                <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  Verificando eventos vinculados...
                </div>
              ) : (
                <div className={`rounded-xl border px-4 py-3 text-sm ${(deleteModal.eventCount ?? 0) > 0 ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                  {(deleteModal.eventCount ?? 0) > 0 ? (
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        Este tenant possui <strong>{deleteModal.eventCount} evento{(deleteModal.eventCount ?? 0) !== 1 ? 's' : ''}</strong> que também serão deletados junto com todas as inscrições e pagamentos associados.
                      </span>
                    </div>
                  ) : (
                    <span>Nenhum evento vinculado a este tenant.</span>
                  )}
                </div>
              )}

              <p className="text-xs text-slate-500">
                Esta ação não pode ser desfeita. Todos os dados do tenant, eventos e inscrições serão removidos permanentemente.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 p-5 border-t border-slate-100">
              <button
                onClick={() => setDeleteModal(null)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting || deleteModal.loading}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Deletando...' : 'Confirmar Deleção'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
