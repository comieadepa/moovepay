'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
    try {
      const raw = localStorage.getItem('user')
      if (raw) {
        const parsed = JSON.parse(raw)
        setUser(parsed)
        setRole(String(parsed?.role || 'user'))
        return
      }

      // Fallback para fluxos que setam apenas cookie (ex.: OAuth)
      fetch('/api/auth/me', { cache: 'no-store' })
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
          localStorage.setItem('user', JSON.stringify(normalized))
          setUser(normalized)
          setRole(String(normalized.role || 'user'))
        })
        .catch(() => {
          // ignore
        })
    } catch {
      setUser(null)
      setRole('user')
    }
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
          'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition',
          active
            ? 'bg-slate-900 text-white shadow-sm'
            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
        )}
      >
        <Icon className={cn('h-4 w-4', active ? 'text-white' : 'text-slate-500')} />
        <span>{label}</span>
      </Link>
    )
  }

  function Sidebar() {
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center gap-3 px-4 border-b border-slate-200">
          <Link href={inAdminArea ? '/admin' : '/dashboard'} className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="MoovePay"
              width={140}
              height={40}
              className="h-9 w-auto"
              priority
            />
          </Link>
        </div>

        <div className="px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">{user?.name || 'Conta'}</div>
              <div className="text-xs text-slate-500 truncate">{user?.email || ''}</div>
            </div>
            <Badge variant={role === 'admin' ? 'success' : role === 'support' ? 'secondary' : role === 'finance' ? 'warning' : 'outline'}>
              {role}
            </Badge>
          </div>
        </div>

        <nav className="px-3 space-y-1">
          <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Conta</div>
          {mainItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}

          {canSeeAdminArea && (
            <>
              <div className="mt-4 px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Admin</div>
              {adminItems.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </>
          )}
        </nav>

        <div className="mt-auto p-4 border-t border-slate-200">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            Sair
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar desktop */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:z-40 lg:flex lg:w-64 lg:flex-col border-r border-slate-200 bg-white">
        <Sidebar />
      </aside>

      {/* Header mobile */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200 lg:hidden">
        <div className="h-14 px-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMobileNavOpen((v) => !v)}
            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 py-2 text-slate-700"
            aria-label="Abrir menu"
          >
            {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>

          <Link href={inAdminArea ? '/admin' : '/dashboard'} className="flex items-center">
            <Image src="/logo.png" alt="MoovePay" width={140} height={40} className="h-8 w-auto" priority />
          </Link>

          <Button variant="ghost" onClick={handleLogout} className="text-red-600 hover:text-red-700 hover:bg-red-50">
            Sair
          </Button>
        </div>

        {mobileNavOpen && (
          <div className="border-t border-slate-200 bg-white">
            <div className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">{user?.name || 'Conta'}</div>
                  <div className="text-xs text-slate-500 truncate">{user?.email || ''}</div>
                </div>
                <Badge variant={role === 'admin' ? 'success' : role === 'support' ? 'secondary' : role === 'finance' ? 'warning' : 'outline'}>
                  {role}
                </Badge>
              </div>
            </div>

            <nav className="px-3 pb-3 space-y-1">
              {mainItems.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
              {canSeeAdminArea && adminItems.length > 0 && (
                <>
                  <div className="mt-3 px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Admin</div>
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
