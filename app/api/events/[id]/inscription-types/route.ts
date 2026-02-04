import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyToken } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import { isTenantMember } from '@/lib/rbac'

const upsertSchema = z.object({
  isFree: z.coerce.boolean().optional().default(false),
  value: z.coerce.number().min(0, 'Valor inválido').optional().default(0),
  name: z.string().min(1).optional().default('Inscrição'),
})

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
    if (!member || (member.id !== 'legacy' && !['owner', 'admin'].includes(member.role))) {
      return NextResponse.json({ error: 'Não autorizado (tenant)' }, { status: 403 })
    }

    // Confere evento/tenant
    const { data: event, error: eventError } = await supabase
      .from('Event')
      .select('id, tenantId')
      .eq('id', params.id)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
    }

    if ((event as any).tenantId && (event as any).tenantId !== tenantId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const validated = upsertSchema.parse(body)
    const value = validated.isFree ? 0 : validated.value

    // Pega o primeiro tipo existente para este evento.
    const { data: existingTypes, error: typesError } = await supabase
      .from('InscriptionType')
      .select('id')
      .eq('eventId', params.id)
      .order('createdAt', { ascending: true })
      .limit(1)

    if (typesError) throw typesError

    const existingId = existingTypes?.[0]?.id

    if (existingId) {
      const { data: updated, error: updateError } = await supabase
        .from('InscriptionType')
        .update({ name: validated.name, value })
        .eq('id', existingId)
        .select('*')
        .single()

      if (updateError) throw updateError
      return NextResponse.json({ success: true, inscriptionType: updated }, { status: 200 })
    }

    const { data: created, error: createError } = await supabase
      .from('InscriptionType')
      .insert({
        eventId: params.id,
        name: validated.name,
        value,
        status: 'active',
      })
      .select('*')
      .single()

    if (createError) throw createError

    return NextResponse.json({ success: true, inscriptionType: created }, { status: 201 })
  } catch (error: any) {
    console.error('Erro ao salvar tipo de inscrição:', error)

    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: 'Dados inválidos', details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: 'Erro ao salvar tipo de inscrição' }, { status: 500 })
  }
}
