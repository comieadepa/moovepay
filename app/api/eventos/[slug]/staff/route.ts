import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabase } from '@/lib/supabase-server'
import { getAuthContext } from '@/lib/rbac'

// GET /api/eventos/[slug]/staff — lista links de check-in do evento
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
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

  const { data, error } = await supabase
    .from('EventCheckInLink')
    .select('id, label, createdAt, revokedAt')
    .eq('eventId', event.id)
    .order('createdAt', { ascending: true })

  if (error) return NextResponse.json({ error: 'Erro ao buscar links' }, { status: 500 })

  return NextResponse.json({ success: true, data })
}

// POST /api/eventos/[slug]/staff — cria link de check-in com senha
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
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

  // Verifica se o evento tem ao menos um tipo de inscrição pago
  const { data: paidTypes } = await supabase
    .from('InscriptionType')
    .select('id')
    .eq('eventId', event.id)
    .gt('value', 0)
    .limit(1)

  if (!paidTypes || paidTypes.length === 0) {
    return NextResponse.json(
      { error: 'Links de check-in estão disponíveis apenas para eventos pagos' },
      { status: 422 }
    )
  }

  let body: { label?: string; password?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Body inválido' }, { status: 400 }) }

  const label = (body.label ?? '').trim()
  if (!label) return NextResponse.json({ error: 'Email/nome obrigatório' }, { status: 400 })

  const password = (body.password ?? '').trim()
  if (password.length < 4) return NextResponse.json({ error: 'Senha deve ter ao menos 4 caracteres' }, { status: 400 })

  const passwordHash = await bcrypt.hash(password, 10)

  const { data: link, error } = await supabase
    .from('EventCheckInLink')
    .insert({ eventId: event.id, label, passwordHash })
    .select('id, label, createdAt, revokedAt')
    .single()

  if (error) return NextResponse.json({ error: 'Erro ao criar link' }, { status: 500 })

  return NextResponse.json({ success: true, data: link }, { status: 201 })
}
