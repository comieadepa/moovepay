import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, hasGlobalRole } from '@/lib/rbac'
import { supabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const ctx = getAuthContext(request)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!hasGlobalRole(ctx, ['admin'])) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const tenantId = request.nextUrl.searchParams.get('tenantId')

    if (tenantId) {
      // Contagem de eventos de um tenant específico (sem filtro de status)
      const { count, error } = await supabase
        .from('Event')
        .select('id', { count: 'exact', head: true })
        .eq('tenantId', tenantId)

      if (error) throw error
      return NextResponse.json({ success: true, count: count ?? 0 }, { status: 200 })
    }

    // Totais globais
    const { count: total, error: totalError } = await supabase
      .from('Event')
      .select('id', { count: 'exact', head: true })

    if (totalError) throw totalError

    return NextResponse.json({ success: true, total: total ?? 0 }, { status: 200 })
  } catch (e) {
    console.error('Erro ao buscar stats de eventos:', e)
    return NextResponse.json({ error: 'Erro ao buscar eventos' }, { status: 500 })
  }
}
