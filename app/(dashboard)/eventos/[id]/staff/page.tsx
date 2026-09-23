'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ArrowLeft,
  UserPlus,
  Trash2,
  ShieldCheck,
  ScanLine,
  RefreshCw,
  Copy,
  Check,
  Eye,
  EyeOff,
  Link2,
  Share2,
} from 'lucide-react'

type CheckInLink = {
  id: string
  label: string
  createdAt: string
  revokedAt: string | null
  lastUsedAt?: string | null
}

type CreatedLinkInfo = {
  id: string
  label: string
  token: string
  url: string
  eventName?: string
}

function buildPublicUrl(token: string) {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  return `${base}/c/${token}`
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
  
  const [newLink, setNewLink] = useState<CreatedLinkInfo | null>(null)
  const [copied, setCopied] = useState(false)

  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)

  async function fetchLinks() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/eventos/${eventId}/staff`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Erro ao carregar links')
      setLinks((json.data ?? []).filter((l: CheckInLink) => !l.revokedAt))
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar links')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLinks()
  }, [eventId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAddError(null)
    setNewLink(null)
    const label = addLabel.trim()
    const password = addPassword.trim()
    if (!label) return
    setAdding(true)
    try {
      const res = await fetch(`/api/eventos/${eventId}/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, password: password || undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Erro ao criar link')

      const token = json.data.token || json.data.id
      const created: CreatedLinkInfo = {
        id: json.data.id,
        label: json.data.label,
        token,
        url: buildPublicUrl(token),
        eventName: json.data.eventName,
      }
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
    if (!confirm('Deseja revogar este link? A equipe conectada a ele perderá o acesso imediatamente.')) return
    setRevokingId(linkId)
    try {
      const res = await fetch(`/api/eventos/${eventId}/staff/${linkId}`, { method: 'DELETE' })
      if (res.ok) {
        setLinks((prev) => prev.filter((l) => l.id !== linkId))
        if (newLink?.id === linkId) setNewLink(null)
      }
    } finally {
      setRevokingId(null)
    }
  }

  async function handleRegenerate(linkId: string) {
    if (!confirm('Deseja regenerar este link? O link anterior será invalidado e um novo token será gerado.')) return
    setRegeneratingId(linkId)
    try {
      const res = await fetch(`/api/eventos/${eventId}/staff/${linkId}`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Erro ao regenerar link')

      const token = json.data.token || json.data.id
      const created: CreatedLinkInfo = {
        id: json.data.id,
        label: json.data.label,
        token,
        url: buildPublicUrl(token),
        eventName: json.data.eventName,
      }
      setNewLink(created)
      setLinks((prev) => prev.map((l) => (l.id === linkId ? json.data : l)))
    } catch (e: any) {
      alert(e?.message || 'Erro ao regenerar link')
    } finally {
      setRegeneratingId(null)
    }
  }

  function handleCopy(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleShareWhatsApp(linkInfo: CreatedLinkInfo) {
    const text = encodeURIComponent(
      `Olá! Segue o link de credenciamento e check-in para o evento *${linkInfo.eventName || 'CongregaPay'}*:\n\n` +
      `🔗 ${linkInfo.url}\n\n` +
      `Abra no celular para escanear os QR Codes dos vouchers na portaria.`
    )
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank')
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Links de Portaria & Credenciamento</h1>
          <p className="text-sm text-slate-500">Gere links exclusivos para a equipe ler QR Codes no celular</p>
        </div>
      </div>

      {/* Como funciona */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-sm text-emerald-950">
        <p className="font-bold mb-1 flex items-center gap-2 text-emerald-800">
          <ScanLine className="w-4 h-4" /> Operação Móvel Independente
        </p>
        <p className="text-xs text-emerald-800 leading-relaxed">
          O voluntário ou operador de portaria abre o link diretamente no navegador do smartphone e usa a câmera para
          validar QR Codes ou faz busca manual por nome/CPF — <strong>sem precisar de login administrativo ou conta no sistema</strong>.
        </p>
      </div>

      {/* Formulário de Criação */}
      <Card className="border-slate-200 shadow-sm rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
            <UserPlus className="w-4 h-4 text-emerald-600" /> Criar Novo Link de Acesso
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-3.5">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Identificador do Posto / Colaborador
              </label>
              <Input
                type="text"
                placeholder="Ex: Portaria Principal, Recepção 01, Voluntário João..."
                value={addLabel}
                onChange={(e) => setAddLabel(e.target.value)}
                className="h-11 rounded-xl"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1 flex items-center justify-between">
                <span>Senha de Acesso (Opcional)</span>
                <span className="text-[11px] font-normal text-slate-400">Deixe em branco para acesso direto</span>
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Defina uma senha se desejar proteção extra"
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                  className="pr-10 h-11 rounded-xl"
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
            </div>

            {addError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                {addError}
              </p>
            )}

            <Button
              type="submit"
              disabled={adding}
              className="w-full h-11 font-semibold gap-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-sm"
            >
              {adding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              {adding ? 'Gerando link seguro...' : 'Gerar Link de Portaria'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Link recém-criado ou regenerado com atalhos */}
      {newLink && (
        <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-4 space-y-3 shadow-md animate-in fade-in">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-emerald-950 flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600" /> Link Ativo para: <strong>{newLink.label}</strong>
            </p>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full">
              Pronto para Uso
            </span>
          </div>

          <p className="text-xs text-emerald-800 leading-relaxed">
            Compartilhe este link com o responsável pelo posto de credenciamento.
          </p>

          <div className="flex gap-2 items-center">
            <input
              readOnly
              value={newLink.url}
              className="flex-1 bg-white border border-emerald-300 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-800 select-all truncate shadow-inner"
            />
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100 shrink-0 h-10 font-bold rounded-xl"
              onClick={() => handleCopy(newLink.url)}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </Button>
          </div>

          <div className="pt-1">
            <Button
              size="sm"
              onClick={() => handleShareWhatsApp(newLink)}
              className="w-full gap-2 bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold h-10 rounded-xl shadow-sm"
            >
              <Share2 className="w-4 h-4" /> Enviar por WhatsApp
            </Button>
          </div>
        </div>
      )}

      {/* Lista de Links Ativos */}
      <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-3.5">
          <CardTitle className="text-sm font-bold flex items-center justify-between text-slate-900">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Links de Portaria Ativos ({links.length})</span>
            </div>
            <Button variant="ghost" size="sm" onClick={fetchLinks} className="h-7 text-xs text-slate-500">
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-slate-400 text-sm">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
              <span>Carregando links...</span>
            </div>
          ) : error ? (
            <p className="text-sm text-red-600 px-6 py-4">{error}</p>
          ) : links.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">Nenhum link gerado para este evento ainda.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {links.map((l) => (
                <li key={l.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-slate-50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-slate-900 truncate">{l.label}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                      <span>Criado em: {new Date(l.createdAt).toLocaleDateString('pt-BR')}</span>
                      {l.lastUsedAt && (
                        <span>• Último uso: {new Date(l.lastUsedAt).toLocaleTimeString('pt-BR')}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRegenerate(l.id)}
                      disabled={regeneratingId === l.id}
                      className="h-8 text-xs font-semibold border-slate-300 text-slate-700 hover:bg-slate-100 gap-1 rounded-lg"
                      title="Gerar novo link substituindo este"
                    >
                      <RefreshCw className={`w-3 h-3 ${regeneratingId === l.id ? 'animate-spin' : ''}`} />
                      Regenerar
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                      onClick={() => handleRevoke(l.id)}
                      disabled={revokingId === l.id}
                      title="Revogar link"
                    >
                      {revokingId === l.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

