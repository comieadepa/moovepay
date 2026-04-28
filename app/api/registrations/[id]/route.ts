import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabase } from '@/lib/supabase-server'
import { getAuthContext } from '@/lib/rbac'

const updateRegistrationSchema = z.object({
  fullName: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres').optional(),
  email: z.string().email('Email inválido').optional(),
  whatsapp: z.string().optional(),
  cpf: z.string().optional(),
  customData: z.record(z.any()).optional(),
  // Apenas transições controladas de status são permitidas
  status: z.enum(['paid', 'cancelled']).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 })
  }

  let validated: z.infer<typeof updateRegistrationSchema>
  try {
    validated = updateRegistrationSchema.parse(body)
  } catch (e: any) {
    return NextResponse.json({ error: 'Dados inválidos', details: e.errors }, { status: 400 })
  }

  // Buscar inscrição com info do evento para checar ownership
  const { data: reg, error: regErr } = await supabase
    .from('Registration')
    .select('id, status, eventId, event:Event(tenantId, creatorId)')
    .eq('id', params.id)
    .maybeSingle()

  if (regErr || !reg) {
    return NextResponse.json({ error: 'Inscrição não encontrada' }, { status: 404 })
  }

  const event = Array.isArray(reg.event) ? reg.event[0] : (reg.event as any)
  const ownsEvent =
    event?.tenantId === ctx.tenantId ||
    event?.creatorId === ctx.userId

  if (!ownsEvent) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const updatePayload: Record<string, unknown> = {}
  if (validated.fullName !== undefined) updatePayload.fullName = validated.fullName
  if (validated.email !== undefined) updatePayload.email = validated.email
  if (validated.whatsapp !== undefined) updatePayload.whatsapp = validated.whatsapp
  if (validated.cpf !== undefined) updatePayload.cpf = validated.cpf
  if (validated.customData !== undefined) updatePayload.customData = validated.customData
  if (validated.status !== undefined) updatePayload.status = validated.status

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
  }

  const { data: updated, error: updateErr } = await supabase
    .from('Registration')
    .update(updatePayload)
    .eq('id', params.id)
    .select('*, inscriptionType:InscriptionType(*), event:Event(id, name, startDate)')
    .single()

  if (updateErr) {
    console.error('Erro ao atualizar inscrição:', updateErr)
    return NextResponse.json({ error: 'Erro ao atualizar inscrição' }, { status: 500 })
  }

  return NextResponse.json({ success: true, registration: updated })
}
