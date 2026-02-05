import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function normalizeOrigin(origin: string) {
  return origin.replace(/\/+$/, '')
}

function getCanonicalOrigin(request: NextRequest) {
  const explicit =
    process.env.APP_ORIGIN ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_ORIGIN ||
    process.env.NEXT_PUBLIC_APP_URL

  if (explicit) return normalizeOrigin(explicit)

  if (process.env.VERCEL_URL) {
    return normalizeOrigin(`https://${process.env.VERCEL_URL}`)
  }

  return normalizeOrigin(request.nextUrl.origin)
}

function randomState() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  )
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID

  if (!clientId) {
    return NextResponse.redirect(new URL('/login?error=google_not_configured', request.url))
  }

  const canonicalOrigin = getCanonicalOrigin(request)
  if (canonicalOrigin && normalizeOrigin(request.nextUrl.origin) !== canonicalOrigin) {
    const canonicalUrl = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, canonicalOrigin)
    return NextResponse.redirect(canonicalUrl)
  }

  const state = randomState()
  const redirectUri = new URL('/api/auth/google/callback', canonicalOrigin).toString()

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', 'openid email profile')
  authUrl.searchParams.set('prompt', 'select_account')
  authUrl.searchParams.set('state', state)

  const res = NextResponse.redirect(authUrl)
  res.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60, // 10 min
  })

  return res
}
