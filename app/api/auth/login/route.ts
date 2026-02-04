import { NextRequest, NextResponse } from 'next/server'
import { verifyPassword, generateToken } from '@/lib/auth'
import { loginSchema } from '@/lib/validations'
import { getUserByEmail } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validar com Zod
    const validatedData = loginSchema.parse(body)

    // Buscar usuário
    const user = await getUserByEmail(validatedData.email)

    if (!user) {
      return NextResponse.json(
        { error: 'Email ou senha inválidos' },
        { status: 401 }
      )
    }

    // Verificar senha
    const passwordMatch = await verifyPassword(validatedData.password, user.password)

    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Email ou senha inválidos' },
        { status: 401 }
      )
    }

    // Gerar JWT (inclui role e tenant padrão)
    const tenantId = (user as any).defaultTenantId || user.id
    const token = generateToken(user.id, user.email, { tenantId, role: (user as any).role || 'user' })

    const response = NextResponse.json(
      {
        success: true,
        message: 'Login realizado com sucesso',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: (user as any).role || 'user',
          defaultTenantId: tenantId,
        },
        token,
      },
      { status: 200 }
    )

    // Salvar token em cookie httpOnly
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 dias
      path: '/',
    })

    return response
  } catch (error: any) {
    console.error('Erro ao fazer login:', error)

    // Validação do Zod
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Erro ao fazer login' },
      { status: 500 }
    )
  }
}
