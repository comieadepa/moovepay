import { NextRequest, NextResponse } from 'next/server'
import { adminLoginSchema } from '@/lib/validations'
import { getUserByEmail } from '@/lib/supabase-server'
import { verifyPassword, generateToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const STAFF_ROLES = new Set(['admin', 'support', 'finance'])

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = adminLoginSchema.parse(body)

    const requiredAdminCode = process.env.ADMIN_ACCESS_CODE
    if (!requiredAdminCode) {
      console.error('[ADMIN LOGIN] ADMIN_ACCESS_CODE não configurado no ambiente')
      return NextResponse.json(
        { error: 'Código do admin não configurado. Contate o responsável técnico.' },
        { status: 500 }
      )
    }

    // Comparação com trim() para evitar problemas com espaços em branco
    console.log(`[ADMIN LOGIN DEBUG] Recebido: "${validatedData.adminCode}" | Esperado: "${requiredAdminCode}" | Recebido (trim): "${validatedData.adminCode.trim()}" | Esperado (trim): "${requiredAdminCode.trim()}"`)
    if (validatedData.adminCode.trim() !== requiredAdminCode.trim()) {
      console.error(`[ADMIN LOGIN] Código inválido: "${validatedData.adminCode.trim()}" != "${requiredAdminCode.trim()}"`)
      return NextResponse.json({ error: 'Código do admin inválido' }, { status: 401 })
    }

    const user = await getUserByEmail(validatedData.email)
    if (!user) {
      console.error(`[ADMIN LOGIN] Usuário não encontrado: ${validatedData.email}`)
      return NextResponse.json({ error: 'Email ou senha inválidos' }, { status: 401 })
    }

    console.log(`[ADMIN LOGIN] Usuário encontrado: ${user.id} | email: ${user.email}`)

    const passwordMatch = await verifyPassword(validatedData.password, (user as any).password)
    console.log(`[ADMIN LOGIN] Verificação de senha: ${passwordMatch ? 'OK' : 'FALHOU'}`)
    if (!passwordMatch) {
      console.error(`[ADMIN LOGIN] Senha incorreta para ${validatedData.email}`)
      return NextResponse.json({ error: 'Email ou senha inválidos' }, { status: 401 })
    }

    const role = String((user as any).role || 'user')
    console.log(`[ADMIN LOGIN] Role do usuário: ${role}`)
    if (!STAFF_ROLES.has(role)) {
      console.error(`[ADMIN LOGIN] Role inválida para staff: ${role}`)
      return NextResponse.json({ error: 'Acesso restrito à equipe administrativa' }, { status: 403 })
    }

    const tenantId = (user as any).defaultTenantId || user.id
    const token = generateToken(user.id, user.email, { tenantId, role })

    const response = NextResponse.json(
      {
        success: true,
        message: 'Login admin realizado com sucesso',
        user: {
          id: user.id,
          email: user.email,
          name: (user as any).name,
          role,
          defaultTenantId: tenantId,
        },
        token,
      },
      { status: 200 }
    )

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    })

    return response
  } catch (error: any) {
    console.error('Erro ao fazer login admin:', error)

    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: 'Dados inválidos', details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: 'Erro ao fazer login' }, { status: 500 })
  }
}
