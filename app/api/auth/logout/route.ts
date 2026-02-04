import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  const response = NextResponse.json({ ok: true }, { status: 200 })

  // Importante: o cookie `token` é setado com `sameSite: 'strict'` nas rotas de login.
  // Para evitar casos em que o navegador mantém o cookie após o primeiro clique, removemos
  // explicitamente com expires/maxAge e o mesmo path.
  response.cookies.set('token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  })

  return response
}
