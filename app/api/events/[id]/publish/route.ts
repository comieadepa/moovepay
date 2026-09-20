import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'
import { isTenantMember } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

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
    if (!member || !['owner', 'admin'].includes(member.role)) {
      return NextResponse.json({ error: 'Não autorizado (tenant)' }, { status: 403 })
    }

    const { data: event, error: fetchError } = await supabase
      .from('Event')
      .select('*')
      .eq('id', params.id)
      .single()

    if (fetchError || !event) {
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
    }

    if ((event as any).tenantId && (event as any).tenantId !== tenantId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    // Validar se existem tipos de inscrição e se algum tipo pago está abaixo de R$ 5,00
    const { data: inscriptionTypes, error: typesError } = await supabase
      .from('InscriptionType')
      .select('id, name, value, status')
      .eq('eventId', params.id)

    if (typesError) throw typesError

    const invalidPaidType = (inscriptionTypes || []).find(
      (t: any) => Number(t.value) > 0 && Number(t.value) < 5
    )

    if (invalidPaidType) {
      return NextResponse.json(
        {
          error: `Não é possível publicar o evento: o tipo de inscrição "${invalidPaidType.name}" possui valor de R$ ${Number(invalidPaidType.value).toFixed(2)}, inferior ao mínimo permitido de R$ 5,00. Atualize o valor para pelo menos R$ 5,00 ou configure como gratuito.`,
        },
        { status: 400 }
      )
    }

    const { data: updated, error: updateError } = await supabase
      .from('Event')
      .update({ status: 'published' })
      .eq('id', params.id)
      .select('*')
      .single()

    if (updateError) throw updateError

    return NextResponse.json({ success: true, event: updated }, { status: 200 })
  } catch (e) {
    console.error('Erro ao publicar evento:', e)
    return NextResponse.json({ error: 'Erro ao publicar evento' }, { status: 500 })
  }
}
