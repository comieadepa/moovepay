'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  TrendingUp,
  DollarSign,
  ArrowDownRight,
  CreditCard,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react'

type Totals = { gross: number; fee: number; net: number; count: number }
type Row = { tenantId: string; gross: number; fee: number; net: number; count: number }

type WithdrawalItem = {
  id: string
  tenantId: string
  userId: string
  amount: number
  pixKey: string
  pixKeyType: string
  status: 'pending' | 'completed' | 'rejected'
  notes?: string | null
  receiptUrl?: string | null
  createdAt: string
  processedAt?: string | null
  processedBy?: string | null
  tenant?: { id: string; name: string } | null
  user?: { id: string; name: string; email: string } | null
  processor?: { id: string; name: string; email: string } | null
}

export default function AdminFinancePage() {
  const [totals, setTotals] = useState<Totals | null>(null)
  const [summary, setSummary] = useState<Row[]>([])
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'rejected'>('all')
  const [error, setError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Modal de Processar / Rejeitar
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalItem | null>(null)
  const [modalAction, setModalAction] = useState<'complete' | 'reject' | null>(null)
  const [actionNotes, setActionNotes] = useState('')
  const [actionReceiptUrl, setActionReceiptUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const money = useMemo(() => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }), [])

  async function loadData() {
    try {
      setIsLoading(true)
      setError(null)

      const [resFinance, resWithdrawals] = await Promise.all([
        fetch('/api/admin/finance'),
        fetch('/api/withdrawals?admin=1'),
      ])

      const dataFinance = await resFinance.json()
      if (!resFinance.ok) throw new Error(dataFinance?.error || 'Erro ao carregar financeiro')

      const dataWithdrawals = await resWithdrawals.json().catch(() => null)

      setTotals(dataFinance?.totals || null)
      setSummary(dataFinance?.summary || [])
      setWithdrawals(dataWithdrawals?.withdrawals || [])
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar financeiro')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const maxFee = summary.length ? Math.max(...summary.map((r) => r.fee)) : 1

  const filteredWithdrawals = useMemo(() => {
    if (statusFilter === 'all') return withdrawals
    return withdrawals.filter((w) => w.status === statusFilter)
  }, [withdrawals, statusFilter])

  const pendingWithdrawalsCount = useMemo(() => {
    return withdrawals.filter((w) => w.status === 'pending').length
  }, [withdrawals])

  const copyPix = (key: string) => {
    navigator.clipboard.writeText(key)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const handleActionSubmit = async () => {
    if (!selectedWithdrawal || !modalAction) return

    if (modalAction === 'reject' && !actionNotes.trim()) {
      setModalError('Obrigatório informar o motivo da rejeição.')
      return
    }

    setIsSubmitting(true)
    setModalError(null)

    try {
      const res = await fetch(`/api/withdrawals/${selectedWithdrawal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: modalAction,
          notes: actionNotes.trim() || undefined,
          receiptUrl: actionReceiptUrl.trim() || undefined,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data?.error || 'Erro ao processar solicitação de saque.')
      }

      setActionSuccess(data?.message || 'Saque atualizado com sucesso!')
      setSelectedWithdrawal(null)
      setModalAction(null)
      setActionNotes('')
      setActionReceiptUrl('')

      loadData()

      setTimeout(() => setActionSuccess(null), 4000)
    } catch (err: any) {
      setModalError(err?.message || 'Falha ao processar saque.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Financeiro & Repasses</h1>
        <p className="text-slate-500 text-sm mt-1">
          Receitas transacionadas, taxa de 10% da plataforma e gestão de saques aos tenants
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm">{error}</div>
      )}

      {actionSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 text-sm font-medium">
          {actionSuccess}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400 text-sm">
          Carregando dados financeiros...
        </div>
      ) : !totals ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400 text-sm">
          Sem dados financeiros.
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 p-5 text-white shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium opacity-80">Pagamentos</span>
                <CreditCard className="w-5 h-5 opacity-60" />
              </div>
              <p className="text-3xl font-bold">{totals.count}</p>
              <p className="text-xs opacity-60 mt-1">transações confirmadas</p>
            </div>

            <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 p-5 text-white shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium opacity-80">Volume Bruto</span>
                <TrendingUp className="w-5 h-5 opacity-60" />
              </div>
              <p className="text-2xl font-bold">{money.format(totals.gross)}</p>
              <p className="text-xs opacity-60 mt-1">total arrecadado</p>
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
                <span className="text-sm font-medium opacity-80">Repasse Total (90%)</span>
                <ArrowDownRight className="w-5 h-5 opacity-60" />
              </div>
              <p className="text-2xl font-bold">{money.format(totals.net)}</p>
              <p className="text-xs opacity-60 mt-1">cota dos organizadores</p>
            </div>
          </div>

          {/* ── SEÇÃO DE GESTÃO DE SAQUES ── */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">Solicitações de Saque (Repasses)</h2>
                  {pendingWithdrawalsCount > 0 && (
                    <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                      {pendingWithdrawalsCount} pendente{pendingWithdrawalsCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Repasses solicitados pelos organizadores para pagamento manual via PIX
                </p>
              </div>

              {/* Filtro de Status */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-medium">
                {(['all', 'pending', 'completed', 'rejected'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      statusFilter === st
                        ? 'bg-white text-slate-900 shadow-sm font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st === 'all'
                      ? 'Todos'
                      : st === 'pending'
                      ? 'Pendentes'
                      : st === 'completed'
                      ? 'Concluídos'
                      : 'Rejeitados'}
                  </button>
                ))}
              </div>
            </div>

            {filteredWithdrawals.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                Nenhuma solicitação de saque encontrada para este filtro.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3.5">Organizador / Tenant</th>
                      <th className="px-6 py-3.5">Valor</th>
                      <th className="px-6 py-3.5">Chave PIX</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5">Data Solicitação</th>
                      <th className="px-6 py-3.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredWithdrawals.map((w) => {
                      const isPending = w.status === 'pending'
                      const isCompleted = w.status === 'completed'
                      const isRejected = w.status === 'rejected'

                      return (
                        <tr key={w.id} className="hover:bg-slate-50/70 transition">
                          <td className="px-6 py-4">
                            <p className="font-semibold text-slate-800">{w.tenant?.name || w.user?.name || w.tenantId}</p>
                            <p className="text-xs text-slate-400">{w.user?.email || w.userId}</p>
                          </td>

                          <td className="px-6 py-4 font-bold text-slate-900">
                            {money.format(w.amount)}
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-1 rounded">
                                {w.pixKey}
                              </span>
                              <button
                                onClick={() => copyPix(w.pixKey)}
                                title="Copiar Chave PIX"
                                className="p-1 text-slate-400 hover:text-slate-700 transition"
                              >
                                {copiedKey === w.pixKey ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            <span className="text-[10px] text-slate-400 uppercase font-semibold mt-0.5 block">
                              Tipo: {w.pixKeyType}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            {isPending && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                                <Clock className="w-3 h-3" /> Pendente
                              </span>
                            )}
                            {isCompleted && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                                <CheckCircle className="w-3 h-3" /> Pago
                              </span>
                            )}
                            {isRejected && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
                                <XCircle className="w-3 h-3" /> Rejeitado
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-4 text-xs text-slate-500">
                            {new Date(w.createdAt).toLocaleString('pt-BR', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                            {w.processedAt && (
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                <p>Processado: {new Date(w.processedAt).toLocaleDateString('pt-BR')}</p>
                                {w.processor && (
                                  <p className="text-slate-500 font-medium">Por: {w.processor.name || w.processor.email}</p>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="px-6 py-4 text-right">
                            {isPending ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedWithdrawal(w)
                                    setModalAction('complete')
                                    setActionNotes('')
                                    setActionReceiptUrl('')
                                    setModalError(null)
                                  }}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition"
                                >
                                  Processar
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedWithdrawal(w)
                                    setModalAction('reject')
                                    setActionNotes('')
                                    setActionReceiptUrl('')
                                    setModalError(null)
                                  }}
                                  className="px-3 py-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold transition"
                                >
                                  Rejeitar
                                </button>
                              </div>
                            ) : (
                              <div className="text-xs text-slate-400">
                                {w.notes && <p className="truncate max-w-[180px] italic">"{w.notes}"</p>}
                                {w.receiptUrl && (
                                  <a
                                    href={w.receiptUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-600 hover:underline inline-flex items-center gap-1 mt-0.5"
                                  >
                                    Comprovante <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Breakdown por Tenant */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              <span className="font-semibold text-slate-800 text-sm">Volume Arrecadado por Tenant</span>
              <span className="ml-auto text-xs text-slate-400">
                {summary.length} tenant{summary.length !== 1 ? 's' : ''}
              </span>
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
          </div>
        </>
      )}

      {/* ── MODAL ADMIN: PROCESSAR OU REJEITAR SAQUE ── */}
      {selectedWithdrawal && modalAction && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {modalAction === 'complete' ? 'Registrar Repasse Manual' : 'Rejeitar Solicitação de Saque'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {modalAction === 'complete'
                  ? 'Confirme que você realizou a transferência PIX para a conta do organizador.'
                  : 'O valor bloqueado voltará automaticamente para o saldo disponível do organizador.'}
              </p>
            </div>

            {modalError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
                {modalError}
              </div>
            )}

            {/* Resumo do Saque */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Organizador:</span>
                <span className="font-semibold text-slate-800">
                  {selectedWithdrawal.tenant?.name || selectedWithdrawal.user?.name || selectedWithdrawal.tenantId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Valor a Transferir:</span>
                <span className="font-bold text-slate-900 text-sm">{money.format(selectedWithdrawal.amount)}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                <span className="text-slate-500">Chave PIX ({selectedWithdrawal.pixKeyType}):</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono font-semibold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {selectedWithdrawal.pixKey}
                  </span>
                  <button
                    onClick={() => copyPix(selectedWithdrawal.pixKey)}
                    className="p-1 text-slate-400 hover:text-slate-700"
                    title="Copiar"
                  >
                    {copiedKey === selectedWithdrawal.pixKey ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {modalAction === 'complete' && (
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  URL do Comprovante (opcional)
                </label>
                <input
                  type="url"
                  placeholder="https://exemplo.com/comprovante.pdf"
                  value={actionReceiptUrl}
                  onChange={(e) => setActionReceiptUrl(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                {modalAction === 'complete' ? 'Observações / Código da Transação (opcional)' : 'Motivo da Rejeição (obrigatório)'}
              </label>
              <textarea
                rows={3}
                placeholder={
                  modalAction === 'complete'
                    ? 'Ex.: Transferido via Nubank às 14h, código E2026...'
                    : 'Ex.: Chave PIX informada não pertence ao titular do evento.'
                }
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedWithdrawal(null)
                  setModalAction(null)
                }}
                disabled={isSubmitting}
                className="flex-1 border border-slate-200 rounded-xl py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleActionSubmit}
                disabled={isSubmitting || (modalAction === 'reject' && !actionNotes.trim())}
                className={`flex-1 rounded-xl py-2.5 text-xs font-semibold text-white transition disabled:opacity-50 ${
                  modalAction === 'complete'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isSubmitting
                  ? 'Processando...'
                  : modalAction === 'complete'
                  ? 'Confirmar Repasse Realizado'
                  : 'Rejeitar e Liberar Saldo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
