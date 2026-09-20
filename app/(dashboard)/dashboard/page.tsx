'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowUpRight,
  Calendar,
  DollarSign,
  MessageCircle,
  BarChart3,
  Plus,
  Settings,
  TrendingUp,
  Users,
  Zap,
  ChevronRight,
} from 'lucide-react'
import { PLANS, type PlanId } from '@/lib/plans'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type PaymentLite = {
  value: number | string | null
  status: string | null
}

type EventLite = {
  id: string
  name: string
  status: string
  startDate?: string | null
  createdAt?: string | null
  registrations?: { id: string }[]
  payments?: PaymentLite[]
  inscriptionTypes?: { value: number }[]
}

type DashboardStats = {
  totalEvents: number
  totalRegistrations: number
  totalRevenue: number
  availableBalance: number
  pendingWithdrawals: number
  recentEvents: Array<{
    id: string
    name: string
    status: string
    date: string
    registrations: number
    revenue: number
  }>
}

export default function DashboardPage() {
  const router = useRouter()
  const [userData, setUserData] = useState<any>(null)
  const [tenantPlanId, setTenantPlanId] = useState<string | null>(null)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [pixKeyType, setPixKeyType] = useState<'cpf' | 'cnpj' | 'email' | 'phone' | 'random'>('cpf')
  const [pixKey, setPixKey] = useState('')
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false)
  const [withdrawError, setWithdrawError] = useState<string | null>(null)
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasPaidEvents, setHasPaidEvents] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [myWithdrawals, setMyWithdrawals] = useState<any[]>([])

  const [stats, setStats] = useState<DashboardStats>({
    totalEvents: 0,
    totalRegistrations: 0,
    totalRevenue: 0,
    availableBalance: 0,
    pendingWithdrawals: 0,
    recentEvents: [],
  })

  const moneyFormatter = useMemo(() => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }, [])

  useEffect(() => {
    let active = true

    const raw = localStorage.getItem('user')
    if (raw) {
      try {
        setUserData(JSON.parse(raw))
        return
      } catch {
        // ignora
      }
    }

    // Fallback: carrega do servidor (ex.: primeiro acesso após OAuth)
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active) return
        const u = data?.user
        if (!u) return
        localStorage.setItem(
          'user',
          JSON.stringify({
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role || 'user',
            defaultTenantId: u.defaultTenantId || u.id,
          })
        )
        setUserData(u)
        // Busca plano do tenant
        const tenantId = u.defaultTenantId || u.id
        if (tenantId) {
          fetch(`/api/tenant/plan?tenantId=${tenantId}`, { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => { if (d?.planId) setTenantPlanId(d.planId) })
            .catch(() => {})
        }
      })
      .catch(() => {
        // ignora
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadDashboard() {
      try {
        setIsLoading(true)
        setError(null)

        const [eventsRes, withdrawalsRes] = await Promise.all([
          fetch('/api/events', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }),
          fetch('/api/withdrawals', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }).catch(() => null),
        ])

        if (eventsRes.status === 401) {
          router.push('/login')
          return
        }

        const data = await eventsRes.json()
        if (!eventsRes.ok) {
          if (eventsRes.status === 403) {
            if (isMounted) setIsLoading(false)
            return
          }
          throw new Error(data?.error || 'Erro ao carregar dashboard')
        }

        const events = (data?.events || []) as EventLite[]

        let pendingWithdrawals = 0
        let completedWithdrawals = 0
        if (withdrawalsRes && withdrawalsRes.ok) {
          const wData = await withdrawalsRes.json().catch(() => null)
          if (wData?.totals) {
            pendingWithdrawals = Number(wData.totals.pending || 0)
            completedWithdrawals = Number(wData.totals.completed || 0)
          }
          if (Array.isArray(wData?.withdrawals)) {
            setMyWithdrawals(wData.withdrawals)
          }
        }

        // Verifica se existe ao menos 1 evento pago (não gratuito)
        const paidExists = events.some((e) =>
          (e.inscriptionTypes || []).some((t) => t.value > 0)
        )
        if (isMounted) setHasPaidEvents(paidExists)

        const totalEvents = events.length
        const totalRegistrations = events.reduce(
          (sum, event) => sum + (event.registrations?.length || 0),
          0
        )

        const totalRevenue = events.reduce((sum, event) => {
          const received = (event.payments || []).filter((p) => p?.status === 'paid' || p?.status === 'received')
          const eventRevenue = received.reduce((s, p) => s + Number(p?.value || 0), 0)
          return sum + eventRevenue
        }, 0)

        // Saldo disponível: 90% dos eventos pagos (10% de taxa) e 100% dos eventos gratuitos,
        // subtraindo saques já solicitados (pendentes) ou já pagos (concluídos).
        const totalNetRevenue = events.reduce((sum, event) => {
          const isPaidEvent = (event.inscriptionTypes || []).some((t) => Number(t?.value || 0) > 0)
          const received = (event.payments || []).filter((p) => p?.status === 'paid' || p?.status === 'received')
          const eventGross = received.reduce((s, p) => s + Number(p?.value || 0), 0)
          const netShare = isPaidEvent ? eventGross * 0.9 : eventGross
          return sum + netShare
        }, 0)

        const availableBalance = Math.max(0, totalNetRevenue - (pendingWithdrawals + completedWithdrawals))

        const recentEvents = events.slice(0, 5).map((event) => {
          const received = (event.payments || []).filter((p) => p?.status === 'paid' || p?.status === 'received')
          const revenue = received.reduce((s, p) => s + Number(p?.value || 0), 0)

          const baseDate = event.startDate || event.createdAt
          const date = baseDate
            ? format(new Date(baseDate), 'dd MMM yyyy', { locale: ptBR })
            : ''

          return {
            id: event.id,
            name: event.name,
            status: event.status,
            date,
            registrations: event.registrations?.length || 0,
            revenue,
          }
        })

        if (!isMounted) return

        setStats({
          totalEvents,
          totalRegistrations,
          totalRevenue,
          availableBalance,
          pendingWithdrawals,
          recentEvents,
        })
      } catch (e: any) {
        if (!isMounted) return
        setError(e?.message || 'Erro ao carregar dashboard')
      } finally {
        if (!isMounted) return
        setIsLoading(false)
      }
    }

    loadDashboard()

    return () => {
      isMounted = false
    }
  }, [router, refreshTrigger])

  const handleWithdrawRequest = async () => {
    const numAmount = parseFloat(withdrawAmount)
    if (isNaN(numAmount) || numAmount <= 0) {
      setWithdrawError('Informe um valor válido maior que zero.')
      return
    }

    if (numAmount > stats.availableBalance) {
      setWithdrawError('Valor superior ao saldo disponível.')
      return
    }

    if (!pixKey.trim()) {
      setWithdrawError('Informe a chave PIX para repasse.')
      return
    }

    setWithdrawSubmitting(true)
    setWithdrawError(null)
    setWithdrawSuccess(null)

    try {
      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: numAmount,
          pixKey: pixKey.trim(),
          pixKeyType,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data?.error || 'Erro ao solicitar saque.')
      }

      setWithdrawSuccess('Solicitação de saque enviada com sucesso! Em análise.')
      setRefreshTrigger((prev) => prev + 1)

      setTimeout(() => {
        setShowWithdrawModal(false)
        setWithdrawAmount('')
        setPixKey('')
        setWithdrawSuccess(null)
      }, 2000)
    } catch (err: any) {
      setWithdrawError(err?.message || 'Falha ao processar solicitação de saque.')
    } finally {
      setWithdrawSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">

      {/* ── HEADER BOAS-VINDAS ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 p-8 text-white shadow-lg">
        <div className="relative z-10">
          <p className="text-blue-200 text-sm font-medium mb-1">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">
            Olá, {userData?.name?.split(' ')[0] || 'Usuário'} 👋
          </h1>
          <p className="text-blue-100 text-sm max-w-md">
            Seu painel de controle — gerencie eventos, inscrições e finanças em um só lugar.
          </p>
          {tenantPlanId && (() => {
            const pid = tenantPlanId as PlanId
            const plan = PLANS[pid] ?? PLANS.essencial
            return (
              <span className="mt-4 inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full border border-white/30">
                <Zap className="w-3 h-3" />
                Plano {plan.name}
                {plan.feePercent > 0 ? ` · ${plan.feePercent}% por inscrição` : ''}
              </span>
            )
          })()}
        </div>
        {/* Decoração */}
        <div className="absolute -right-8 -top-8 w-48 h-48 rounded-full bg-white/5" />
        <div className="absolute -right-4 -bottom-12 w-64 h-64 rounded-full bg-white/5" />
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Total de Eventos',
            value: isLoading ? '—' : stats.totalEvents,
            icon: Calendar,
            iconBg: 'bg-blue-100',
            iconColor: 'text-blue-600',
            valueColor: 'text-slate-900',
          },
          {
            label: 'Total de Inscrições',
            value: isLoading ? '—' : stats.totalRegistrations,
            icon: Users,
            iconBg: 'bg-violet-100',
            iconColor: 'text-violet-600',
            valueColor: 'text-violet-700',
          },
          {
            label: 'Receita Confirmada',
            value: isLoading ? '—' : moneyFormatter.format(stats.totalRevenue),
            icon: TrendingUp,
            iconBg: 'bg-emerald-100',
            iconColor: 'text-emerald-600',
            valueColor: 'text-emerald-700',
            locked: !hasPaidEvents,
          },
          {
            label: 'Saldo Disponível',
            value: isLoading ? '—' : moneyFormatter.format(stats.availableBalance),
            icon: DollarSign,
            iconBg: 'bg-amber-100',
            iconColor: 'text-amber-600',
            valueColor: 'text-amber-700',
            locked: !hasPaidEvents,
          },
        ].map((kpi) => (
          <div key={kpi.label} className={`relative bg-white rounded-2xl border shadow-sm p-5 flex flex-col gap-3 transition-shadow ${
            kpi.locked ? 'border-slate-200 opacity-60 select-none' : 'border-slate-100 hover:shadow-md'
          }`}>
            {kpi.locked && (
              <div className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center bg-white/80 backdrop-blur-[2px] z-10">
                <svg className="w-5 h-5 text-slate-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <p className="text-xs text-slate-400 font-medium text-center px-3">Disponível após criar um evento pago</p>
              </div>
            )}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${kpi.iconBg}`}>
              <kpi.icon className={`w-5 h-5 ${kpi.iconColor}`} />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">{kpi.label}</p>
              <p className={`text-2xl font-bold ${kpi.valueColor}`}>{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── AÇÕES RÁPIDAS ── */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Link href="/eventos/novo" className="group">
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-xs font-medium mb-0.5">Começar agora</p>
              <p className="font-bold text-lg">Criar Evento</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Plus className="w-5 h-5" />
            </div>
          </div>
        </Link>

        <Link href="/eventos" className="group">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-xs font-medium mb-0.5">Gerencie</p>
              <p className="font-bold text-lg">Meus Eventos</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
        </Link>

        <Link href="/suporte" className="group">
          <div className="bg-gradient-to-br from-slate-600 to-slate-700 rounded-2xl p-5 text-white shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer flex items-center justify-between">
            <div>
              <p className="text-slate-300 text-xs font-medium mb-0.5">Atendimento</p>
              <p className="font-bold text-lg">Suporte</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </div>
          </div>
        </Link>
      </div>

      {/* ── EVENTOS RECENTES + PERFIL ── */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Eventos recentes */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <h2 className="font-semibold text-slate-900">Eventos Recentes</h2>
              <p className="text-xs text-slate-500">Últimos {Math.min(stats.recentEvents.length, 5)} criados</p>
            </div>
            <Link href="/eventos" className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium">
              Ver todos <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {isLoading ? (
            <div className="p-10 text-center text-slate-400 text-sm">Carregando...</div>
          ) : stats.recentEvents.length === 0 ? (
            <div className="p-10 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-500 text-sm mb-4">Nenhum evento criado ainda</p>
              <Link href="/eventos/novo">
                <button className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
                  Criar meu primeiro evento
                </button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {stats.recentEvents.map((event: any) => (
                <div key={event.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${event.status === 'published' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">{event.name}</p>
                      <p className="text-xs text-slate-500">{event.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 flex-shrink-0 ml-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-slate-500">Inscrições</p>
                      <p className="font-semibold text-slate-900">{event.registrations}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Receita</p>
                      <p className="font-semibold text-emerald-600">{moneyFormatter.format(event.revenue)}</p>
                    </div>
                    <Link href={`/eventos/${event.id}`}>
                      <button className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-blue-100 hover:text-blue-600 flex items-center justify-center transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── HISTÓRICO DE SAQUES DO TENANT ── */}
        {myWithdrawals.length > 0 && (
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="font-semibold text-slate-900">Histórico de Saques</h2>
                <p className="text-xs text-slate-500">Acompanhe o status dos seus repasses</p>
              </div>
              <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                {myWithdrawals.length} solicitação{myWithdrawals.length !== 1 ? 'ões' : ''}
              </span>
            </div>

            <div className="divide-y divide-slate-100 overflow-x-auto">
              {myWithdrawals.map((w) => {
                const isPending = w.status === 'pending'
                const isCompleted = w.status === 'completed'
                const isRejected = w.status === 'rejected'

                return (
                  <div key={w.id} className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900 text-base">{moneyFormatter.format(w.amount)}</p>
                        {isPending && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                            Em análise
                          </span>
                        )}
                        {isCompleted && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                            Pago
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
                            Rejeitado
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 font-mono">
                        PIX: <span className="font-medium text-slate-700">{w.pixKey}</span> ({w.pixKeyType})
                      </p>
                      {isRejected && w.notes && (
                        <p className="text-xs text-rose-600 mt-1 bg-rose-50 p-2 rounded-lg border border-rose-100">
                          Motivo da rejeição: <span className="font-medium">{w.notes}</span>
                        </p>
                      )}
                      {isCompleted && w.notes && (
                        <p className="text-xs text-slate-500 mt-1 italic">
                          Obs: {w.notes}
                        </p>
                      )}
                    </div>

                    <div className="text-left sm:text-right text-xs text-slate-400 shrink-0">
                      <p>
                        {new Date(w.createdAt).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                      {w.receiptUrl && (
                        <a
                          href={w.receiptUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline font-semibold inline-block mt-1"
                        >
                          Ver Comprovante ↗
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Sidebar: Perfil + Financeiro */}
        <div className="space-y-4">

          {/* Perfil */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                {(userData?.name || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate">{userData?.name || 'Usuário'}</p>
                <p className="text-xs text-slate-500 truncate">{userData?.email || ''}</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/perfil')}
              className="w-full flex items-center justify-center gap-2 text-sm border border-slate-200 rounded-xl py-2 hover:bg-slate-50 transition-colors text-slate-700 font-medium"
            >
              <Settings className="w-4 h-4" />
              Editar Perfil
            </button>
          </div>

          {/* Financeiro */}
          <div className={`relative bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border shadow-sm p-5 ${
            !hasPaidEvents ? 'border-slate-200 opacity-60 select-none' : 'border-emerald-100'
          }`}>
            {!hasPaidEvents && (
              <div className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center bg-white/80 backdrop-blur-[2px] z-10">
                <svg className="w-5 h-5 text-slate-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <p className="text-xs text-slate-400 font-medium text-center px-4">Disponível após criar um evento pago</p>
              </div>
            )}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-white" />
              </div>
              <p className="font-semibold text-slate-900 text-sm">Financeiro</p>
            </div>
            <p className="text-2xl font-bold text-emerald-700 mb-1">
              {isLoading ? '—' : moneyFormatter.format(stats.availableBalance)}
            </p>
            <p className="text-xs text-slate-500 mb-4">Saldo disponível</p>
            <button
              onClick={() => setShowWithdrawModal(true)}
              disabled={isLoading || stats.availableBalance === 0}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-medium rounded-xl py-2.5 transition-colors"
            >
              <ArrowUpRight className="w-4 h-4" />
              Solicitar Saque
            </button>
          </div>

          {/* Relatórios */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-violet-600" />
              </div>
              <p className="font-semibold text-slate-900 text-sm">Relatórios</p>
            </div>
            <p className="text-xs text-slate-500 mb-3">Dados detalhados dos seus eventos</p>
            <button className="w-full text-sm border border-slate-200 rounded-xl py-2 hover:bg-slate-50 transition-colors text-slate-700 font-medium">
              Em breve
            </button>
          </div>
        </div>
      </div>

      {/* ── MODAL SAQUE ── */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Solicitar Saque</h2>
              <p className="text-sm text-slate-500">Informe o valor e seus dados PIX para repasse</p>
            </div>

            {withdrawError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
                {withdrawError}
              </div>
            )}

            {withdrawSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium">
                {withdrawSuccess}
              </div>
            )}

            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
              <p className="text-xs text-slate-600 mb-1">Saldo Disponível para Saque</p>
              <p className="text-2xl font-bold text-emerald-700">{moneyFormatter.format(stats.availableBalance)}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Valor a Sacar (R$)</label>
              <input
                type="number"
                placeholder="0,00"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                disabled={withdrawSubmitting || !!withdrawSuccess}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                max={stats.availableBalance}
                step="0.01"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Tipo de Chave PIX</label>
              <select
                value={pixKeyType}
                onChange={(e) => setPixKeyType(e.target.value as any)}
                disabled={withdrawSubmitting || !!withdrawSuccess}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm bg-white"
              >
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
                <option value="email">E-mail</option>
                <option value="phone">Celular / Telefone</option>
                <option value="random">Chave Aleatória (EVP)</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Chave PIX de Destino</label>
              <input
                type="text"
                placeholder={
                  pixKeyType === 'cpf'
                    ? '000.000.000-00'
                    : pixKeyType === 'cnpj'
                    ? '00.000.000/0000-00'
                    : pixKeyType === 'email'
                    ? 'seuemail@exemplo.com'
                    : pixKeyType === 'phone'
                    ? '(99) 99999-9999'
                    : 'Cole sua chave aleatória'
                }
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                disabled={withdrawSubmitting || !!withdrawSuccess}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-mono"
              />
            </div>

            <p className="text-xs text-slate-400">
              Transferência manual realizada pela plataforma em até 2 dias úteis.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  if (withdrawSubmitting) return
                  setShowWithdrawModal(false)
                  setWithdrawAmount('')
                  setPixKey('')
                  setWithdrawError(null)
                  setWithdrawSuccess(null)
                }}
                disabled={withdrawSubmitting}
                className="flex-1 border border-slate-200 rounded-xl py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleWithdrawRequest}
                disabled={
                  withdrawSubmitting ||
                  !!withdrawSuccess ||
                  !withdrawAmount ||
                  parseFloat(withdrawAmount) <= 0 ||
                  !pixKey.trim()
                }
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-medium transition-colors"
              >
                {withdrawSubmitting ? 'Enviando...' : 'Confirmar Saque'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
