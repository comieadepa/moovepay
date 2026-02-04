import { type NextRequest, NextResponse } from 'next/server'

type JwtPayload = {
  userId: string
  email: string
  tenantId?: string
  role?: string
  exp?: number
}

const JWT_SECRET = process.env.JWT_SECRET || 'seu-secret-jwt'
const STAFF_ROLES = new Set(['admin', 'support', 'finance'])

function base64UrlToUint8Array(input: string) {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const raw = atob(padded)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

function base64UrlToString(input: string) {
  const bytes = base64UrlToUint8Array(input)
  return new TextDecoder().decode(bytes)
}

async function verifyJwtEdge(token: string): Promise<JwtPayload | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [headerB64, payloadB64, signatureB64] = parts
    const headerJson = base64UrlToString(headerB64)
    const header = JSON.parse(headerJson)
    if (header?.alg !== 'HS256') return null

    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    const signature = base64UrlToUint8Array(signatureB64)

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    const ok = await crypto.subtle.verify('HMAC', key, signature, data)
    if (!ok) return null

    const payloadJson = base64UrlToString(payloadB64)
    const payload = JSON.parse(payloadJson) as JwtPayload

    if (payload?.exp && Date.now() / 1000 >= payload.exp) return null
    if (!payload?.userId || !payload?.email) return null

    return payload
  } catch {
    return null
  }
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value
  const pathname = request.nextUrl.pathname

  console.log(`[MIDDLEWARE] Acessando: ${pathname}, Token: ${token ? 'existe' : 'não existe'}`)

  // Rotas que precisam autenticação (exceto durante build/static export)
  const isAdminLogin = pathname === '/admin/login'
  const isAdminArea = pathname.startsWith('/admin')

  const isProtectedRoute =
    (pathname.startsWith('/dashboard') || pathname.startsWith('/eventos') || pathname.startsWith('/suporte') || pathname.startsWith('/perfil') || (pathname.startsWith('/admin') && !isAdminLogin)) &&
    !pathname.includes('_next')

  if (isProtectedRoute) {
    const target = isAdminArea ? '/admin/login' : '/login'

    if (!token) {
      console.log(`[MIDDLEWARE] Redirecionando para ${target} - sem token`)
      return NextResponse.redirect(new URL(target, request.url))
    }

    const verified = await verifyJwtEdge(token)
    if (!verified) {
      console.log(`[MIDDLEWARE] Redirecionando para ${target} - token inválido/expirado`)
      const res = NextResponse.redirect(new URL(target, request.url))
      res.cookies.set('token', '', {
        path: '/',
        maxAge: 0,
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
      })
      return res
    }

    // RBAC de rota para /admin/*
    if (isAdminArea && !isAdminLogin) {
      const role = String(verified.role || 'user')
      if (!STAFF_ROLES.has(role)) {
        console.log('[MIDDLEWARE] Bloqueando /admin - role não autorizada')
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
  }

  // Se está logado e tenta acessar /admin/login, envia direto pro admin
  if (isAdminLogin && token) {
    const verified = await verifyJwtEdge(token)
    if (verified && STAFF_ROLES.has(String(verified.role || 'user'))) {
      console.log(`[MIDDLEWARE] Redirecionando para /admin - já logado (admin login)`)
      return NextResponse.redirect(new URL('/admin', request.url))
    }
  }

  // Se está logado e tenta acessar /login ou /signup, redireciona para dashboard
  if ((pathname === '/login' || pathname === '/signup') && token) {
    const verified = await verifyJwtEdge(token)
    if (verified) {
      console.log(`[MIDDLEWARE] Redirecionando para /dashboard - já logado`)
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  console.log(`[MIDDLEWARE] Permitindo acesso a ${pathname}`)
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
}
