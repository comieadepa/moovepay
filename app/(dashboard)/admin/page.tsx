'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  Building2,
  HeadphonesIcon,
  DollarSign,
  Users,
  TrendingUp,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronRight,
  ArrowUpRight,
} from 'lucide-react'

type FinanceTotals = { gross: number; fee: number; net: number; count: number }
type FinanceSummary = { tenantId: string; gross: number; fee: number; net: number; count: number }
type EventItem = { id: string; slug: string; name: string; startDate: string; location: string; minPrice: number }
type TicketStats = { awaitingSupport: number; unassigned: number; assignedToMe: number; resolvedToday: number }

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AdminHomePage() {
  const [role, setRole] = useState<string>('user')
  const [finance, setFinance] = useState<{ totals: FinanceTotals; summary: FinanceSummary[] } | null>(null)
  const [events, setEvents] = useState<EventItem[]>([])
  const [totalEvents, setTotalEvents] = useState<number | null>(null)
  const [tickets, setTickets] = useState<TicketStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const meRes = await fetch('/api/auth/me', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null)
      const userRole = String(meRes?.user?.role || 'user')
      setRole(userRole)

      const isAdmin = userRole === 'admin'
      const canFinance = isAdmin || userRole === 'finance'
      const canSupport = isAdmin || userRole === 'support'

      const [eventsRes, eventsTotal, financeRes, ticketsRes] = await Promise.all([
        fetch('/api/eventos?open=1&limit=5').then(r => r.ok ? r.json() : null),
        isAdmin ? fetch('/api/admin/events', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null) : Promise.resolve(null),
        canFinance ? fetch('/api/admin/finance', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null) : Promise.resolve(null),
        canSupport ? fetch('/api/admin/tickets/stats', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null) : Promise.resolve(null),
      ])

      if (eventsRes?.events) setEvents(eventsRes.events)
      if (typeof eventsTotal?.total === 'number') setTotalEvents(eventsTotal.total)
      if (financeRes?.totals) setFinance(financeRes)
      if (ticketsRes) setTickets(ticketsRes)
      setLoading(false)
    }
    load()
  }, [])

  const canSupport = role === 'admin' || role === 'support'
  const canFinance = role === 'admin' || role === 'finance'
  const canAdmin = role === 'admin'

  const maxFee = finance?.summary?.length ? Math.max(...finance.summary.map(s => s.fee)) : 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard Admin</h1>
          <p className="text-slate-500 text-sm mt-1">Visão geral do sistema · {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {canFinance && (
          <>
            <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 text-white shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium opacity-90">Volume Bruto</span>
                <TrendingUp className="w-5 h-5 opacity-80" />
              </div>
              <p className="text-2xl font-bold">{loading ? '—' : fmt(finance?.totals.gross ?? 0)}</p>
              <p className="text-xs opacity-75 mt-1">{finance?.totals.count ?? 0} pagamentos</p>
            </div>

            <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 p-4 text-white shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium opacity-90">Taxa CongregaPay</span>
                <DollarSign className="w-5 h-5 opacity-80" />
              </div>
              <p className="text-2xl font-bold">{loading ? '—' : fmt(finance?.totals.fee ?? 0)}</p>
              <p className="text-xs opacity-75 mt-1">10% sobre volume</p>
            </div>
          </>
        )}

        <div className="rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 p-4 text-white shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium opacity-90">Total de Eventos</span>
            <Calendar className="w-5 h-5 opacity-80" />
          </div>
          <p className="text-2xl font-bold">{loading ? '—' : (totalEvents ?? events.length)}</p>
          <p className="text-xs opacity-75 mt-1">{events.length} com inscrições abertas</p>
        </div>

        {canSupport && (
          <div className="rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 p-4 text-white shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium opacity-90">Tickets Pendentes</span>
              <AlertCircle className="w-5 h-5 opacity-80" />
            </div>
            <p className="text-2xl font-bold">{loading ? '—' : (tickets?.awaitingSupport ?? 0)}</p>
            <p className="text-xs opacity-75 mt-1">{tickets?.unassigned ?? 0} sem atribuição</p>
          </div>
        )}
      </div>

      {/* Middle Section */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Próximos Eventos */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-500" />
              <span className="font-semibold text-slate-800 text-sm">Próximos Eventos</span>
            </div>
            <Link href="/dashboard/eventos" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              Ver todos <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {loading ? (
              <div className="p-5 text-sm text-slate-400">Carregando...</div>
            ) : events.length === 0 ? (
              <div className="p-5 text-sm text-slate-400">Nenhum evento aberto</div>
            ) : events.map(ev => (
              <Link key={ev.id} href={`/evento/${ev.slug}`} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition group">
                <div>
                  <p className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition">{ev.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{fmtDate(ev.startDate)} · {ev.location || 'Local a definir'}</p>
                </div>
                <div className="text-right ml-4 shrink-0">
                  <span className="text-xs font-semibold text-emerald-600">
                    {ev.minPrice === 0 ? 'Gratuito' : `a partir de ${fmt(ev.minPrice)}`}
                  </span>
                  <ArrowUpRight className="w-3 h-3 text-slate-300 group-hover:text-blue-400 ml-auto mt-0.5 transition" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Tickets / Financeiro rápido */}
        <div className="space-y-4">
          {canSupport && tickets && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
                <HeadphonesIcon className="w-4 h-4 text-rose-500" />
                <span className="font-semibold text-slate-800 text-sm">Suporte · Hoje</span>
              </div>
              <div className="grid grid-cols-2 divide-x divide-slate-100">
                <div className="p-4 text-center">
                  <p className="text-2xl font-bold text-amber-500">{tickets.awaitingSupport}</p>
                  <p className="text-xs text-slate-500 mt-1 flex items-center justify-center gap-1"><Clock className="w-3 h-3" /> Aguardando</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-500">{tickets.resolvedToday}</p>
                  <p className="text-xs text-slate-500 mt-1 flex items-center justify-center gap-1"><CheckCircle2 className="w-3 h-3" /> Resolvidos hoje</p>
                </div>
              </div>
              <div className="px-5 pb-4">
                <Link href="/admin/tickets">
                  <button className="w-full text-sm py-2 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition font-medium">
                    Abrir Tickets
                  </button>
                </Link>
              </div>
            </div>
          )}

          {canFinance && finance && finance.summary.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                <span className="font-semibold text-slate-800 text-sm">Top Tenants · Taxa</span>
              </div>
              <div className="px-5 py-3 space-y-3">
                {finance.summary.slice(0, 4).map((s) => (
                  <div key={s.tenantId}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 font-medium truncate max-w-[140px]">{s.tenantId}</span>
                      <span className="text-blue-600 font-semibold">{fmt(s.fee)}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all"
                        style={{ width: `${Math.round((s.fee / maxFee) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 pb-4">
                <Link href="/admin/finance">
                  <button className="w-full text-sm py-2 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition font-medium">
                    Ver Financeiro Completo
                  </button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Cards */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Módulos</h2>
        <div className="grid gap-3 md:grid-cols-4">
          {canAdmin && (
            <Link href="/admin/tenants" className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-violet-300 transition">
              <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center shrink-0 group-hover:bg-violet-200 transition">
                <Building2 className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm">Tenants</p>
                <p className="text-xs text-slate-500">Empresas cadastradas</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 ml-auto group-hover:text-violet-400 transition" />
            </Link>
          )}

          {canSupport && (
            <Link href="/admin/tickets" className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-rose-300 transition">
              <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center shrink-0 group-hover:bg-rose-200 transition">
                <HeadphonesIcon className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm">Tickets</p>
                <p className="text-xs text-slate-500">Atendimento e suporte</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 ml-auto group-hover:text-rose-400 transition" />
            </Link>
          )}

          {canFinance && (
            <Link href="/admin/finance" className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-blue-300 transition">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 group-hover:bg-blue-200 transition">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm">Financeiro</p>
                <p className="text-xs text-slate-500">Taxa de 10% · resumo</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 ml-auto group-hover:text-blue-400 transition" />
            </Link>
          )}

          {canAdmin && (
            <Link href="/admin/users" className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-emerald-300 transition">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 group-hover:bg-emerald-200 transition">
                <Users className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm">Atendentes</p>
                <p className="text-xs text-slate-500">Usuários internos</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 ml-auto group-hover:text-emerald-400 transition" />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
