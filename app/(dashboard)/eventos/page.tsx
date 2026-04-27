'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Calendar,
  Users,
  DollarSign,
  ExternalLink,
  Pencil,
  Trash2,
  Plus,
  ChevronRight,
} from 'lucide-react'

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

  const moneyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="space-y-6">

      {/* ── CABEÇALHO ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Meus Eventos</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gerencie seus eventos e inscrições</p>
        </div>
        <button
          onClick={() => router.push('/eventos/novo')}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Criar Novo Evento
        </button>
      </div>

      {/* ── ERRO ── */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* ── LOADING ── */}
      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 h-40 animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        /* ── ESTADO VAZIO ── */
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-14 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="font-semibold text-slate-900 mb-1">Nenhum evento criado</h3>
          <p className="text-slate-500 text-sm mb-6">Crie seu primeiro evento e comece a receber inscrições.</p>
          <button
            onClick={() => router.push('/eventos/novo')}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            Criar Primeiro Evento
          </button>
        </div>
      ) : (
        /* ── LISTA DE EVENTOS ── */
        <div className="grid gap-4">
          {events.map((event) => {
            const totalRegistrations = event.registrations?.length || 0
            const paidPayments = (event.payments || []).filter((p) => p.status === 'received')
            const totalRevenue = paidPayments.reduce((sum: number, p: any) => sum + Number(p.value || 0), 0)
            const isPublished = event.status === 'published'
            const isFinished = event.status === 'finished'

            return (
              <div
                key={event.id}
                className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-shadow overflow-hidden
                  ${isPublished ? 'border-l-4 border-l-emerald-500 border-slate-100' : isFinished ? 'border-l-4 border-l-slate-400 border-slate-100' : 'border-l-4 border-l-amber-400 border-slate-100'}`}
              >
                <div className="p-6">
                  {/* Top row: nome + badge + data */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-bold text-slate-900 truncate">{event.name}</h2>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold flex-shrink-0
                          ${isPublished ? 'bg-emerald-100 text-emerald-700' : isFinished ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-700'}`}>
                          {isPublished ? 'Publicado' : isFinished ? 'Finalizado' : 'Rascunho'}
                        </span>
                      </div>
                      {event.description && (
                        <p className="text-sm text-slate-500 mt-0.5 line-clamp-1">{event.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 flex-shrink-0 bg-slate-50 px-3 py-1.5 rounded-lg">
                      <Calendar className="w-3.5 h-3.5" />
                      {format(new Date(event.startDate), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                    </div>
                  </div>

                  {/* Métricas */}
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    <div className="bg-slate-50 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                        <Users className="w-3.5 h-3.5" />
                        Inscrições
                      </div>
                      <p className="text-xl font-bold text-slate-900">{totalRegistrations}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                        <DollarSign className="w-3.5 h-3.5" />
                        Pgtos confirmados
                      </div>
                      <p className="text-xl font-bold text-slate-900">{paidPayments.length}</p>
                    </div>
                    <div className="bg-emerald-50 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 text-emerald-600 text-xs mb-1">
                        <DollarSign className="w-3.5 h-3.5" />
                        Receita
                      </div>
                      <p className="text-xl font-bold text-emerald-700">{moneyFormatter.format(totalRevenue)}</p>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => router.push(`/eventos/${event.id}`)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Editar
                    </button>
                    <button
                      onClick={() => router.push(`/eventos/${event.id}/inscritos`)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Users className="w-3.5 h-3.5" />
                      Inscritos
                    </button>
                    {isPublished && (
                      <Link
                        href={`/inscricao/${event.id}`}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 text-sm font-medium border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Link de Inscrição
                      </Link>
                    )}
                    <button
                      onClick={() => deleteEvent(event.id)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 rounded-lg transition-colors ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Excluir
                    </button>
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
