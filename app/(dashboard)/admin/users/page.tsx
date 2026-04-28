'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Users, UserPlus, ShieldCheck, HeadphonesIcon, DollarSign, Eye, EyeOff } from 'lucide-react'

type StaffUser = {
  id: string
  name: string
  email: string
  role: string
}

const roleConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  admin:   { label: 'Admin',      color: 'bg-violet-100 text-violet-700', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
  support: { label: 'Suporte',    color: 'bg-blue-100 text-blue-700',     icon: <HeadphonesIcon className="w-3.5 h-3.5" /> },
  finance: { label: 'Financeiro', color: 'bg-amber-100 text-amber-700',   icon: <DollarSign className="w-3.5 h-3.5" /> },
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<StaffUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
    return () => { mounted = false }
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
      setSuccessMsg(`Usuário "${data?.user?.name || email}" criado com sucesso.`)
      setTimeout(() => setSuccessMsg(null), 4000)
      await load()
    } catch (e: any) {
      setError(e?.message || 'Erro ao criar usuário')
    } finally {
      setIsSaving(false)
    }
  }

  const byRole = (r: string) => users.filter(u => u.role === r).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Atendentes / Staff</h1>
          <p className="text-slate-500 text-sm mt-1">Usuários internos com privilégios restritos</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-sm">
          <Users className="w-4 h-4" />
          {users.length} usuário{users.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Role stats */}
      {!isLoading && users.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-violet-500 shrink-0" />
            <div>
              <p className="text-xl font-bold text-violet-700">{byRole('admin')}</p>
              <p className="text-xs text-violet-500">Admin</p>
            </div>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-center gap-3">
            <HeadphonesIcon className="w-5 h-5 text-blue-500 shrink-0" />
            <div>
              <p className="text-xl font-bold text-blue-700">{byRole('support')}</p>
              <p className="text-xs text-blue-500">Suporte</p>
            </div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-xl font-bold text-amber-700">{byRole('finance')}</p>
              <p className="text-xs text-amber-500">Financeiro</p>
            </div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700 text-sm">{successMsg}</div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm whitespace-pre-wrap">{error}</div>
      )}

      <div className="grid gap-6 md:grid-cols-2 items-start">
        {/* Create form */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            <UserPlus className="w-4 h-4 text-emerald-500" />
            <span className="font-semibold text-slate-800 text-sm">Novo Usuário</span>
          </div>
          <form onSubmit={createUser} className="p-5 space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Nome</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do atendente" required />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@empresa.com" required />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Senha</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="mínimo 8 caracteres"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Perfil</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="support">Suporte</option>
                <option value="finance">Financeiro</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              {isSaving ? 'Criando...' : 'Criar Usuário'}
            </button>
          </form>
        </div>

        {/* Users list */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="font-semibold text-slate-800 text-sm">Staff Cadastrado</span>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-slate-400 text-sm">Carregando...</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">Nenhum staff cadastrado.</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {users.map((u) => {
                const rc = roleConfig[u.role] || { label: u.role, color: 'bg-slate-100 text-slate-600', icon: null }
                return (
                  <div key={u.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-600 font-bold text-sm shrink-0">
                        {u.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{u.name}</p>
                        <p className="text-xs text-slate-400">{u.email}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${rc.color}`}>
                      {rc.icon} {rc.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
