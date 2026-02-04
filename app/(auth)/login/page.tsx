'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
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

import { loginSchema, type LoginInput } from '@/lib/validations'
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

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  // Verificar params manualmente ao montar
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'true' && !showSuccess) {
      setShowSuccess(true)
    }
  }

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  async function onSubmit(data: LoginInput) {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })


      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Erro ao fazer login')
        return
      }

      if (result?.user) {
        localStorage.setItem('user', JSON.stringify(result.user))
      }

      router.push('/dashboard')
    } catch (err) {
      setError('Erro ao conectar com o servidor')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div 
      className="flex items-center justify-center min-h-screen bg-cover bg-center bg-fixed"
      style={{
        backgroundImage: `url('/img/bg_login.jpg')`,
      }}
    >
      <div className="absolute inset-0 bg-black/40"></div>
      <Card className="w-full max-w-md relative z-10 shadow-2xl">
        <CardHeader>
          <CardTitle>Fazer Login</CardTitle>
          <CardDescription>
            Entre com sua conta para acessar seus eventos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showSuccess && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">
              Conta criada com sucesso! Agora faça login.
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <a
              href="/api/auth/google"
              className="w-full inline-flex items-center justify-center gap-3 h-11 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50 transition"
            >
              <GoogleIcon />
              Login com o Google
            </a>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs text-slate-500">OU</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="seu@email.com"
                        {...field}
                      />
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
                      <Input
                        type="password"
                        placeholder="••••••••"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? 'Entrando...' : 'Fazer Login'}
              </Button>
            </form>
          </Form>

          <p className="mt-4 text-sm text-center text-slate-600">
            Não tem conta?{' '}
            <Link href="/signup" className="text-primary hover:underline">
              Crie uma agora
            </Link>
          </p>

          <p className="mt-2 text-sm text-center text-slate-600">
            Faz parte da equipe?{' '}
            <Link href="/admin/login" className="text-primary hover:underline">
              Acessar login do admin
            </Link>
          </p>

          <div className="mt-6 border-t pt-4">
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
