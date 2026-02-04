import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/rbac'
import { supabase } from '@/lib/supabase-server'
import { hashPassword } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const createStaffUserSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'support', 'finance']),
})

export async function GET(request: NextRequest) {
  try {
    const ctx = getAuthContext(request)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (ctx.role !== 'admin') return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

    const { data, error } = await supabase
      .from('User')
      .select('id, name, email, role, createdAt, updatedAt')
      .in('role', ['admin', 'support', 'finance'])
      .order('createdAt', { ascending: false })

    if (error) throw error

    return NextResponse.json({ success: true, users: data || [] }, { status: 200 })
  } catch (e) {
    console.error('Erro ao listar usuários admin:', e)
    return NextResponse.json({ error: 'Erro ao listar usuários' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = getAuthContext(request)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (ctx.role !== 'admin') return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

    const body = await request.json()
    const input = createStaffUserSchema.parse(body)

    const existing = await supabase.from('User').select('id').eq('email', input.email).maybeSingle()
    if (existing.data?.id) {
      return NextResponse.json({ error: 'Email já cadastrado' }, { status: 400 })
    }

    const passwordHash = await hashPassword(input.password)

    const { data, error } = await supabase
      .from('User')
      .insert({
        name: input.name,
        email: input.email,
        password: passwordHash,
        role: input.role,
      })
      .select('id, name, email, role')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, user: data }, { status: 201 })
  } catch (e: any) {
    console.error('Erro ao criar usuário admin:', e)

    if (e?.name === 'ZodError') {
      return NextResponse.json({ error: 'Dados inválidos', details: e.errors }, { status: 400 })
    }

    return NextResponse.json({ error: 'Erro ao criar usuário' }, { status: 500 })
  }
}
