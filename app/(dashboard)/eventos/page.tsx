'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Event {
  id: string
  name: string
  description?: string
  status: string
  startDate: string
  registrations: any[]
  payments: any[]
}

export default function EventosPage() {
  const router = useRouter()
  const [events, setEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchEvents()
  }, [])

  async function fetchEvents() {
    try {
      setIsLoading(true)
      const response = await fetch('/api/events', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Erro ao carregar eventos')
        return
      }

      setEvents(data.events || [])
    } catch (err) {
      setError('Erro ao conectar com o servidor')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  async function deleteEvent(eventId: string) {
    if (!confirm('Tem certeza que deseja deletar este evento?')) {
      return
    }

    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setEvents(events.filter(e => e.id !== eventId))
      } else {
        alert('Erro ao deletar evento')
      }
    } catch (err) {
      alert('Erro ao conectar com o servidor')
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Meus Eventos</h1>
          <p className="text-slate-600 mt-1">Gerencie seus eventos e inscrições</p>
        </div>
        <Button
          onClick={() => router.push('/eventos/novo')}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          + Criar Novo Evento
        </Button>
      </div>

      {error && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="pt-6 text-red-700">
            {error}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card>
          <CardContent className="pt-6 text-center text-slate-500">
            Carregando eventos...
          </CardContent>
        </Card>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-slate-500 mb-4">Você ainda não criou nenhum evento</p>
            <Button
              onClick={() => router.push('/eventos/novo')}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Criar Primeiro Evento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {events.map((event) => (
            <Card key={event.id} className="hover:shadow-md transition">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{event.name}</CardTitle>
                    {event.description && (
                      <CardDescription className="mt-1">
                        {event.description}
                      </CardDescription>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    event.status === 'draft'
                      ? 'bg-yellow-100 text-yellow-800'
                      : event.status === 'published'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {event.status === 'draft' ? 'Rascunho' : event.status === 'published' ? 'Publicado' : 'Finalizado'}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div>
                    <p className="text-sm text-slate-600">Inscrições</p>
                    <p className="text-2xl font-bold">{event.registrations.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Pagamentos Recebidos</p>
                    <p className="text-2xl font-bold">
                      {event.payments.filter(p => p.status === 'received').length}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Data</p>
                    <p className="text-2xl font-bold">
                      {format(new Date(event.startDate), 'dd MMM', { locale: ptBR })}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/eventos/${event.id}`)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/eventos/${event.id}?tab=registrations`)}
                  >
                    Link de Inscrições
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => deleteEvent(event.id)}
                  >
                    Deletar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
