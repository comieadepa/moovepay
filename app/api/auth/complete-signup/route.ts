import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { verifyToken } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const completeSignUpSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  whatsapp: z
    .string()
    .min(8, 'Celular deve ter pelo menos 8 caracteres')
    .transform((v) => v.trim()),
})

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const verified = verifyToken(token)
    if (!verified) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const body = await request.json()
    const data = completeSignUpSchema.parse(body)

    const { data: user, error } = await supabase
      .from('User')
      .update({
        name: data.name,
        whatsapp: data.whatsapp,
      })
      .eq('id', verified.userId)
      .select('id, email, name, role, defaultTenantId, cpf, whatsapp')
      .single()

    if (error || !user) {
      return NextResponse.json({ error: 'Erro ao atualizar usuário' }, { status: 500 })
    }

    const normalized = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: (user as any).role || 'user',
      defaultTenantId: (user as any).defaultTenantId || user.id,
      cpf: (user as any).cpf,
      whatsapp: (user as any).whatsapp,
    }

    return NextResponse.json({ success: true, user: normalized }, { status: 200 })
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return NextResponse.json({ error: 'Dados inválidos', details: e.errors }, { status: 400 })
    }

    console.error('Erro em /api/auth/complete-signup:', e)
    return NextResponse.json({ error: 'Erro ao completar cadastro' }, { status: 500 })
  }
}
