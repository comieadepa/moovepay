import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, hasGlobalRole } from '@/lib/rbac'
import { supabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

function needsMigration(error: any) {
  const message = String((error as any)?.message || '')
  return (
    message.includes('assignedToUserId') ||
    message.includes('lastMessageSender') ||
    message.includes('lastMessageAt') ||
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

    const now = new Date()
    const startOfDay = new Date(now)
    startOfDay.setHours(0, 0, 0, 0)

    const { count: awaitingSupportCount, error: awaitingSupportError } = await supabase
      .from('SupportTicket')
      .select('id', { count: 'exact', head: true })
      .eq('lastMessageSender', 'user')
      .not('status', 'in', '(resolved,closed)')
    if (awaitingSupportError) throw awaitingSupportError

    const { count: unassignedCount, error: unassignedError } = await supabase
      .from('SupportTicket')
      .select('id', { count: 'exact', head: true })
      .is('assignedToUserId', null)
      .not('status', 'in', '(resolved,closed)')
    if (unassignedError) throw unassignedError

    const { count: assignedToMeCount, error: assignedToMeError } = await supabase
      .from('SupportTicket')
      .select('id', { count: 'exact', head: true })
      .eq('assignedToUserId', ctx.userId)
      .not('status', 'in', '(resolved,closed)')
    if (assignedToMeError) throw assignedToMeError

    const { count: resolvedTodayCount, error: resolvedTodayError } = await supabase
      .from('SupportTicket')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'resolved')
      .gte('updatedAt', startOfDay.toISOString())
    if (resolvedTodayError) throw resolvedTodayError

    const awaitingSupport = Number(awaitingSupportCount || 0)
    const unassigned = Number(unassignedCount || 0)
    const assignedToMe = Number(assignedToMeCount || 0)
    const resolvedToday = Number(resolvedTodayCount || 0)

    return NextResponse.json(
      {
        success: true,
        stats: {
          awaitingSupport,
          unassigned,
          assignedToMe,
          resolvedToday,
        },
      },
      { status: 200 }
    )
  } catch (e: any) {
    console.error('Erro ao calcular métricas de suporte:', e)

    if (needsMigration(e)) {
      return NextResponse.json(
        {
          error: 'Banco ainda não está pronto para métricas do suporte.',
          hint: 'Aplique a migration supabase/migrations/20260203002000_support_ticket_assignment.sql e supabase/migrations/20260203003000_support_ticket_sla_tags.sql no Supabase.',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ error: 'Erro ao calcular métricas' }, { status: 500 })
  }
}
