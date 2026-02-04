import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { createEventSchema } from '@/lib/validations'
import { supabase } from '@/lib/supabase-server'
import { isTenantMember } from '@/lib/rbac'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar autenticação
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const verified = verifyToken(token)
    if (!verified) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    const tenantId = verified.tenantId || verified.userId
    const member = await isTenantMember(tenantId, verified.userId)
    if (!member) {
      return NextResponse.json({ error: 'Não autorizado (tenant)' }, { status: 403 })
    }

    const { data: event, error } = await supabase
      .from('Event')
      .select(`
        *,
        registrations:Registration(*),
        payments:Payment(*),
        inscriptionTypes:InscriptionType(*)
      `)
      .eq('id', params.id)
      .single()

    if (error || !event) {
      return NextResponse.json(
        { error: 'Evento não encontrado' },
        { status: 404 }
      )
    }

    // Verificar tenant
    if ((event as any).tenantId && (event as any).tenantId !== tenantId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 403 }
      )
    }

    return NextResponse.json({ success: true, event }, { status: 200 })
  } catch (error) {
    console.error('Erro ao buscar evento:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar evento' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar autenticação
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const verified = verifyToken(token)
    if (!verified) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

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
      return NextResponse.json(
        { error: 'Evento não encontrado' },
        { status: 404 }
      )
    }

    // Verificar tenant
    if ((event as any).tenantId && (event as any).tenantId !== tenantId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = createEventSchema.parse(body)

    const { data: updatedEvent, error: updateError } = await supabase
      .from('Event')
      .update(validatedData)
      .eq('id', params.id)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json(
      { success: true, message: 'Evento atualizado', event: updatedEvent },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Erro ao atualizar evento:', error)

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Erro ao atualizar evento' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar autenticação
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const verified = verifyToken(token)
    if (!verified) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    const tenantId = verified.tenantId || verified.userId
    const member = await isTenantMember(tenantId, verified.userId)
    if (!member || !['owner', 'admin'].includes(member.role)) {
      return NextResponse.json({ error: 'Não autorizado (tenant)' }, { status: 403 })
    }

    const { data: event, error: fetchError } = await supabase
      .from('Event')
      .select('id, creatorId')
      .eq('id', params.id)
      .single()

    if (fetchError || !event) {
      return NextResponse.json(
        { error: 'Evento não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se o usuário tem acesso ao tenant do evento
    const { data: eventTenant } = await supabase
      .from('Event')
      .select('tenantId')
      .eq('id', params.id)
      .single()

    if (eventTenant?.tenantId && eventTenant.tenantId !== tenantId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 403 }
      )
    }

    const { error: deleteError } = await supabase
      .from('Event')
      .delete()
      .eq('id', params.id)

    if (deleteError) throw deleteError

    return NextResponse.json(
      { success: true, message: 'Evento deletado' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Erro ao deletar evento:', error)
    return NextResponse.json(
      { error: 'Erro ao deletar evento' },
      { status: 500 }
    )
  }
}
