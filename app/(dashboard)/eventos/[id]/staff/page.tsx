'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, UserPlus, Trash2, ShieldCheck, ScanLine, RefreshCw, Copy, Check, Eye, EyeOff, Link2 } from 'lucide-react'

type CheckInLink = {
  id: string
  label: string
  createdAt: string
  revokedAt: string | null
}

type NewLink = CheckInLink & { url: string }

function buildUrl(id: string) {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  return `${base}/c/${id}`
}

export default function EventStaffPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const router = useRouter()

  const [links, setLinks] = useState<CheckInLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [addLabel, setAddLabel] = useState('')
  const [addPassword, setAddPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [newLink, setNewLink] = useState<NewLink | null>(null)
  const [copied, setCopied] = useState(false)

  const [revokingId, setRevokingId] = useState<string | null>(null)

  async function fetchLinks() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/eventos/${eventId}/staff`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Erro ao carregar links')
      setLinks((json.data ?? []).filter((l: CheckInLink) => !l.revokedAt))
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLinks() }, [eventId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAddError(null)
    setNewLink(null)
    const label = addLabel.trim()
    const password = addPassword.trim()
    if (!label || !password) return
    setAdding(true)
    try {
      const res = await fetch(`/api/eventos/${eventId}/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, password }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Erro ao criar link')
      const created: NewLink = { ...json.data, url: buildUrl(json.data.id) }
      setNewLink(created)
      setLinks((prev) => [...prev, json.data])
      setAddLabel('')
      setAddPassword('')
    } catch (e: any) {
      setAddError(e?.message || 'Erro ao criar link')
    } finally {
      setAdding(false)
    }
  }

  async function handleRevoke(linkId: string) {
    if (!confirm('Revogar este link? O colaborador perderá acesso imediatamente.')) return
    setRevokingId(linkId)
    try {
      await fetch(`/api/eventos/${eventId}/staff/${linkId}`, { method: 'DELETE' })
      setLinks((prev) => prev.filter((l) => l.id !== linkId))
      if (newLink?.id === linkId) setNewLink(null)
    } finally {
      setRevokingId(null)
    }
  }

  function handleCopy(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Colaboradores do Evento</h1>
          <p className="text-sm text-slate-500">Gerencie quem pode fazer check-in neste evento</p>
        </div>
      </div>

      {/* Como funciona */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1 flex items-center gap-1.5"><ScanLine className="w-4 h-4" /> Como funciona</p>
        <p className="leading-relaxed">
          Defina um identificador (email ou nome) e uma senha. O sistema gera um link único.
          O colaborador acessa o link, digita a senha e já pode escanear QR codes —
          <strong> sem precisar criar conta</strong>. O link expira automaticamente ao encerrar o evento.
        </p>
      </div>

      {/* Formulário */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Criar link de acesso
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-3">
            <Input
              type="text"
              placeholder="Email ou nome do colaborador"
              value={addLabel}
              onChange={(e) => setAddLabel(e.target.value)}
              required
            />
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Senha de acesso (mín. 4 caracteres)"
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
                className="pr-10"
                required
                minLength={4}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {addError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {addError}
              </p>
            )}
            <Button type="submit" disabled={adding} className="w-full gap-2">
              {adding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              {adding ? 'Gerando link...' : 'Gerar link de check-in'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Link gerado */}
      {newLink && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-emerald-800 flex items-center gap-1.5">
            <Check className="w-4 h-4" /> Link criado para <span className="font-bold">{newLink.label}</span>
          </p>
          <p className="text-xs text-emerald-700">
            Envie o link abaixo para o colaborador. Ele precisará da senha definida acima para acessar.
          </p>
          <div className="flex gap-2 items-center">
            <input
              readOnly
              value={newLink.url}
              className="flex-1 bg-white border border-emerald-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700 select-all truncate"
            />
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-100 flex-shrink-0"
              onClick={() => handleCopy(newLink.url)}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </Button>
          </div>
        </div>
      )}

      {/* Lista de links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            Links ativos ({links.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm">Carregando...</span>
            </div>
          ) : error ? (
            <p className="text-sm text-red-600 px-6 py-4">{error}</p>
          ) : links.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum link criado ainda.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {links.map((l) => (
                <li key={l.id} className="flex items-center justify-between px-6 py-4 gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 truncate">{l.label}</p>
                    <button
                      type="button"
                      onClick={() => handleCopy(buildUrl(l.id))}
                      className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 mt-0.5"
                    >
                      <Copy className="w-3 h-3" /> Copiar link
                    </button>
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    {new Date(l.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                    onClick={() => handleRevoke(l.id)}
                    disabled={revokingId === l.id}
                  >
                    {revokingId === l.id
                      ? <RefreshCw className="w-4 h-4 animate-spin" />
                      : <Trash2 className="w-4 h-4" />}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
