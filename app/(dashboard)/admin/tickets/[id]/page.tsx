'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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
}

type Message = {
  id: string
  sender: string
  message: string
  createdAt: string
}

function statusLabel(status: string) {
  switch (status) {
    case 'open':
      return 'Aberto'
    case 'pending':
      return 'Pendente'
    case 'resolved':
      return 'Resolvido'
    case 'closed':
      return 'Fechado'
    default:
      return status
  }
}

export default function AdminTicketDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [status, setStatus] = useState<string>('')
  const [priority, setPriority] = useState<string>('')
  const [tagsText, setTagsText] = useState<string>('')

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dateTimeFormatter = useMemo(() => {
    return (date: string) => format(new Date(date), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })
  }, [])

  async function load() {
    if (!id) return

    try {
      setIsLoading(true)
      setError(null)

      const res = await fetch(`/api/admin/tickets/${id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Erro ao carregar ticket')

      setTicket(data.ticket)
      setMessages(data.messages || [])
      setStatus(String(data.ticket?.status || ''))
      setPriority(String(data.ticket?.priority || ''))
      setTagsText(Array.isArray(data.ticket?.tags) ? data.ticket.tags.join(', ') : '')
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar ticket')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function saveChanges() {
    if (!id) return

    try {
      setIsSaving(true)
      setError(null)

      const payload: any = {
        status: status || undefined,
        priority: priority || undefined,
        tags: tagsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      }

      const res = await fetch(`/api/admin/tickets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error([data?.error, data?.hint].filter(Boolean).join('\n') || 'Erro ao atualizar ticket')

      await load()
    } catch (e: any) {
      setError(e?.message || 'Erro ao atualizar ticket')
    } finally {
      setIsSaving(false)
    }
  }

  async function sendReply() {
    if (!id) return
    if (!newMessage.trim()) return

    try {
      setIsSaving(true)
      setError(null)

      const res = await fetch(`/api/admin/tickets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage.trim() }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error([data?.error, data?.hint].filter(Boolean).join('\n') || 'Erro ao enviar resposta')

      setNewMessage('')
      await load()
    } catch (e: any) {
      setError(e?.message || 'Erro ao enviar resposta')
    } finally {
      setIsSaving(false)
    }
  }

  async function assignToMe() {
    if (!id) return
    try {
      setIsSaving(true)
      setError(null)

      const res = await fetch(`/api/admin/tickets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignToMe: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error([data?.error, data?.hint].filter(Boolean).join('\n') || 'Erro ao atribuir')

      await load()
    } catch (e: any) {
      setError(e?.message || 'Erro ao atribuir')
    } finally {
      setIsSaving(false)
    }
  }

  async function unassign() {
    if (!id) return
    try {
      setIsSaving(true)
      setError(null)

      const res = await fetch(`/api/admin/tickets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unassign: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error([data?.error, data?.hint].filter(Boolean).join('\n') || 'Erro ao desatribuir')

      await load()
    } catch (e: any) {
      setError(e?.message || 'Erro ao desatribuir')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Ticket (Admin)</h1>
          <p className="text-slate-600">{ticket ? ticket.subject : ''}</p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/tickets">
            <Button variant="outline">← Voltar</Button>
          </Link>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 text-red-700">{error}</CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card>
          <CardContent className="pt-6 text-center text-slate-500">Carregando...</CardContent>
        </Card>
      ) : !ticket ? (
        <Card>
          <CardContent className="pt-6 text-center text-slate-500">Ticket não encontrado.</CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-4">
                <span>{ticket.subject}</span>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {statusLabel(ticket.status)}
                </span>
              </CardTitle>
              <CardDescription>
                {ticket.tenant?.name ? `Tenant: ${ticket.tenant.name} • ` : ''}
                {ticket.creator?.email ? `Criador: ${ticket.creator.email} • ` : ''}
                {ticket.assignee?.email ? `Atendente: ${ticket.assignee.email} • ` : 'Atendente: — • '}
                Criado em {format(new Date(ticket.createdAt), 'dd MMM yyyy', { locale: ptBR })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    disabled={isSaving}
                  >
                    <option value="open">Aberto</option>
                    <option value="pending">Pendente</option>
                    <option value="resolved">Resolvido</option>
                    <option value="closed">Fechado</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Prioridade</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    disabled={isSaving}
                  >
                    <option value="low">Baixa</option>
                    <option value="normal">Normal</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <Button
                    className="w-full bg-slate-900 hover:bg-slate-800"
                    onClick={saveChanges}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Tags</label>
                <input
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="ex: cobrança, pix, erro-500"
                  disabled={isSaving}
                />
                {Array.isArray(ticket.tags) && ticket.tags.length > 0 && (
                  <p className="text-xs text-slate-500">Atuais: {ticket.tags.join(', ')}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={assignToMe} disabled={isSaving}>
                  Atribuir p/ mim
                </Button>
                <Button variant="outline" onClick={unassign} disabled={isSaving}>
                  Desatribuir
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mensagens</CardTitle>
              <CardDescription>Histórico completo do atendimento</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {messages.length === 0 ? (
                  <p className="text-slate-500">Sem mensagens ainda.</p>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className="border rounded-md p-3 bg-white">
                      <div className="flex justify-between gap-4 mb-1">
                        <span className="text-xs font-semibold text-slate-700">
                          {m.sender === 'support' ? 'Suporte' : 'Usuário'}
                        </span>
                        <span className="text-xs text-slate-500">{dateTimeFormatter(m.createdAt)}</span>
                      </div>
                      <p className="text-slate-800 whitespace-pre-wrap">{m.message}</p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Responder como suporte</CardTitle>
              <CardDescription>Essa resposta aparece para o criador do ticket</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="w-full px-3 py-2 border rounded-md min-h-[120px]"
                placeholder="Escreva sua resposta..."
                disabled={isSaving}
              />
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={sendReply}
                disabled={isSaving || !newMessage.trim()}
              >
                {isSaving ? 'Enviando...' : 'Enviar resposta'}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
