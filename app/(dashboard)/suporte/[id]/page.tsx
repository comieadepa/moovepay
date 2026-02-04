'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Ticket = {
  id: string
  subject: string
  status: string
  priority: string
  createdAt: string
  updatedAt: string
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

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
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
      const res = await fetch(`/api/support/tickets/${id}`)
      const data = await res.json()
      if (!res.ok) {
        const message = [data?.error, data?.hint].filter(Boolean).join('\n')
        throw new Error(message || 'Erro ao carregar ticket')
      }
      setTicket(data.ticket)
      setMessages(data.messages || [])
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

  async function sendMessage() {
    if (!id) return
    if (!newMessage.trim()) return

    try {
      setIsSaving(true)
      setError(null)

      const res = await fetch(`/api/support/tickets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage.trim(), status: 'pending' }),
      })

      const data = await res.json()
      if (!res.ok) {
        const message = [data?.error, data?.hint].filter(Boolean).join('\n')
        throw new Error(message || 'Erro ao enviar mensagem')
      }

      setNewMessage('')
      await load()
    } catch (e: any) {
      setError(e?.message || 'Erro ao enviar mensagem')
    } finally {
      setIsSaving(false)
    }
  }

  async function closeTicket() {
    if (!id) return

    try {
      setIsSaving(true)
      setError(null)

      const res = await fetch(`/api/support/tickets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed' }),
      })

      const data = await res.json()
      if (!res.ok) {
        const message = [data?.error, data?.hint].filter(Boolean).join('\n')
        throw new Error(message || 'Erro ao fechar ticket')
      }

      await load()
    } catch (e: any) {
      setError(e?.message || 'Erro ao fechar ticket')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Ticket</h1>
          <p className="text-slate-600">{ticket ? ticket.subject : ''}</p>
        </div>
        <div className="flex gap-3">
          <Link href="/suporte">
            <Button variant="outline">← Voltar</Button>
          </Link>
          <Button
            variant="outline"
            onClick={closeTicket}
            disabled={isSaving || (ticket?.status === 'closed')}
          >
            Fechar
          </Button>
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
                Criado em {format(new Date(ticket.createdAt), 'dd MMM yyyy', { locale: ptBR })}
              </CardDescription>
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
                          {m.sender === 'support' ? 'Suporte' : 'Você'}
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
              <CardTitle>Enviar mensagem</CardTitle>
              <CardDescription>Atualize o ticket com mais detalhes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="w-full px-3 py-2 border rounded-md min-h-[120px]"
                placeholder="Escreva sua mensagem..."
                disabled={ticket.status === 'closed'}
              />
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={sendMessage}
                disabled={isSaving || ticket.status === 'closed' || !newMessage.trim()}
              >
                {isSaving ? 'Enviando...' : 'Enviar'}
              </Button>
              {ticket.status === 'closed' && (
                <p className="text-sm text-slate-500">Este ticket está fechado.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
