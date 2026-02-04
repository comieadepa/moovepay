import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, hasGlobalRole } from '@/lib/rbac'
import { supabase } from '@/lib/supabase-server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

function isMissingTenantTable(error: any) {
  const message = String(error?.message || '')
  return message.includes("Could not find the table 'public.Tenant'")
}

function isMissingAssignmentColumn(error: any) {
  const message = String(error?.message || '')
  return message.includes('assignedToUserId') || message.includes('schema cache')
}

function isMissingSlaTagsColumns(error: any) {
  const message = String(error?.message || '')
  return message.includes('lastMessageAt') || message.includes('lastMessageSender') || message.includes('tags')
}

const adminUpdateSchema = z.object({
  message: z.string().min(1).optional(),
  status: z.enum(['open', 'pending', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  assignToMe: z.boolean().optional(),
  unassign: z.boolean().optional(),
  assignedToUserId: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).optional(),
})

async function fetchTicketWithFallback(id: string) {
  const withTenant = await supabase
    .from('SupportTicket')
    .select('*, creator:User!creatorId(id, name, email), tenant:Tenant!tenantId(id, name), assignee:User!assignedToUserId(id, name, email)')
    .eq('id', id)
    .maybeSingle()

  if (withTenant.error && isMissingTenantTable(withTenant.error)) {
    const withoutTenant = await supabase
      .from('SupportTicket')
      .select('*, creator:User!creatorId(id, name, email)')
      .eq('id', id)
      .maybeSingle()
    if (withoutTenant.error) throw withoutTenant.error
    return withoutTenant.data
  }

  if (withTenant.error && isMissingAssignmentColumn(withTenant.error)) {
    const withoutAssignee = await supabase
      .from('SupportTicket')
      .select('*, creator:User!creatorId(id, name, email), tenant:Tenant!tenantId(id, name)')
      .eq('id', id)
      .maybeSingle()
    if (withoutAssignee.error) throw withoutAssignee.error
    return withoutAssignee.data
  }

  if (withTenant.error) throw withTenant.error
  return withTenant.data
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = getAuthContext(request)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    if (!hasGlobalRole(ctx, ['admin', 'support'])) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const ticket = await fetchTicketWithFallback(params.id)

    if (!ticket) return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 })

    const { data: messages, error: messageError } = await supabase
      .from('SupportTicketMessage')
      .select('*')
      .eq('ticketId', params.id)
      .order('createdAt', { ascending: true })

    if (messageError) throw messageError

    return NextResponse.json({ success: true, ticket, messages: messages || [] }, { status: 200 })
  } catch (e) {
    console.error('Erro ao buscar ticket (admin):', e)
    return NextResponse.json({ error: 'Erro ao buscar ticket' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = getAuthContext(request)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    if (!hasGlobalRole(ctx, ['admin', 'support'])) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const validated = adminUpdateSchema.parse(body)

    // Confirma existência
    const { data: ticket, error: ticketError } = await supabase
      .from('SupportTicket')
      .select('*')
      .eq('id', params.id)
      .maybeSingle()

    if (ticketError) throw ticketError
    if (!ticket) return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 })

    const patch: Record<string, any> = {}

    if (validated.message && validated.message.trim().length > 0) {
      const { error: messageError } = await supabase.from('SupportTicketMessage').insert({
        ticketId: params.id,
        sender: 'support',
        message: validated.message.trim(),
      })
      if (messageError) throw messageError
    }

    if (validated.status) patch.status = validated.status
    if (validated.priority) patch.priority = validated.priority
    if (validated.tags) patch.tags = validated.tags

    // Se o suporte respondeu e não informou status, marca como pendente (aguardando usuário)
    if (!validated.status && validated.message && validated.message.trim().length > 0) {
      patch.status = 'pending'
    }

    // Atribuição (se a migration foi aplicada)
    if (validated.unassign) {
      patch.assignedToUserId = null
      patch.assignedAt = null
    } else if (validated.assignToMe) {
      patch.assignedToUserId = ctx.userId
      patch.assignedAt = new Date().toISOString()
    } else if (validated.assignedToUserId) {
      patch.assignedToUserId = validated.assignedToUserId
      patch.assignedAt = new Date().toISOString()
    }

    if (Object.keys(patch).length > 0) {
      const { error: updateError } = await supabase
        .from('SupportTicket')
        .update(patch)
        .eq('id', params.id)
        .select('*')
        .single()

      if (updateError) {
        if (isMissingAssignmentColumn(updateError)) {
          return NextResponse.json(
            {
              error: 'Banco ainda não está pronto para atribuição de atendente.',
              hint: 'Aplique a migration supabase/migrations/20260203002000_support_ticket_assignment.sql no Supabase.',
            },
            { status: 500 }
          )
        }

        if (isMissingSlaTagsColumns(updateError)) {
          return NextResponse.json(
            {
              error: 'Banco ainda não está pronto para SLA/tags no suporte.',
              hint: 'Aplique a migration supabase/migrations/20260203003000_support_ticket_sla_tags.sql no Supabase.',
            },
            { status: 500 }
          )
        }
        throw updateError
      }
    }

    const hydrated = await fetchTicketWithFallback(params.id)
    return NextResponse.json({ success: true, ticket: hydrated }, { status: 200 })
  } catch (e: any) {
    console.error('Erro ao atualizar ticket (admin):', e)

    if (e?.name === 'ZodError') {
      return NextResponse.json({ error: 'Dados inválidos', details: e.errors }, { status: 400 })
    }

    return NextResponse.json({ error: 'Erro ao atualizar ticket' }, { status: 500 })
  }
}
