'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function AdminHomePage() {
  const [role, setRole] = useState<string>('user')

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store', credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setRole(String(data?.user?.role || 'user'))
      })
      .catch(() => setRole('user'))
  }, [])

  const canSupport = role === 'admin' || role === 'support'
  const canFinance = role === 'admin' || role === 'finance'
  const canAdmin = role === 'admin'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Admin</h1>
        <p className="text-slate-600">Suporte, financeiro e tenants</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {canAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Tenants</CardTitle>
              <CardDescription>Empresas/contas cadastradas no sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/tenants">
                <Button variant="outline" className="w-full">Abrir</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {canSupport && (
          <Card>
            <CardHeader>
              <CardTitle>Tickets</CardTitle>
              <CardDescription>Atendimento e triagem de suporte</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/tickets">
                <Button variant="outline" className="w-full">Abrir</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {canFinance && (
          <Card>
            <CardHeader>
              <CardTitle>Financeiro</CardTitle>
              <CardDescription>Gestão da taxa de 10% (resumo)</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/finance">
                <Button variant="outline" className="w-full">Abrir</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {canAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Atendentes</CardTitle>
              <CardDescription>Usuários internos (suporte/finance/admin)</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/users">
                <Button variant="outline" className="w-full">Abrir</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

    </div>
  )
}
