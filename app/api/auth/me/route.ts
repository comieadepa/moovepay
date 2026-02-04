import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

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
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    const normalized = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: (user as any).role || 'user',
      defaultTenantId: (user as any).defaultTenantId || user.id,
      cpf: (user as any).cpf,
      whatsapp: (user as any).whatsapp,
      avatarUrl: (user as any).avatarUrl,
      address: (user as any).address,
    }

    return NextResponse.json({ success: true, user: normalized }, { status: 200 })
  } catch (e) {
    console.error('Erro em /api/auth/me:', e)
    return NextResponse.json({ error: 'Erro ao buscar usuário' }, { status: 500 })
  }
}
