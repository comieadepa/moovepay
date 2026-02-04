import { NextRequest, NextResponse } from 'next/server'
import { getUserByEmail, createUser, supabase } from '@/lib/supabase-server'
import { generateToken, hashPassword } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function verifyIdToken(idToken: string, clientId: string) {
  const url = new URL('https://oauth2.googleapis.com/tokeninfo')
  url.searchParams.set('id_token', idToken)

  const res = await fetch(url.toString(), { cache: 'no-store' })
  const data = await res.json().catch(() => ({} as any))

  if (!res.ok) {
    const msg = data?.error_description || data?.error || 'Token inválido'
    throw new Error(msg)
  }

  if (data?.aud !== clientId) {
    throw new Error('Token com audience inválida')
  }

  const email = String(data?.email || '')
  const name = String(data?.name || '')

  if (!email) throw new Error('Email não encontrado no token')

  return { email, name }
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  const stateCookie = request.cookies.get('oauth_state')?.value

  if (!code || !state || !stateCookie || state !== stateCookie) {
    const res = NextResponse.redirect(new URL('/signup?error=google_state', request.url))
    res.cookies.set('oauth_state', '', { path: '/', maxAge: 0 })
    return res
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    const res = NextResponse.redirect(new URL('/signup?error=google_not_configured', request.url))
    res.cookies.set('oauth_state', '', { path: '/', maxAge: 0 })
    return res
  }

  const redirectUri = `${request.nextUrl.origin}/api/auth/google/callback`

  try {
    // Trocar code por tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
      cache: 'no-store',
    })

    const tokenData = await tokenRes.json().catch(() => ({} as any))
    if (!tokenRes.ok) {
      throw new Error(tokenData?.error_description || tokenData?.error || 'Falha ao autenticar com Google')
    }

    const idToken = String(tokenData?.id_token || '')
    if (!idToken) throw new Error('id_token ausente')

    const profile = await verifyIdToken(idToken, clientId)

    // Criar ou recuperar usuário
    let user = await getUserByEmail(profile.email)

    if (!user) {
      const randomPassword = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
      const hashedPassword = await hashPassword(randomPassword)

      user = await createUser({
        email: profile.email,
        name: profile.name || profile.email.split('@')[0],
        password: hashedPassword,
      })

      // Multi-tenant best-effort (mesmo padrão do signup)
      try {
        await supabase.from('Tenant').insert({ id: user.id, name: user.name })
        await supabase.from('TenantMember').insert({ tenantId: user.id, userId: user.id, role: 'owner' })
        await supabase.from('User').update({ defaultTenantId: user.id }).eq('id', user.id)
      } catch {
        // não bloquear
      }
    }

    const tenantId = (user as any).defaultTenantId || user.id
    const role = String((user as any).role || 'user')
    const token = generateToken(user.id, user.email, { tenantId, role })

    const needsCompletion = !String(user.name || '').trim() || !String((user as any).whatsapp || '').trim()

    const target = needsCompletion ? '/completar-cadastro' : '/dashboard'

    const res = NextResponse.redirect(new URL(target, request.url))

    // Limpa state
    res.cookies.set('oauth_state', '', { path: '/', maxAge: 0 })

    // Cookie auth da plataforma
    res.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    })

    return res
  } catch (e) {
    console.error('Erro no callback Google:', e)
    const res = NextResponse.redirect(new URL('/signup?error=google_oauth', request.url))
    res.cookies.set('oauth_state', '', { path: '/', maxAge: 0 })
    return res
  }
}
