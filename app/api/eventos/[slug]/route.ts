import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    // Buscar evento por ID, slug ou nome
    const { data: event, error } = await supabase
      .from('Event')
      .select('*')
      .or(`id.eq.${params.slug},slug.eq.${params.slug},name.eq.${params.slug}`)
      .eq('status', 'published')
      .single()

    if (error || !event) {
      return NextResponse.json(
        { error: 'Evento não encontrado' },
        { status: 404 }
      )
    }

    // Tipos de inscrição do evento
    const { data: inscriptionTypes, error: typesError } = await supabase
      .from('InscriptionType')
      .select('*')
      .eq('eventId', event.id)
      .order('createdAt', { ascending: true })

    if (typesError) throw typesError

    // Criador
    const { data: creator } = await supabase
      .from('User')
      .select('id, name, email')
      .eq('id', event.creatorId)
      .single()

    // Totais por tipo e total do evento
    const enrichedTypes = await Promise.all(
      (inscriptionTypes ?? []).map(async (type: any) => {
        const { count } = await supabase
          .from('Registration')
          .select('*', { count: 'exact', head: true })
          .eq('inscriptionTypeId', type.id)
          .neq('status', 'cancelled')
        return {
          ...type,
          current: count ?? 0,
        }
      })
    )

    const totalRegistrations = enrichedTypes.reduce(
      (acc, type) => acc + (type.current ?? 0),
      0
    )

    // Normalizar payload para o formato que o client espera
    const data = {
      ...event,
      bannerUrl: event.banner ?? '',
      shortDescription: event.description ?? '',
      location: event.location ?? '',
      eventFormat: event.eventFormat ?? '',
      customFields: event.customFields ?? [],
      creator,
      inscriptionTypes: enrichedTypes,
      totalRegistrations,
    }

    return NextResponse.json({ success: true, data }, { status: 200 })
  } catch (error) {
    console.error('Erro ao buscar evento:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar evento' },
      { status: 500 }
    )
  }
}
