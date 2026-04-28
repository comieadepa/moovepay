import { NextRequest, NextResponse } from 'next/server'
import { hashPassword } from '@/lib/auth'
import { signUpSchema } from '@/lib/validations'
import { getUserByEmail, createUser, supabase } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    console.log('[API SIGNUP] Recebendo requisição de signup')
    const body = await request.json()
    console.log('[API SIGNUP] Body:', { email: body.email, name: body.name })

    // Validar com Zod
    const validatedData = signUpSchema.parse(body)
    console.log('[API SIGNUP] Dados validados')

    // Verificar se email já existe
    console.log('[API SIGNUP] Verificando se email já existe...')
    const existingUser = await getUserByEmail(validatedData.email)

    if (existingUser) {
      console.log('[API SIGNUP] Email já cadastrado')
      return NextResponse.json(
        { error: 'Email já cadastrado' },
        { status: 400 }
      )
    }

    console.log('[API SIGNUP] Fazendo hash da senha...')
    // Hash da senha
    const hashedPassword = await hashPassword(validatedData.password)

    console.log('[API SIGNUP] Criando usuário no banco...')
    // Criar usuário
    const user = await createUser({
      email: validatedData.email,
      name: validatedData.name,
      password: hashedPassword,
    })

    console.log('[API SIGNUP] Usuário criado com sucesso:', user.id)

    // Multi-tenant: cria Tenant + membership owner + defaultTenantId (best-effort)
    // Multi-tenant: cria Tenant + membership owner + defaultTenantId
    const { error: tenantError } = await supabase
      .from('Tenant')
      .upsert({ id: user.id, name: user.name }, { onConflict: 'id' })
    if (tenantError) console.warn('[API SIGNUP] Tenant upsert:', tenantError.message)

    const { error: memberError } = await supabase
      .from('TenantMember')
      .upsert({ tenantId: user.id, userId: user.id, role: 'owner' }, { onConflict: 'tenantId,userId' })
    if (memberError) console.warn('[API SIGNUP] TenantMember upsert:', memberError.message)

    const { error: updateError } = await supabase
      .from('User')
      .update({ defaultTenantId: user.id })
      .eq('id', user.id)
    if (updateError) console.warn('[API SIGNUP] defaultTenantId update:', updateError.message)

    return NextResponse.json(
      {
        message: 'Usuário criado com sucesso',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('[API SIGNUP] Erro completo:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack,
    })

    // Validação do Zod
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Erro ao criar usuário', details: error.message },
      { status: 500 }
    )
  }
}
