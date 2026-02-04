import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import { isTenantMember } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const verified = verifyToken(token)
    if (!verified) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const tenantId = verified.tenantId || verified.userId
    const member = await isTenantMember(tenantId, verified.userId)
    if (!member || !['owner', 'admin'].includes(member.role)) {
      return NextResponse.json({ error: 'Não autorizado (tenant)' }, { status: 403 })
    }

    const { data: event, error: fetchError } = await supabase
      .from('Event')
      .select('*')
      .eq('id', params.id)
      .single()

    if (fetchError || !event) {
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
    }

    if ((event as any).tenantId && (event as any).tenantId !== tenantId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const { data: updated, error: updateError } = await supabase
      .from('Event')
      .update({ status: 'published' })
      .eq('id', params.id)
      .select('*')
      .single()

    if (updateError) throw updateError

    return NextResponse.json({ success: true, event: updated }, { status: 200 })
  } catch (e) {
    console.error('Erro ao publicar evento:', e)
    return NextResponse.json({ error: 'Erro ao publicar evento' }, { status: 500 })
  }
}
