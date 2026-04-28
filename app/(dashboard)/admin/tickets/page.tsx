'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Clock,
  UserX,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowUpCircle,
  Minus,
  ChevronRight,
  Filter,
  Search,
  Tag,
  RefreshCw,
} from 'lucide-react'

type Ticket = {
  id: string
  subject: string
  status: string
  priority: string
  createdAt: string
  updatedAt: string
  creator?: { id: string; name: string; email: string } | null
  tenant?: { id: string; name: string } | null
  assignee?: { id: string; name: string; email: string } | null
  assignedToUserId?: string | null
  tags?: string[]
  lastMessageAt?: string | null
  lastMessageSender?: string | null
  lastUserMessageAt?: string | null
  lastSupportMessageAt?: string | null
}

export default function AdminTicketsPage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const [currentUser, setCurrentUser] = useState<{ id: string; name?: string; email?: string; role?: string } | null>(null)

  const [stats, setStats] = useState<{ awaitingSupport: number; unassigned: number; assignedToMe: number; resolvedToday: number } | null>(null)

  const [status, setStatus] = useState<string>('')
  const [priority, setPriority] = useState<string>('')
  const [assigned, setAssigned] = useState<string>('any')
  const [awaiting, setAwaiting] = useState<string>('')
  const [q, setQ] = useState<string>('')
  const [tag, setTag] = useState<string>('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user')
      if (!raw) return
      const user = JSON.parse(raw)
      const r = String(user?.role || 'user')
      setCurrentUser(user)
      if (r === 'support') {
        setAssigned('me')
        setAwaiting('support')
      }
    } catch {
    }
  }, [])

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        setIsLoading(true)
        setError(null)

        const params = new URLSearchParams()
        if (status) params.set('status', status)
        if (priority) params.set('priority', priority)
        if (assigned && assigned !== 'any') params.set('assigned', assigned)
        if (awaiting) params.set('awaiting', awaiting)
        if (q.trim()) params.set('q', q.trim())
        if (tag.trim()) params.set('tag', tag.trim())

        const url = `/api/admin/tickets${params.toString() ? `?${params.toString()}` : ''}`

        const [statsRes, listRes] = await Promise.all([
          fetch('/api/admin/tickets/stats'),
          fetch(url),
        ])

        const statsJson = await statsRes.json()
        if (statsRes.ok) setStats(statsJson?.stats || null)

        const data = await listRes.json()
        if (!listRes.ok) throw new Error([data?.error, data?.hint].filter(Boolean).join('\n') || 'Erro ao carregar tickets')

        if (!mounted) return
        setTickets(data?.tickets || [])
      } catch (e: any) {
        if (!mounted) return
        setError(e?.message || 'Erro ao carregar tickets')
      } finally {
        if (!mounted) return
        setIsLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [status, priority, assigned, awaiting, q, tag])

  async function quickUpdate(ticketId: string, body: any) {
    try {
      setError(null)
      const res = await fetch(`/api/admin/tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error([data?.error, data?.hint].filter(Boolean).join('\n') || 'Erro ao atualizar')

      // Recarrega lista mantendo filtros
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, ...data.ticket } : t)))
    } catch (e: any) {
      setError(e?.message || 'Erro ao atualizar')
    }
  }

  const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
    open:     { label: 'Aberto',    color: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500' },
    pending:  { label: 'Pendente',  color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
    resolved: { label: 'Resolvido', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
    closed:   { label: 'Fechado',   color: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
  }

  const priorityConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    low:    { label: 'Baixa',   color: 'text-slate-400', icon: <Minus className="w-3.5 h-3.5" /> },
    normal: { label: 'Normal',  color: 'text-blue-500',  icon: <Minus className="w-3.5 h-3.5" /> },
    high:   { label: 'Alta',    color: 'text-amber-500', icon: <ArrowUpCircle className="w-3.5 h-3.5" /> },
    urgent: { label: 'Urgente', color: 'text-rose-600',  icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Tickets</h1>
          <p className="text-slate-500 text-sm mt-1">Visão global para suporte</p>
        </div>
        <button
          onClick={() => { setStatus(''); setPriority(''); setAssigned('any'); setAwaiting(''); setQ(''); setTag('') }}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Limpar filtros
        </button>
      </div>

      {/* Stat Cards */}
      {stats && (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <button
            onClick={() => { setAwaiting('support'); setStatus('') }}
            className="rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 p-4 text-white shadow text-left hover:shadow-md transition"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium opacity-90">Aguardando</span>
              <Clock className="w-5 h-5 opacity-80" />
            </div>
            <p className="text-3xl font-bold">{stats.awaitingSupport}</p>
            <p className="text-xs opacity-75 mt-1">última msg do usuário</p>
          </button>

          <button
            onClick={() => { setAssigned('unassigned'); setStatus('') }}
            className="rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 p-4 text-white shadow text-left hover:shadow-md transition"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium opacity-90">Sem atendente</span>
              <UserX className="w-5 h-5 opacity-80" />
            </div>
            <p className="text-3xl font-bold">{stats.unassigned}</p>
            <p className="text-xs opacity-75 mt-1">não atribuídos</p>
          </button>

          <button
            onClick={() => { setAssigned('me'); setStatus('') }}
            className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 p-4 text-white shadow text-left hover:shadow-md transition"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium opacity-90">Minha fila</span>
              <UserCheck className="w-5 h-5 opacity-80" />
            </div>
            <p className="text-3xl font-bold">{stats.assignedToMe}</p>
            <p className="text-xs opacity-75 mt-1">atribuídos a mim</p>
          </button>

          <button
            onClick={() => { setStatus('resolved'); setAwaiting('') }}
            className="rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 text-white shadow text-left hover:shadow-md transition"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium opacity-90">Resolvidos hoje</span>
              <CheckCircle2 className="w-5 h-5 opacity-80" />
            </div>
            <p className="text-3xl font-bold">{stats.resolvedToday}</p>
            <p className="text-xs opacity-75 mt-1">status resolvido</p>
          </button>
        </div>
      )}

      {/* Filtros */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-slate-700">
          <Filter className="w-4 h-4 text-slate-400" /> Filtros
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Status</label>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos</option>
              <option value="open">Aberto</option>
              <option value="pending">Pendente</option>
              <option value="resolved">Resolvido</option>
              <option value="closed">Fechado</option>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Prioridade</label>
            <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="">Todas</option>
              <option value="low">Baixa</option>
              <option value="normal">Normal</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Atribuição</label>
            <Select value={assigned} onChange={(e) => setAssigned(e.target.value)}>
              <option value="any">Todas</option>
              <option value="me">Atribuídos a mim</option>
              <option value="unassigned">Sem atendente</option>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Fila</label>
            <Select value={awaiting} onChange={(e) => setAwaiting(e.target.value)}>
              <option value="">Todas</option>
              <option value="support">Aguardando suporte</option>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1"><Search className="w-3 h-3" /> Buscar</label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Assunto..." />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1"><Tag className="w-3 h-3" /> Tag</label>
            <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="ex: cobrança" />
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm">{error}</div>
      )}

      {/* Ticket List */}
      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400 text-sm">Carregando tickets...</div>
      ) : tickets.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400 text-sm">Nenhum ticket encontrado.</div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => {
            const sc = statusConfig[t.status] || { label: t.status, color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' }
            const pc = priorityConfig[t.priority] || { label: t.priority, color: 'text-slate-400', icon: <Minus className="w-3.5 h-3.5" /> }
            const isMine = Boolean(currentUser?.id && t.assignedToUserId && t.assignedToUserId === currentUser.id)
            const isUrgent = t.priority === 'urgent'
            const isAwaiting = t.lastMessageSender === 'user' && !['resolved', 'closed'].includes(t.status)

            return (
              <div
                key={t.id}
                onClick={() => router.push(`/admin/tickets/${t.id}`)}
                role="button"
                className={`rounded-xl border bg-white shadow-sm hover:shadow-md transition cursor-pointer group ${isUrgent ? 'border-rose-200' : 'border-slate-200'}`}
              >
                {/* Top colored bar for urgent */}
                {isUrgent && <div className="h-1 bg-gradient-to-r from-rose-500 to-rose-400 rounded-t-xl" />}

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Subject */}
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <h3 className="font-semibold text-slate-800 group-hover:text-blue-600 transition truncate">{t.subject}</h3>
                        {isAwaiting && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium shrink-0">
                            <Clock className="w-3 h-3" /> Aguardando
                          </span>
                        )}
                      </div>

                      {/* Meta */}
                      <p className="text-xs text-slate-500 truncate">
                        {t.tenant?.name && <span className="font-medium text-slate-600">{t.tenant.name}</span>}
                        {t.tenant?.name && ' · '}
                        {t.creator?.email || '—'}
                        {' · '}
                        {isMine ? <span className="text-blue-600 font-medium">você</span>
                          : t.assignee?.email ? <span>{t.assignee.email}</span>
                          : <span className="text-slate-400 italic">sem atendente</span>}
                      </p>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition shrink-0 mt-1" />
                  </div>

                  {/* Footer row */}
                  <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Status badge */}
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${sc.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {sc.label}
                      </span>

                      {/* Priority badge */}
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${pc.color}`}>
                        {pc.icon} {pc.label}
                      </span>

                      {/* Tags */}
                      {Array.isArray(t.tags) && t.tags.map(tg => (
                        <span key={tg} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{tg}</span>
                      ))}

                      {/* Waiting time */}
                      {isAwaiting && (t.lastUserMessageAt || t.lastMessageAt) && (
                        <span className="text-xs text-amber-600">
                          há {formatDistanceToNow(new Date((t.lastUserMessageAt || t.lastMessageAt) as string), { locale: ptBR })}
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                      {isMine ? (
                        <button
                          onClick={() => quickUpdate(t.id, { unassign: true })}
                          className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                        >
                          Desatribuir
                        </button>
                      ) : !t.assignedToUserId ? (
                        <button
                          onClick={() => quickUpdate(t.id, { assignToMe: true })}
                          className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition font-medium"
                        >
                          Atribuir p/ mim
                        </button>
                      ) : null}

                      {!['resolved', 'closed'].includes(t.status) && (
                        <button
                          onClick={() => quickUpdate(t.id, { status: 'resolved' })}
                          className="text-xs px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition font-medium"
                        >
                          Resolver
                        </button>
                      )}

                      <button
                        onClick={() => quickUpdate(t.id, { status: 'closed' })}
                        className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition"
                      >
                        Fechar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
