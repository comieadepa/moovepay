import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'
import { hashCheckInToken, calculateEventExpiration } from '@/lib/checkin-token'

// GET /api/c/[token]/info — informações públicas do evento para a interface de check-in móvel
export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = params.token?.trim()
  if (!token) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
  }

  const tokenHash = hashCheckInToken(token)

  // Busca preferencialmente por tokenHash; fallback por id para retrocompatibilidade
  let linkQuery = supabase
    .from('EventCheckInLink')
    .select('id, label, revokedAt, passwordHash, event:Event(id, name, startDate, endDate, status)')
    .eq('tokenHash', tokenHash)
    .maybeSingle()

  let { data: link } = await linkQuery

  if (!link) {
    const { data: legacyLink } = await supabase
      .from('EventCheckInLink')
      .select('id, label, revokedAt, passwordHash, event:Event(id, name, startDate, endDate, status)')
      .eq('id', token)
      .maybeSingle()
    link = legacyLink
  }

  if (!link) {
    return NextResponse.json({ error: 'Link de check-in inválido ou inexistente' }, { status: 404 })
  }

  if (link.revokedAt) {
    return NextResponse.json({ error: 'Este link foi revogado pelo organizador' }, { status: 403 })
  }

  const event = Array.isArray(link.event) ? link.event[0] : (link.event as any)
  if (!event) {
    return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
  }

  // Verifica expiração no fuso America/Sao_Paulo
  const { expired, expiresAtIso } = calculateEventExpiration(event.startDate, event.endDate)

  return NextResponse.json({
    success: true,
    data: {
      linkId: link.id,
      label: link.label,
      requiresPassword: Boolean(link.passwordHash),
      expired,
      expiresAt: expiresAtIso,
      event: {
        id: event.id,
        name: event.name,
        startDate: event.startDate,
        endDate: event.endDate,
        status: event.status,
      },
    },
  })
}
