import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, hasGlobalRole } from '@/lib/rbac'
import { supabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

function needsMigration(error: any) {
  const message = String((error as any)?.message || '')
  return (
    message.includes("Could not find the table 'public.Tenant'") ||
    message.includes('assignedToUserId') ||
    message.includes('lastMessageAt') ||
    message.includes('lastMessageSender') ||
    message.includes('tags') ||
    message.includes('schema cache')
  )
}

export async function GET(request: NextRequest) {
  try {
    const ctx = getAuthContext(request)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    if (!hasGlobalRole(ctx, ['admin', 'support'])) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const tenantId = searchParams.get('tenantId')
    const assigned = searchParams.get('assigned') // any | me | unassigned
    const q = searchParams.get('q')
    const awaiting = searchParams.get('awaiting') // support
    const tag = searchParams.get('tag')

    // Tentativa 1: com Tenant + assignee
    let query = supabase
      .from('SupportTicket')
      .select(
        '*, creator:User!creatorId(id, name, email), tenant:Tenant!tenantId(id, name), assignee:User!assignedToUserId(id, name, email)'
      )
      .order('lastMessageAt', { ascending: false })

    if (status) query = query.eq('status', status)
    if (priority) query = query.eq('priority', priority)
    if (tenantId) query = query.eq('tenantId', tenantId)

    if (assigned === 'me') query = query.eq('assignedToUserId', ctx.userId)
    if (assigned === 'unassigned') query = query.is('assignedToUserId', null)
    if (q) query = query.ilike('subject', `%${q}%`)
    if (tag) query = (query as any).contains('tags', [tag])

    if (awaiting === 'support') {
      query = query
        .eq('lastMessageSender', 'user')
        .not('status', 'in', '(resolved,closed)')
    }

    let tickets: any[] | null = null
    let first = await query

    // Se a coluna ainda não existe, tenta ordenação antiga
    if (first.error) {
      const message = String((first.error as any)?.message || '')
      if (message.includes('lastMessageAt')) {
        let retry = supabase
          .from('SupportTicket')
          .select(
            '*, creator:User!creatorId(id, name, email), tenant:Tenant!tenantId(id, name), assignee:User!assignedToUserId(id, name, email)'
          )
          .order('updatedAt', { ascending: false })

        if (status) retry = retry.eq('status', status)
        if (priority) retry = retry.eq('priority', priority)
        if (tenantId) retry = retry.eq('tenantId', tenantId)

        if (assigned === 'me') retry = retry.eq('assignedToUserId', ctx.userId)
        if (assigned === 'unassigned') retry = retry.is('assignedToUserId', null)
        if (q) retry = retry.ilike('subject', `%${q}%`)

        first = await retry
      }
    }

    if (first.error) {
      const message = String((first.error as any)?.message || '')

      // Se não existe multi-tenant ainda, faz fallback sem join em Tenant.
      if (message.includes("Could not find the table 'public.Tenant'")) {
        let fallback = supabase
          .from('SupportTicket')
          .select('*, creator:User!creatorId(id, name, email)')
          .order('updatedAt', { ascending: false })

        if (status) fallback = fallback.eq('status', status)
        if (priority) fallback = fallback.eq('priority', priority)
        if (q) fallback = fallback.ilike('subject', `%${q}%`)

        const second = await fallback
        if (second.error) throw second.error
        tickets = second.data || []
      } else if (message.includes('assignedToUserId')) {
        // Coluna de atribuição ainda não aplicada
        let fallback = supabase
          .from('SupportTicket')
          .select('*, creator:User!creatorId(id, name, email), tenant:Tenant!tenantId(id, name)')
          .order('updatedAt', { ascending: false })

        if (status) fallback = fallback.eq('status', status)
        if (priority) fallback = fallback.eq('priority', priority)
        if (tenantId) fallback = fallback.eq('tenantId', tenantId)
        if (q) fallback = fallback.ilike('subject', `%${q}%`)

        if (tag) {
          return NextResponse.json(
            {
              error: 'Filtro por tag exige a migration de SLA/tags.',
              hint: 'Aplique supabase/migrations/20260203003000_support_ticket_sla_tags.sql no Supabase.',
            },
            { status: 500 }
          )
        }

        const second = await fallback
        if (second.error) {
          if (needsMigration(second.error)) {
            return NextResponse.json(
              {
                error: 'Migrações pendentes no banco para o painel de tickets.',
                hint: 'Aplique supabase/migrations/20260203001000_multitenant_rbac.sql, supabase/migrations/20260203002000_support_ticket_assignment.sql e supabase/migrations/20260203003000_support_ticket_sla_tags.sql no Supabase.',
              },
              { status: 500 }
            )
          }
          throw second.error
        }
        tickets = second.data || []
      } else if (needsMigration(first.error)) {
        return NextResponse.json(
          {
            error: 'Migrações pendentes no banco para o painel de tickets.',
            hint: 'Aplique supabase/migrations/20260203001000_multitenant_rbac.sql, supabase/migrations/20260203002000_support_ticket_assignment.sql e supabase/migrations/20260203003000_support_ticket_sla_tags.sql no Supabase.',
          },
          { status: 500 }
        )
      } else {
        throw first.error
      }
    } else {
      tickets = first.data || []
    }

    return NextResponse.json({ success: true, tickets: tickets || [] }, { status: 200 })
  } catch (e) {
    console.error('Erro ao listar tickets (admin):', e)
    return NextResponse.json({ error: 'Erro ao listar tickets' }, { status: 500 })
  }
}
