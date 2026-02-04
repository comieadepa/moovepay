import { NextRequest, NextResponse } from 'next/server'

import { verifyToken } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import { profileUpdateSchema } from '@/lib/validations'

export const dynamic = 'force-dynamic'

function dbNeedsMigration(error: unknown) {
  const msg = String((error as any)?.message || '')
  return msg.includes('does not exist') && (msg.includes('avatarUrl') || msg.includes('address'))
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const verified = verifyToken(token)
    if (!verified) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const { data: user, error } = await supabase
      .from('User')
      .select('id, email, name, role, defaultTenantId, cpf, whatsapp, avatarUrl, address')
      .eq('id', verified.userId)
      .single()

    if (error || !user) {
      if (dbNeedsMigration(error)) {
        return NextResponse.json(
          { error: 'Banco desatualizado. Aplique as migrations do Supabase (avatarUrl/address).' },
          { status: 500 }
        )
      }

      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: (user as any).role || 'user',
          defaultTenantId: (user as any).defaultTenantId || user.id,
          cpf: (user as any).cpf,
          whatsapp: (user as any).whatsapp,
          avatarUrl: (user as any).avatarUrl,
          address: (user as any).address,
        },
      },
      { status: 200 }
    )
  } catch (e) {
    console.error('Erro em /api/auth/profile (GET):', e)
    return NextResponse.json({ error: 'Erro ao buscar perfil' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const verified = verifyToken(token)
    if (!verified) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const data = profileUpdateSchema.parse(body)

    const payload: any = {}
    if (typeof data.name !== 'undefined') payload.name = data.name
    if (typeof data.whatsapp !== 'undefined') payload.whatsapp = data.whatsapp
    if (typeof data.avatarUrl !== 'undefined') payload.avatarUrl = data.avatarUrl
    if (typeof data.address !== 'undefined') payload.address = data.address

    const { data: user, error } = await supabase
      .from('User')
      .update(payload)
      .eq('id', verified.userId)
      .select('id, email, name, role, defaultTenantId, cpf, whatsapp, avatarUrl, address')
      .single()

    if (error || !user) {
      if (dbNeedsMigration(error)) {
        return NextResponse.json(
          { error: 'Banco desatualizado. Aplique as migrations do Supabase (avatarUrl/address).' },
          { status: 500 }
        )
      }

      return NextResponse.json({ error: 'Erro ao atualizar perfil' }, { status: 500 })
    }

    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: (user as any).role || 'user',
          defaultTenantId: (user as any).defaultTenantId || user.id,
          cpf: (user as any).cpf,
          whatsapp: (user as any).whatsapp,
          avatarUrl: (user as any).avatarUrl,
          address: (user as any).address,
        },
      },
      { status: 200 }
    )
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return NextResponse.json({ error: 'Dados inválidos', details: e.errors }, { status: 400 })
    }

    console.error('Erro em /api/auth/profile (PUT):', e)
    return NextResponse.json({ error: 'Erro ao atualizar perfil' }, { status: 500 })
  }
}
