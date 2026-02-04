'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type MeUser = {
  id: string
  email: string
  name: string
  whatsapp?: string
  role?: string
  defaultTenantId?: string
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.655 32.659 29.167 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.962 3.038l5.657-5.657C34.98 6.053 29.754 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 16.109 19.01 12 24 12c3.059 0 5.842 1.154 7.962 3.038l5.657-5.657C34.98 6.053 29.754 4 24 4c-7.682 0-14.38 4.337-17.694 10.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.063 0 9.97-1.94 13.571-5.096l-6.271-5.303C29.26 35.091 26.74 36 24 36c-5.146 0-9.62-3.314-11.283-7.946l-6.521 5.025C9.48 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.03 12.03 0 0 1-4.003 5.601l.003-.002 6.271 5.303C36.9 39.47 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  )
}

export default function CompletarCadastroPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [user, setUser] = useState<MeUser | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')

  const canSubmit = useMemo(() => {
    return name.trim().length >= 3 && whatsapp.trim().length >= 8
  }, [name, whatsapp])

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch('/api/auth/me', { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))

        if (!res.ok) {
          router.push('/signup')
          return
        }

        const u = data.user as MeUser
        if (!active) return

        setUser(u)
        setName(u?.name || '')
        setEmail(u?.email || '')
        setWhatsapp(u?.whatsapp || '')

        // garante localStorage (mesma estrutura do login)
        localStorage.setItem(
          'user',
          JSON.stringify({
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role || 'user',
            defaultTenantId: u.defaultTenantId || u.id,
          })
        )
      } catch (e) {
        if (!active) return
        setError('Erro ao carregar dados do usuário')
      } finally {
        if (!active) return
        setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [router])

  const onSubmit = async () => {
    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/complete-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, whatsapp }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Erro ao completar cadastro')
        return
      }

      const u = data.user as MeUser
      localStorage.setItem(
        'user',
        JSON.stringify({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role || 'user',
          defaultTenantId: u.defaultTenantId || u.id,
        })
      )

      router.push('/dashboard')
    } catch {
      setError('Erro ao conectar com o servidor')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="flex items-center justify-center min-h-screen bg-cover bg-center bg-fixed"
      style={{ backgroundImage: `url('/img/bg_login.jpg')` }}
    >
      <div className="absolute inset-0 bg-black/40" />

      <Card className="w-full max-w-md relative z-10 shadow-2xl">
        <CardHeader>
          <CardTitle>Completar cadastro</CardTitle>
          <CardDescription>
            Só mais alguns dados obrigatórios para liberar sua conta.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-10 text-center text-slate-600">Carregando...</div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <Input value={email} disabled className="opacity-80" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Celular</label>
                <Input
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="(99) 99999-9999"
                />
              </div>

              <Button
                onClick={onSubmit}
                disabled={!canSubmit || saving}
                className="w-full h-11 bg-slate-900 hover:bg-slate-800"
              >
                {saving ? 'Salvando...' : 'Completar cadastro'}
              </Button>

              <div className="mt-6 border-t pt-4">
                <Link href="/">
                  <Button variant="ghost" size="sm" className="w-full text-blue-600 hover:text-blue-700">
                    ← Voltar à home
                  </Button>
                </Link>
              </div>

              {!user?.email ? null : (
                <div className="pt-2 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                  <GoogleIcon />
                  Conectado com Google
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
