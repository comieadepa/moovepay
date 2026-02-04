'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { adminLoginSchema, type AdminLoginInput } from '@/lib/validations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

export default function AdminLoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<AdminLoginInput>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: { email: '', password: '', adminCode: '' },
  })

  async function onSubmit(data: AdminLoginInput) {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result?.error || 'Erro ao fazer login')
        return
      }

      if (result?.user) {
        localStorage.setItem('user', JSON.stringify(result.user))
      }

      router.push('/admin')
    } catch (err) {
      setError('Erro ao conectar com o servidor')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="relative flex items-center justify-center min-h-screen bg-cover bg-center bg-fixed"
      style={{ backgroundImage: `url('/img/bg_login.jpg')` }}
    >
      <div className="absolute inset-0 bg-slate-950/50" />
      <Card className="w-full max-w-md shadow-2xl relative z-10">
        <CardHeader>
          <CardTitle>Login da Equipe</CardTitle>
          <CardDescription>
            Acesso restrito ao painel administrativo (suporte/financeiro/admin)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="adminCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código do Admin</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Código de acesso da equipe" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="equipe@moovepay.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Entrando...' : 'Entrar no Admin'}
              </Button>
            </form>
          </Form>

          <div className="mt-6 border-t pt-4 space-y-2">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="w-full">
                Sou cliente (login normal)
              </Button>
            </Link>
            <Link href="/">
              <Button variant="ghost" size="sm" className="w-full text-blue-600 hover:text-blue-700">
                ← Voltar à home
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
