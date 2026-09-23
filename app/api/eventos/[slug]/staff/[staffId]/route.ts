import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'
import { getAuthContext } from '@/lib/rbac'
import { generateCheckInToken, hashCheckInToken } from '@/lib/checkin-token'

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

  return NextResponse.json({ success: true, message: 'Link revogado com sucesso' })
}

// POST /api/eventos/[slug]/staff/[staffId] — regenera o link de check-in
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string; staffId: string } }
) {
  const ctx = getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: event } = await supabase
    .from('Event')
    .select('id, name, creatorId, tenantId')
    .eq('id', params.slug)
    .maybeSingle()

  if (!event) return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })

  const isOwner = event.creatorId === ctx.userId || event.tenantId === ctx.tenantId
  if (!isOwner) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  // Busca link anterior
  const { data: oldLink } = await supabase
    .from('EventCheckInLink')
    .select('id, label, passwordHash')
    .eq('id', params.staffId)
    .eq('eventId', event.id)
    .maybeSingle()

  if (!oldLink) return NextResponse.json({ error: 'Link original não encontrado' }, { status: 404 })

  // 1. Revoga o link antigo
  await supabase
    .from('EventCheckInLink')
    .update({ revokedAt: new Date().toISOString() })
    .eq('id', oldLink.id)

  // 2. Cria o novo link com novo token criptográfico
  const newToken = generateCheckInToken()
  const newTokenHash = hashCheckInToken(newToken)

  const { data: newLink, error: createErr } = await supabase
    .from('EventCheckInLink')
    .insert({
      eventId: event.id,
      label: oldLink.label,
      passwordHash: oldLink.passwordHash,
      tokenHash: newTokenHash,
    })
    .select('id, label, createdAt, revokedAt')
    .single()

  if (createErr || !newLink) {
    return NextResponse.json({ error: 'Erro ao regenerar link' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    data: {
      ...newLink,
      token: newToken,
      eventName: event.name,
    },
  })
}
