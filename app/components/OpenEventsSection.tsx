'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type OpenEvent = {
  id: string
  slug?: string
  name: string
  startDate: string
  location?: string
  bannerUrl?: string
  minPrice: number
  maxPrice: number
}

function money(value: number) {
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Number(value || 0))
  } catch {
    return `R$ ${Number(value || 0).toFixed(2)}`
  }
}

function capitalize(v: string) {
  if (!v) return v
  return v.charAt(0).toUpperCase() + v.slice(1)
}

export function OpenEventsSection() {
  const [events, setEvents] = useState<OpenEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch('/api/eventos?open=1&limit=12')
        const data = await res.json().catch(() => ({}))

        if (!res.ok) {
          throw new Error(data.error || 'Erro ao carregar eventos')
        }

        if (!active) return
        setEvents(Array.isArray(data.events) ? data.events : [])
      } catch (e) {
        if (!active) return
        setError(e instanceof Error ? e.message : 'Erro ao carregar eventos')
      } finally {
        if (!active) return
        setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return events.filter((ev) => {
      if (category !== 'all') return true // placeholder para categorias futuras
      if (!q) return true
      const hay = `${ev.name} ${ev.location || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [events, query, category])

  return (
    <section id="eventos" className="bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col gap-2 mb-6">
          <h2 className="text-3xl font-bold text-gray-900">Eventos em aberto</h2>
          <p className="text-gray-600">
            Encontre e se inscreva nos próximos eventos disponíveis agora.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center mb-8">
          <div className="flex-1">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar evento"
              className="h-12 rounded-full px-5"
            />
          </div>
          <div className="sm:w-56">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-12 w-full rounded-full border border-input bg-white px-4 text-sm shadow-sm"
              aria-label="Filtrar categoria"
            >
              <option value="all">Todas</option>
              <option value="retiro">Retiros</option>
              <option value="conferencia">Conferências</option>
              <option value="congresso">Congressos</option>
              <option value="workshop">Workshops</option>
              <option value="seminario">Seminários</option>
              <option value="curso">Cursos</option>
            </select>
          </div>
        </div>

        {error ? (
          <Card className="border-rose-200 bg-rose-50">
            <CardContent className="pt-6 text-rose-700">{error}</CardContent>
          </Card>
        ) : loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <div className="h-44 bg-gray-100 animate-pulse" />
                <CardContent className="pt-4">
                  <div className="h-5 bg-gray-100 animate-pulse rounded mb-2" />
                  <div className="h-4 bg-gray-100 animate-pulse rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="pt-10 pb-10 text-center">
              <p className="text-gray-600">Nenhum evento encontrado.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filtered.map((ev) => {
              const href = `/evento/${ev.slug || ev.id}`
              const min = Number(ev.minPrice || 0)
              const max = Number(ev.maxPrice || 0)
              const priceLabel =
                max <= 0
                  ? 'Gratuito'
                  : min === max
                  ? money(min)
                  : `${money(min)} - ${money(max)}`

              const dateLabel = (() => {
                try {
                  return capitalize(
                    format(new Date(ev.startDate), "EEEE, d 'de' MMMM", {
                      locale: ptBR,
                    })
                  )
                } catch {
                  return ''
                }
              })()

              return (
                <Link key={ev.id} href={href} className="group">
                  <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="relative h-44 bg-gradient-to-br from-slate-900 to-slate-700">
                      {ev.bannerUrl ? (
                        <img
                          src={ev.bannerUrl}
                          alt={ev.name}
                          className="absolute inset-0 h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : null}
                      <div className="absolute inset-0 bg-black/15" />
                      <div className="absolute top-3 right-3">
                        <Badge className="bg-white/95 text-slate-900 border border-white/30 shadow">
                          {priceLabel}
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="pt-4">
                      <h3 className="font-extrabold text-gray-900 tracking-tight leading-snug line-clamp-2 group-hover:text-blue-700 transition-colors">
                        {ev.name}
                      </h3>
                      {dateLabel ? (
                        <p className="text-sm text-blue-600 mt-2">{dateLabel}</p>
                      ) : null}
                      {ev.location ? (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{ev.location}</p>
                      ) : null}
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
