'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Tenant = {
  id: string
  name: string
  createdAt: string
}

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        setIsLoading(true)
        setError(null)

        const res = await fetch('/api/admin/tenants')
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Erro ao carregar tenants')

        if (!mounted) return
        setTenants(data?.tenants || [])
      } catch (e: any) {
        if (!mounted) return
        setError(e?.message || 'Erro ao carregar tenants')
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
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Tenants</h1>
        <p className="text-slate-600">Lista de contas cadastradas</p>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 text-red-700">{error}</CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card><CardContent className="pt-6 text-slate-500">Carregando...</CardContent></Card>
      ) : tenants.length === 0 ? (
        <Card><CardContent className="pt-6 text-slate-500">Nenhum tenant encontrado.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {tenants.map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t.name}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                <div>Tenant ID: {t.id}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
