'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import {
  Building2,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  MessagesSquare,
  Shield,
  Ticket,
  Users2,
  X,
} from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [role, setRole] = useState<string>('user')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const inAdminArea = Boolean(pathname?.startsWith('/admin'))
  const canSupport = role === 'admin' || role === 'support'
  const canFinance = role === 'admin' || role === 'finance'
  const canAdmin = role === 'admin'
  const canSeeAdminArea = role === 'admin' || role === 'support' || role === 'finance'

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store', credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const u = data?.user
        if (!u) return
        const normalized = {
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role || 'user',
          defaultTenantId: u.defaultTenantId || u.id,
        }
        // Mantém localStorage apenas como cache de exibição (nome/avatar), nunca como fonte de autorização
        localStorage.setItem('user', JSON.stringify(normalized))
        setUser(normalized)
        setRole(String(normalized.role || 'user'))
      })
      .catch(() => {
        setUser(null)
        setRole('user')
      })
  }, [])

  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    const target = inAdminArea ? '/admin/login' : '/login'
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
      })
    } finally {
      localStorage.removeItem('user')
      // Força um reload completo para garantir que o middleware reconheça a remoção do cookie.
      window.location.assign(target)
    }
  }

  const mainItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, active: pathname === '/dashboard' },
    { href: '/eventos', label: 'Eventos', icon: Ticket, active: Boolean(pathname?.startsWith('/eventos')) },
    { href: '/suporte', label: 'Suporte', icon: LifeBuoy, active: Boolean(pathname?.startsWith('/suporte')) },
  ]

  const adminItems = [
    { href: '/admin', label: 'Visão geral', icon: Shield, active: pathname === '/admin' },
    canSupport ? { href: '/admin/tickets', label: 'Tickets', icon: MessagesSquare, active: Boolean(pathname?.startsWith('/admin/tickets')) } : null,
    canFinance ? { href: '/admin/finance', label: 'Financeiro', icon: CreditCard, active: Boolean(pathname?.startsWith('/admin/finance')) } : null,
    canAdmin ? { href: '/admin/tenants', label: 'Tenants', icon: Building2, active: Boolean(pathname?.startsWith('/admin/tenants')) } : null,
    canAdmin ? { href: '/admin/users', label: 'Atendentes', icon: Users2, active: Boolean(pathname?.startsWith('/admin/users')) } : null,
  ].filter(Boolean) as Array<{ href: string; label: string; icon: any; active: boolean }>

  function NavLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: any; active: boolean }) {
    return (
      <Link
        href={href}
        className={cn(
          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
          active
            ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30'
            : 'text-slate-300 hover:bg-white/10 hover:text-white'
        )}
      >
        <Icon className={cn('h-4 w-4 flex-shrink-0', active ? 'text-white' : 'text-slate-400')} />
        <span>{label}</span>
        {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/80" />}
      </Link>
    )
  }

  function Sidebar({ mobile = false }: { mobile?: boolean }) {
    return (
      <div className={cn('flex flex-col h-full bg-slate-900', mobile ? '' : '')}>
        {/* Logo */}
        <div className="flex h-16 items-center px-5 border-b border-white/10 flex-shrink-0">
          <Link href={inAdminArea ? '/admin' : '/dashboard'} className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="MoovePay"
              width={140}
              height={40}
              className="h-8 w-auto brightness-0 invert"
              priority
            />
          </Link>
        </div>

        {/* Perfil */}
        <div className="px-4 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {(user?.name || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">{user?.name || 'Conta'}</div>
              <div className="text-xs text-slate-400 truncate">{user?.email || ''}</div>
            </div>
            <span className={cn(
              'ml-auto text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0',
              role === 'admin' ? 'bg-emerald-500/20 text-emerald-400' :
              role === 'support' ? 'bg-violet-500/20 text-violet-400' :
              role === 'finance' ? 'bg-amber-500/20 text-amber-400' :
              'bg-white/10 text-slate-300'
            )}>
              {role}
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {!canSeeAdminArea && (
            <>
              <p className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-widest">Conta</p>
              {mainItems.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </>
          )}

          {canSeeAdminArea && (
            <>
              <p className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-widest">Admin</p>
              {adminItems.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </>
          )}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-white/10 flex-shrink-0">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sair da conta
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Sidebar desktop */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:z-40 lg:flex lg:w-64 lg:flex-col shadow-xl">
        <Sidebar />
      </aside>

      {/* Header mobile */}
      <header className="sticky top-0 z-40 bg-slate-900 lg:hidden shadow-md">
        <div className="h-14 px-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMobileNavOpen((v) => !v)}
            className="inline-flex items-center justify-center rounded-xl bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
            aria-label="Abrir menu"
          >
            {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link href={inAdminArea ? '/admin' : '/dashboard'} className="flex items-center">
            <Image src="/logo.png" alt="MoovePay" width={140} height={40} className="h-8 w-auto brightness-0 invert" priority />
          </Link>

          <button
            onClick={handleLogout}
            className="text-slate-300 hover:text-red-400 text-sm font-medium transition-colors"
          >
            Sair
          </button>
        </div>

        {mobileNavOpen && (
          <div className="bg-slate-900 border-t border-white/10 pb-3">
            {/* Perfil mobile */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 mb-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {(user?.name || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">{user?.name || 'Conta'}</div>
                <div className="text-xs text-slate-400 truncate">{user?.email || ''}</div>
              </div>
            </div>

            <nav className="px-3 space-y-1">
              {!canSeeAdminArea && mainItems.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
              {canSeeAdminArea && adminItems.length > 0 && (
                <>
                  <p className="px-3 pt-2 pb-1 text-xs font-semibold text-slate-500 uppercase tracking-widest">Admin</p>
                  {adminItems.map((item) => (
                    <NavLink key={item.href} {...item} />
                  ))}
                </>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* Content */}
      <div className="lg:pl-64">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
