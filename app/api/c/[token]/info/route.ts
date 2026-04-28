import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'

// GET /api/c/[token]/info — informações públicas do evento para o link de check-in
export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  const { data: link } = await supabase
    .from('EventCheckInLink')
    .select('id, label, revokedAt, event:Event(id, name, startDate, endDate, status)')
    .eq('id', params.token)
    .maybeSingle()

  if (!link) {
    return NextResponse.json({ error: 'Link inválido ou inexistente' }, { status: 404 })
  }

  if (link.revokedAt) {
    return NextResponse.json({ error: 'Este link foi revogado pelo organizador' }, { status: 403 })
  }

  const event = Array.isArray(link.event) ? link.event[0] : (link.event as any)
  if (!event) {
    return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
  }

  // Verifica se o evento já encerrou (endDate + 24h de tolerância, ou startDate + 24h se sem endDate)
  const referenceDate = event.endDate ?? event.startDate
  const expiresAt = new Date(referenceDate).getTime() + 24 * 60 * 60 * 1000
  const expired = Date.now() > expiresAt

  return NextResponse.json({
    success: true,
    data: {
      linkId: link.id,
      label: link.label,
      expired,
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
