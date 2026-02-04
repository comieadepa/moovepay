import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { createSupportTicketSchema } from '@/lib/validations'
import { supabase } from '@/lib/supabase-server'
import { isTenantMember } from '@/lib/rbac'

function dbNotReady(error: any) {
  const message = String(error?.message || '')
  return message.includes('relation') && message.includes('SupportTicket')
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const verified = verifyToken(token)
    if (!verified) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const tenantId = verified.tenantId || verified.userId
    const member = await isTenantMember(tenantId, verified.userId)

    // Se multi-tenant ainda não existe, cai no modo legado: lista por creatorId.
    const legacyMode = member?.id === 'legacy'
    if (!member && !legacyMode) return NextResponse.json({ error: 'Não autorizado (tenant)' }, { status: 403 })

    const { data: tickets, error } = await supabase
      .from('SupportTicket')
      .select('*')
      // se tiver multi-tenant: tenantId; se não: creatorId
      .eq(legacyMode ? 'creatorId' : 'tenantId', legacyMode ? verified.userId : tenantId)
      .order('updatedAt', { ascending: false })

    if (error) {
      if (dbNotReady(error)) {
        return NextResponse.json(
          {
            error: 'Sistema de suporte ainda não configurado no banco.',
            hint: 'Aplique a migration supabase/migrations/20260203000000_support_tickets.sql no Supabase.',
          },
          { status: 500 }
        )
      }
      throw error
    }

    return NextResponse.json({ success: true, tickets: tickets || [] }, { status: 200 })
  } catch (error) {
    console.error('Erro ao listar tickets:', error)
    return NextResponse.json({ error: 'Erro ao listar tickets' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const verified = verifyToken(token)
    if (!verified) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const tenantId = verified.tenantId || verified.userId
    const member = await isTenantMember(tenantId, verified.userId)
    const legacyMode = member?.id === 'legacy'
    if (!member && !legacyMode) return NextResponse.json({ error: 'Não autorizado (tenant)' }, { status: 403 })

    const body = await request.json()
    const validated = createSupportTicketSchema.parse(body)

    const payload: any = {
      creatorId: verified.userId,
      subject: validated.subject,
      status: 'open',
      priority: validated.priority,
    }

    if (!legacyMode) payload.tenantId = tenantId

    const { data: ticket, error: ticketError } = await supabase
      .from('SupportTicket')
      .insert(payload)
      .select()
      .single()

    if (ticketError) {
      if (dbNotReady(ticketError)) {
        return NextResponse.json(
          {
            error: 'Sistema de suporte ainda não configurado no banco.',
            hint: 'Aplique a migration supabase/migrations/20260203000000_support_tickets.sql no Supabase.',
          },
          { status: 500 }
        )
      }
      throw ticketError
    }

    const { error: messageError } = await supabase.from('SupportTicketMessage').insert({
      ticketId: ticket.id,
      sender: 'user',
      message: validated.message,
    })

    if (messageError) throw messageError

    return NextResponse.json({ success: true, ticket }, { status: 201 })
  } catch (error: any) {
    console.error('Erro ao criar ticket:', error)

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'Erro ao criar ticket' }, { status: 500 })
  }
}
