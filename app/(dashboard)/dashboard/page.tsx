'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { PLAN_COLORS, PLANS, type PlanId } from '@/lib/plans'
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
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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

        const response = await fetch('/api/events', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (response.status === 401) {
          router.push('/login')
          return
        }

        const data = await response.json()
        if (!response.ok) {
          throw new Error(data?.error || 'Erro ao carregar dashboard')
        }

        const events = (data?.events || []) as EventLite[]

        const totalEvents = events.length
        const totalRegistrations = events.reduce(
          (sum, event) => sum + (event.registrations?.length || 0),
          0
        )

        const totalRevenue = events.reduce((sum, event) => {
          const received = (event.payments || []).filter((p) => p?.status === 'received')
          const eventRevenue = received.reduce((s, p) => s + Number(p?.value || 0), 0)
          return sum + eventRevenue
        }, 0)

        const recentEvents = events.slice(0, 5).map((event) => {
          const received = (event.payments || []).filter((p) => p?.status === 'received')
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
          availableBalance: totalRevenue,
          pendingWithdrawals: 0,
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
  }, [router])

  const handleWithdrawRequest = () => {
    if (withdrawAmount && parseFloat(withdrawAmount) > 0) {
      console.log('Solicitação de saque:', withdrawAmount)
      setShowWithdrawModal(false)
      setWithdrawAmount('')
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
          },
          {
            label: 'Saldo Disponível',
            value: isLoading ? '—' : moneyFormatter.format(stats.availableBalance),
            icon: DollarSign,
            iconBg: 'bg-amber-100',
            iconColor: 'text-amber-600',
            valueColor: 'text-amber-700',
          },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
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
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 shadow-sm p-5">
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
              <p className="text-sm text-slate-500">Digite o valor que deseja sacar</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
              <p className="text-xs text-slate-600 mb-1">Saldo Disponível</p>
              <p className="text-2xl font-bold text-emerald-700">{moneyFormatter.format(stats.availableBalance)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Valor a Sacar</label>
              <input
                type="number"
                placeholder="0,00"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                max={stats.availableBalance}
                step="0.01"
              />
            </div>
            <p className="text-xs text-slate-400">Processado em até 2 dias úteis.</p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowWithdrawModal(false); setWithdrawAmount('') }}
                className="flex-1 border border-slate-200 rounded-xl py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleWithdrawRequest}
                disabled={!withdrawAmount || parseFloat(withdrawAmount) === 0}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-medium transition-colors"
              >
                Confirmar Saque
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
