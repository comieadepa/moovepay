'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
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

function statusClass(status: string) {
  switch (status) {
    case 'open':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'pending':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'resolved':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'closed':
      return 'bg-slate-100 text-slate-700 border-slate-200'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

export default function SuportePage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const dateFormatter = useMemo(() => {
    return (date: string) => format(new Date(date), 'dd MMM yyyy', { locale: ptBR })
  }, [])

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        setIsLoading(true)
        setError(null)
        const res = await fetch('/api/support/tickets')
        const data = await res.json()
        if (!res.ok) {
          const message = [data?.error, data?.hint].filter(Boolean).join('\n')
          throw new Error(message || 'Erro ao carregar tickets')
        }
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
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Suporte</h1>
          <p className="text-slate-600">Abra tickets e acompanhe o andamento</p>
        </div>
        <Link href="/suporte/novo">
          <Button className="bg-emerald-600 hover:bg-emerald-700">+ Novo Ticket</Button>
        </Link>
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
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            <p className="text-slate-600 mb-4">Você ainda não abriu nenhum ticket.</p>
            <Link href="/suporte/novo">
              <Button className="bg-emerald-600 hover:bg-emerald-700">Abrir primeiro ticket</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tickets.map((t) => (
            <Link key={t.id} href={`/suporte/${t.id}`}>
              <Card className="hover:shadow-md transition cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg">{t.subject}</CardTitle>
                      <CardDescription>
                        Atualizado em {dateFormatter(t.updatedAt)}
                      </CardDescription>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusClass(t.status)}`}>
                      {statusLabel(t.status)}
                    </span>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
