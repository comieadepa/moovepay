import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/rbac'
import { supabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const ctx = getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const tenantId = request.nextUrl.searchParams.get('tenantId') || ctx.tenantId

  // Só pode consultar o próprio tenant (a menos que seja admin)
  if (tenantId !== ctx.tenantId && ctx.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('Tenant')
    .select('planId')
    .eq('id', tenantId)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ planId: 'essencial' })
  }

  return NextResponse.json({ planId: data.planId || 'essencial' })
}
