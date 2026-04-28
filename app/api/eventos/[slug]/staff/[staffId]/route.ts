import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'
import { getAuthContext } from '@/lib/rbac'

// DELETE /api/eventos/[slug]/staff/[staffId] — revoga link de check-in
export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string; staffId: string } }
) {
  const ctx = getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: event } = await supabase
    .from('Event')
    .select('id, creatorId, tenantId')
    .eq('id', params.slug)
    .maybeSingle()

  if (!event) return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })

  const isOwner = event.creatorId === ctx.userId || event.tenantId === ctx.tenantId
  if (!isOwner) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { error } = await supabase
    .from('EventCheckInLink')
    .update({ revokedAt: new Date().toISOString() })
    .eq('id', params.staffId)
    .eq('eventId', event.id)

  if (error) return NextResponse.json({ error: 'Erro ao revogar link' }, { status: 500 })

  return NextResponse.json({ success: true })
}
