import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'
import { hashCheckInToken, calculateEventExpiration, maskCpf } from '@/lib/checkin-token'

// GET /api/c/[token]/search?q=... — busca manual de participantes para a portaria móvel
// Minimização estrita de dados e proteção contra enumeração
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = params.token?.trim()
  if (!token) {
    return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').trim()

  // Proteção contra enumeração: exige no mínimo 3 caracteres
  if (q.length < 3) {
    return NextResponse.json(
      { error: 'Informe ao menos 3 caracteres do nome ou CPF para buscar' },
      { status: 400 }
    )
  }

  const tokenHash = hashCheckInToken(token)

  // 1. Carrega link e evento
  let { data: link } = await supabase
    .from('EventCheckInLink')
    .select('id, revokedAt, event:Event(id, name, startDate, endDate)')
    .eq('tokenHash', tokenHash)
    .maybeSingle()

  if (!link) {
    const { data: legacyLink } = await supabase
      .from('EventCheckInLink')
      .select('id, revokedAt, event:Event(id, name, startDate, endDate)')
      .eq('id', token)
      .maybeSingle()
    link = legacyLink
  }

  if (!link || link.revokedAt) {
    return NextResponse.json({ error: 'Link de check-in inválido ou revogado' }, { status: 403 })
  }

  const event = Array.isArray(link.event) ? link.event[0] : (link.event as any)
  if (!event) {
    return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
  }

  // 2. Verifica expiração no fuso America/Sao_Paulo
  const { expired } = calculateEventExpiration(event.startDate, event.endDate)
  if (expired) {
    return NextResponse.json({ error: 'Evento encerrado — link expirado' }, { status: 403 })
  }

  // 3. Busca participantes restritos ao eventId
  const cleanDigits = q.replace(/\D/g, '')

  let query = supabase
    .from('Registration')
    .select(`
      id, fullName, cpf, status,
      inscriptionType:InscriptionType ( id, name ),
      voucher:Voucher ( id, used, usedAt )
    `)
    .eq('eventId', event.id)
    .limit(8)

  if (cleanDigits.length >= 3) {
    // Se digitou números, busca por CPF ou por nome
    query = query.or(`fullName.ilike.%${q}%,cpf.ilike.%${cleanDigits}%`)
  } else {
    query = query.ilike('fullName', `%${q}%`)
  }

  const { data: registrations, error: searchError } = await query

  if (searchError) {
    return NextResponse.json({ error: 'Erro ao pesquisar participantes' }, { status: 500 })
  }

  // 4. Minimização de dados pessoais
  const sanitized = (registrations || []).map((r: any) => {
    const inscriptionType = Array.isArray(r.inscriptionType) ? r.inscriptionType[0] : r.inscriptionType
    const voucher = Array.isArray(r.voucher) ? r.voucher[0] : r.voucher
    const isValid = r.status === 'paid' || r.status === 'confirmed'
    const isCheckedIn = voucher?.used === true

    return {
      id: r.id,
      fullName: r.fullName,
      maskedCpf: maskCpf(r.cpf),
      inscriptionTypeName: inscriptionType?.name || 'Inscrição',
      status: r.status,
      isValid,
      isCheckedIn,
      usedAt: voucher?.usedAt || null,
    }
  })

  return NextResponse.json({
    success: true,
    data: sanitized,
  })
}
