import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { updateSupportTicketSchema } from '@/lib/validations'
import { supabase } from '@/lib/supabase-server'
import { isTenantMember } from '@/lib/rbac'

function dbNotReady(error: any) {
  const message = String(error?.message || '')
  return message.includes('relation') && message.includes('SupportTicket')
}

function dbNotReadyResponse() {
  return NextResponse.json(
    {
      error: 'Sistema de suporte ainda não configurado no banco.',
      hint: 'Aplique a migration supabase/migrations/20260203000000_support_tickets.sql no Supabase.',
    },
    { status: 500 }
  )
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const verified = verifyToken(token)
    if (!verified) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const tenantId = verified.tenantId || verified.userId
    const member = await isTenantMember(tenantId, verified.userId)
    if (!member) return NextResponse.json({ error: 'Não autorizado (tenant)' }, { status: 403 })

    const { data: ticket, error: ticketError } = await supabase
      .from('SupportTicket')
      .select('*')
      .eq('id', params.id)
      .single()

    if (ticketError) {
      if (dbNotReady(ticketError)) return dbNotReadyResponse()
      return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 })
    }

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 })
    }

    if ((ticket as any).tenantId && (ticket as any).tenantId !== tenantId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const { data: messages, error: messageError } = await supabase
      .from('SupportTicketMessage')
      .select('*')
      .eq('ticketId', params.id)
      .order('createdAt', { ascending: true })

    if (messageError) {
      if (dbNotReady(messageError)) return dbNotReadyResponse()
      throw messageError
    }

    return NextResponse.json(
      { success: true, ticket, messages: messages || [] },
      { status: 200 }
    )
  } catch (error) {
    console.error('Erro ao buscar ticket:', error)
    return NextResponse.json({ error: 'Erro ao buscar ticket' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const verified = verifyToken(token)
    if (!verified) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const tenantId = verified.tenantId || verified.userId
    const member = await isTenantMember(tenantId, verified.userId)
    if (!member) return NextResponse.json({ error: 'Não autorizado (tenant)' }, { status: 403 })

    const { data: ticket, error: ticketError } = await supabase
      .from('SupportTicket')
      .select('*')
      .eq('id', params.id)
      .single()

    if (ticketError) {
      if (dbNotReady(ticketError)) return dbNotReadyResponse()
      return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 })
    }

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 })
    }

    if ((ticket as any).tenantId && (ticket as any).tenantId !== tenantId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const validated = updateSupportTicketSchema.parse(body)

    if (validated.message && validated.message.trim().length > 0) {
      const { error: messageError } = await supabase.from('SupportTicketMessage').insert({
        ticketId: params.id,
        sender: 'user',
        message: validated.message.trim(),
      })
      if (messageError) {
        if (dbNotReady(messageError)) return dbNotReadyResponse()
        throw messageError
      }
    }

    const patch: Record<string, any> = {}
    if (validated.status) patch.status = validated.status
    if (validated.priority) patch.priority = validated.priority

    let updatedTicket = ticket
    if (Object.keys(patch).length > 0) {
      const { data: updated, error: updateError } = await supabase
        .from('SupportTicket')
        .update(patch)
        .eq('id', params.id)
        .select()
        .single()

      if (updateError) {
        if (dbNotReady(updateError)) return dbNotReadyResponse()
        throw updateError
      }
      updatedTicket = updated
    }

    return NextResponse.json({ success: true, ticket: updatedTicket }, { status: 200 })
  } catch (error: any) {
    console.error('Erro ao atualizar ticket:', error)

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'Erro ao atualizar ticket' }, { status: 500 })
  }
}
