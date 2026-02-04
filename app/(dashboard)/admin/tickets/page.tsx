'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Tickets (Admin)</h1>
        <p className="text-slate-600">Visão global para suporte</p>
      </div>

      {stats && (
        <div className="grid gap-3 md:grid-cols-4">
          <Card className="cursor-pointer hover:shadow" onClick={() => { setAwaiting('support'); setStatus(''); setPriority(''); }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Aguardando suporte</CardTitle>
              <CardDescription>Última mensagem do usuário</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-bold text-slate-900">{stats.awaitingSupport}</CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow" onClick={() => { setAssigned('unassigned'); setStatus(''); }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Sem atendente</CardTitle>
              <CardDescription>Não atribuídos</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-bold text-slate-900">{stats.unassigned}</CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow" onClick={() => { setAssigned('me'); setStatus(''); }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Minha fila</CardTitle>
              <CardDescription>Atribuídos a mim</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-bold text-slate-900">{stats.assignedToMe}</CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow" onClick={() => { setStatus('resolved'); setAwaiting(''); }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Resolvidos hoje</CardTitle>
              <CardDescription>Status resolvido</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-bold text-slate-900">{stats.resolvedToday}</CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 md:grid-cols-5">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Status</label>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Todos</option>
                <option value="open">Aberto</option>
                <option value="pending">Pendente</option>
                <option value="resolved">Resolvido</option>
                <option value="closed">Fechado</option>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Prioridade</label>
              <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="">Todas</option>
                <option value="low">Baixa</option>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Atribuição</label>
              <Select value={assigned} onChange={(e) => setAssigned(e.target.value)}>
                <option value="any">Todas</option>
                <option value="me">Atribuídos a mim</option>
                <option value="unassigned">Sem atendente</option>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Fila</label>
              <Select value={awaiting} onChange={(e) => setAwaiting(e.target.value)}>
                <option value="">Todas</option>
                <option value="support">Aguardando suporte</option>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Buscar</label>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Assunto..." />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Tag</label>
              <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="ex: cobrança" />
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 text-red-700">{error}</CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card><CardContent className="pt-6 text-slate-500">Carregando...</CardContent></Card>
      ) : tickets.length === 0 ? (
        <Card><CardContent className="pt-6 text-slate-500">Nenhum ticket encontrado.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {tickets.map((t) => (
            <Card
              key={t.id}
              className="hover:shadow-md transition cursor-pointer"
              onClick={() => router.push(`/admin/tickets/${t.id}`)}
              role="button"
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t.subject}</CardTitle>
                <CardDescription>
                  {t.tenant?.name ? `Tenant: ${t.tenant.name}` : 'Tenant: —'} • {t.creator?.email ? `Criador: ${t.creator.email}` : 'Criador: —'}
                  {' • '}
                  {(() => {
                    const isMine = Boolean(currentUser?.id && t.assignedToUserId && t.assignedToUserId === currentUser.id)
                    if (isMine) return 'Atendente: você'
                    if (t.assignee?.email) return `Atendente: ${t.assignee.email}`
                    if (t.assignedToUserId) return 'Atendente: atribuído'
                    return 'Atendente: —'
                  })()}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    Status: {t.status} • Prioridade: {t.priority}
                    {Array.isArray(t.tags) && t.tags.length > 0 ? ` • Tags: ${t.tags.join(', ')}` : ''}
                    {t.lastMessageSender === 'user' && (t.lastUserMessageAt || t.lastMessageAt) ? (
                      <>
                        {' • '}
                        Aguardando suporte há{' '}
                        {formatDistanceToNow(new Date((t.lastUserMessageAt || t.lastMessageAt) as string), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    {(() => {
                      const isMine = Boolean(currentUser?.id && t.assignedToUserId && t.assignedToUserId === currentUser.id)
                      if (isMine) {
                        return (
                          <Button
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              quickUpdate(t.id, { unassign: true })
                            }}
                          >
                            Desatribuir
                          </Button>
                        )
                      }

                      if (!t.assignedToUserId) {
                        return (
                          <Button
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              quickUpdate(t.id, { assignToMe: true })
                            }}
                          >
                            Atribuir p/ mim
                          </Button>
                        )
                      }

                      return null
                    })()}
                    <Button
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        quickUpdate(t.id, { status: 'resolved' })
                      }}
                    >
                      Resolver
                    </Button>
                    <Button
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        quickUpdate(t.id, { status: 'closed' })
                      }}
                    >
                      Fechar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
