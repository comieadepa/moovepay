'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ArrowUpRight,
  Calendar,
  DollarSign,
  Eye,
  Plus,
  Settings,
  TrendingUp,
  Users,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type PaymentLite = {
  value: number | string | null
  status: string | null
}

type EventLite = {
  id: string
  name: string
  status: string
  startDate?: string | null
  createdAt?: string | null
  registrations?: { id: string }[]
  payments?: PaymentLite[]
}

type DashboardStats = {
  totalEvents: number
  totalRegistrations: number
  totalRevenue: number
  availableBalance: number
  pendingWithdrawals: number
  recentEvents: Array<{
    id: string
    name: string
    status: string
    date: string
    registrations: number
    revenue: number
  }>
}

export default function DashboardPage() {
  const router = useRouter()
  const [userData, setUserData] = useState<any>(null)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<DashboardStats>({
    totalEvents: 0,
    totalRegistrations: 0,
    totalRevenue: 0,
    availableBalance: 0,
    pendingWithdrawals: 0,
    recentEvents: [],
  })

  const moneyFormatter = useMemo(() => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }, [])

  useEffect(() => {
    let active = true

    const raw = localStorage.getItem('user')
    if (raw) {
      try {
        setUserData(JSON.parse(raw))
        return
      } catch {
        // ignora
      }
    }

    // Fallback: carrega do servidor (ex.: primeiro acesso após OAuth)
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active) return
        const u = data?.user
        if (!u) return
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
        setUserData(u)
      })
      .catch(() => {
        // ignora
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadDashboard() {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch('/api/events', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (response.status === 401) {
          router.push('/login')
          return
        }

        const data = await response.json()
        if (!response.ok) {
          throw new Error(data?.error || 'Erro ao carregar dashboard')
        }

        const events = (data?.events || []) as EventLite[]

        const totalEvents = events.length
        const totalRegistrations = events.reduce(
          (sum, event) => sum + (event.registrations?.length || 0),
          0
        )

        const totalRevenue = events.reduce((sum, event) => {
          const received = (event.payments || []).filter((p) => p?.status === 'received')
          const eventRevenue = received.reduce((s, p) => s + Number(p?.value || 0), 0)
          return sum + eventRevenue
        }, 0)

        const recentEvents = events.slice(0, 5).map((event) => {
          const received = (event.payments || []).filter((p) => p?.status === 'received')
          const revenue = received.reduce((s, p) => s + Number(p?.value || 0), 0)

          const baseDate = event.startDate || event.createdAt
          const date = baseDate
            ? format(new Date(baseDate), 'dd MMM yyyy', { locale: ptBR })
            : ''

          return {
            id: event.id,
            name: event.name,
            status: event.status,
            date,
            registrations: event.registrations?.length || 0,
            revenue,
          }
        })

        if (!isMounted) return

        setStats({
          totalEvents,
          totalRegistrations,
          totalRevenue,
          availableBalance: totalRevenue,
          pendingWithdrawals: 0,
          recentEvents,
        })
      } catch (e: any) {
        if (!isMounted) return
        setError(e?.message || 'Erro ao carregar dashboard')
      } finally {
        if (!isMounted) return
        setIsLoading(false)
      }
    }

    loadDashboard()

    return () => {
      isMounted = false
    }
  }, [router])

  const handleWithdrawRequest = () => {
    if (withdrawAmount && parseFloat(withdrawAmount) > 0) {
      console.log('Solicitação de saque:', withdrawAmount)
      setShowWithdrawModal(false)
      setWithdrawAmount('')
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2">
          Bem-vindo, {userData?.name || 'Usuário'}!
        </h1>
        <p className="text-slate-600">
          Aqui você pode gerenciar seus eventos, inscrições e finanças
        </p>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 text-red-700">{error}</CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Link href="/eventos/novo">
          <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white hover:shadow-lg transition cursor-pointer">
            <CardContent className="pt-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">Criar Novo Evento</h3>
                  <p className="text-slate-600 mt-1">Comece um novo evento em poucos minutos</p>
                </div>
                <Plus className="w-12 h-12 text-emerald-600" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/eventos">
          <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white hover:shadow-lg transition cursor-pointer">
            <CardContent className="pt-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">Meus Eventos</h3>
                  <p className="text-slate-600 mt-1">Veja e gerencie todos os seus eventos</p>
                </div>
                <Eye className="w-12 h-12 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="text-sm">Total de Eventos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-slate-900">
                {isLoading ? '—' : stats.totalEvents}
              </div>
              <Calendar className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="text-sm">Total de Inscrições</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-blue-600">
                {isLoading ? '—' : stats.totalRegistrations}
              </div>
              <Users className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="text-sm">Receita Total</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-green-600">
                {isLoading ? '—' : moneyFormatter.format(stats.totalRevenue)}
              </div>
              <DollarSign className="w-8 h-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-emerald-200">
          <CardHeader className="pb-3">
            <CardDescription className="text-sm font-semibold">Saldo Disponível</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-emerald-600">
                {isLoading ? '—' : moneyFormatter.format(stats.availableBalance)}
              </div>
              <TrendingUp className="w-8 h-8 text-emerald-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Meu Perfil</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-slate-600">Nome</p>
                <p className="font-semibold text-slate-900">{userData?.name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Email</p>
                <p className="font-semibold text-slate-900">{userData?.email || 'N/A'}</p>
              </div>
              <Button variant="outline" className="w-full" size="sm" onClick={() => router.push('/perfil')}>
                <Settings className="w-4 h-4 mr-2" />
                Editar Perfil
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Eventos Recentes</CardTitle>
              <CardDescription>Seus últimos eventos criados</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-10 text-slate-500">Carregando...</div>
              ) : stats.recentEvents.length === 0 ? (
                <div className="text-center py-10">
                  <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 mb-4">Você ainda não criou nenhum evento</p>
                  <Link href="/eventos/novo">
                    <Button className="bg-emerald-600 hover:bg-emerald-700">Criar Primeiro Evento</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {stats.recentEvents.map((event: any) => (
                    <div key={event.id} className="border rounded-lg p-4 hover:bg-slate-50 transition">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold text-slate-900">{event.name}</h4>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            event.status === 'published'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {event.status === 'published' ? 'Publicado' : 'Rascunho'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mb-3">{event.date}</p>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-slate-600">Inscrições</p>
                          <p className="font-semibold text-slate-900">{event.registrations}</p>
                        </div>
                        <div>
                          <p className="text-slate-600">Receita</p>
                          <p className="font-semibold text-slate-900">{moneyFormatter.format(event.revenue)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Financeiro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white p-3 rounded-lg border">
              <p className="text-xs text-slate-600 mb-1">Saldo Disponível</p>
              <p className="text-2xl font-bold text-emerald-600">
                {isLoading ? '—' : moneyFormatter.format(stats.availableBalance)}
              </p>
            </div>

            {stats.pendingWithdrawals > 0 && (
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                <p className="text-xs text-amber-600 mb-1">Saques em Processamento</p>
                <p className="font-semibold text-amber-900">
                  {stats.pendingWithdrawals} solicitação(ões)
                </p>
              </div>
            )}

            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setShowWithdrawModal(true)}
              disabled={isLoading || stats.availableBalance === 0}
            >
              <ArrowUpRight className="w-4 h-4 mr-2" />
              Solicitar Saque
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">📊 Relatórios</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 text-sm mb-4">Acesse relatórios detalhados de seus eventos</p>
            <Button variant="outline" className="w-full" size="sm">
              Visualizar Relatórios
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">💬 Suporte</CardTitle>
          </CardHeader>
          <CardContent>
              <p className="text-slate-600 text-sm mb-4">Abra um ticket e acompanhe o atendimento</p>
              <Link href="/suporte">
                <Button variant="outline" className="w-full" size="sm">
                  Abrir Tickets
                </Button>
              </Link>
          </CardContent>
        </Card>
      </div>

      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Solicitar Saque</CardTitle>
              <CardDescription>Digite o valor que deseja sacar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-slate-600 mb-2">Saldo Disponível</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {moneyFormatter.format(stats.availableBalance)}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Valor a Sacar</label>
                <input
                  type="number"
                  placeholder="0,00"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  max={stats.availableBalance}
                  step="0.01"
                />
              </div>

              <p className="text-xs text-slate-500">
                O saque será processado em até 2 dias úteis para sua conta bancária
              </p>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowWithdrawModal(false)
                    setWithdrawAmount('')
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleWithdrawRequest}
                  disabled={!withdrawAmount || parseFloat(withdrawAmount) === 0}
                >
                  Confirmar Saque
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
