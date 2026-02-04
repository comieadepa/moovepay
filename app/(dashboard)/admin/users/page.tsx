'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type StaffUser = {
  id: string
  name: string
  email: string
  role: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<StaffUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'support' | 'finance'>('support')
  const [isSaving, setIsSaving] = useState(false)

  async function load() {
    const res = await fetch('/api/admin/users')
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Erro ao carregar usuários')
    setUsers(data?.users || [])
  }

  useEffect(() => {
    let mounted = true

    async function run() {
      try {
        setIsLoading(true)
        setError(null)
        await load()
      } catch (e: any) {
        if (!mounted) return
        setError(e?.message || 'Erro ao carregar usuários')
      } finally {
        if (!mounted) return
        setIsLoading(false)
      }
    }

    run()
    return () => {
      mounted = false
    }
  }, [])

  async function createUser(e: React.FormEvent) {
    e.preventDefault()

    try {
      setIsSaving(true)
      setError(null)

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Erro ao criar usuário')

      setName('')
      setEmail('')
      setPassword('')
      setRole('support')

      await load()
    } catch (e: any) {
      setError(e?.message || 'Erro ao criar usuário')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Atendentes / Staff</h1>
        <p className="text-slate-600">Criação de usuários internos com privilégios restritos</p>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 text-red-700 whitespace-pre-wrap">{error}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Novo usuário</CardTitle>
          <CardDescription>Somente role `admin` pode criar staff.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createUser} className="grid gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Nome</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do atendente" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Email</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@empresa.com" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Senha</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mínimo 8 caracteres" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Perfil</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full mt-1 px-3 py-2 border rounded-md bg-white text-slate-900"
              >
                <option value="support">Suporte</option>
                <option value="finance">Financeiro</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={isSaving}>
              {isSaving ? 'Criando...' : 'Criar usuário'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Staff</CardTitle>
          <CardDescription>Perfis internos cadastrados</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-slate-500">Carregando...</p>
          ) : users.length === 0 ? (
            <p className="text-slate-500">Nenhum staff cadastrado.</p>
          ) : (
            <div className="grid gap-2">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between border rounded-md px-3 py-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{u.name}</div>
                    <div className="text-xs text-slate-600">{u.email}</div>
                  </div>
                  <div className="text-xs font-semibold px-2 py-1 rounded bg-slate-100 border">{u.role}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
