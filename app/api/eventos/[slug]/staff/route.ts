import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabase } from '@/lib/supabase-server'
import { getAuthContext } from '@/lib/rbac'
import { generateCheckInToken, hashCheckInToken } from '@/lib/checkin-token'

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
    .select('id, label, createdAt, revokedAt, lastUsedAt')
    .eq('eventId', event.id)
    .order('createdAt', { ascending: true })

  if (error) return NextResponse.json({ error: 'Erro ao buscar links' }, { status: 500 })

  return NextResponse.json({ success: true, data })
}

// POST /api/eventos/[slug]/staff — cria link de check-in com token criptográfico seguro
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
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

  let body: { label?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const label = (body.label ?? '').trim()
  if (!label) return NextResponse.json({ error: 'Identificador (nome/posto) é obrigatório' }, { status: 400 })

  // Senha opcional ou com mínimo de 4 caracteres se fornecida
  const password = (body.password ?? '').trim()
  let passwordHash: string | null = null
  if (password) {
    if (password.length < 4) {
      return NextResponse.json({ error: 'Senha deve ter ao menos 4 caracteres' }, { status: 400 })
    }
    passwordHash = await bcrypt.hash(password, 10)
  }

  // Gera token seguro e seu respectivo hash SHA-256
  const token = generateCheckInToken()
  const tokenHash = hashCheckInToken(token)

  const { data: link, error } = await supabase
    .from('EventCheckInLink')
    .insert({
      eventId: event.id,
      label,
      passwordHash,
      tokenHash,
    })
    .select('id, label, createdAt, revokedAt')
    .single()

  if (error) return NextResponse.json({ error: 'Erro ao criar link de portaria' }, { status: 500 })

  return NextResponse.json(
    {
      success: true,
      data: {
        ...link,
        token, // Retornado em claro apenas na criação para o organizador copiar/compartilhar
        eventName: event.name,
      },
    },
    { status: 201 }
  )
}
