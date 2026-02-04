'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export default function NovoTicketPage() {
  const router = useRouter()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      setIsLoading(true)
      setError(null)

      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message, priority }),
      })

      const data = await res.json()
      if (!res.ok) {
        const message = [data?.error, data?.hint].filter(Boolean).join('\n')
        throw new Error(message || 'Erro ao criar ticket')
      }

      router.push(`/suporte/${data.ticket.id}`)
    } catch (e: any) {
      setError(e?.message || 'Erro ao criar ticket')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Novo Ticket</h1>
        <p className="text-slate-600">Descreva seu problema ou solicitação</p>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50 mb-4">
          <CardContent className="pt-6 text-red-700">{error}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Informações</CardTitle>
          <CardDescription>Quanto mais detalhes, melhor para agilizar o atendimento.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="text-sm font-medium text-slate-700">Assunto</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex.: Não consigo publicar meu evento" />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Prioridade</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full mt-1 px-3 py-2 border rounded-md bg-white text-slate-900"
              >
                <option value="low">Baixa</option>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Mensagem</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Explique o que aconteceu, quando começou, prints, etc."
                className="w-full mt-1 px-3 py-2 border rounded-md min-h-[140px]"
              />
            </div>

            <div className="flex gap-3">
              <Link href="/suporte" className="flex-1">
                <Button type="button" variant="outline" className="w-full">Cancelar</Button>
              </Link>
              <Button
                type="submit"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                disabled={isLoading}
              >
                {isLoading ? 'Enviando...' : 'Criar Ticket'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
