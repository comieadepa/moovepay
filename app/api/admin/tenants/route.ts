import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, hasGlobalRole } from '@/lib/rbac'
import { supabase } from '@/lib/supabase-server'
import { PLAN_ORDER } from '@/lib/plans'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const ctx = getAuthContext(request)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    if (!hasGlobalRole(ctx, ['admin'])) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const { data: tenants, error } = await supabase
      .from('Tenant')
      .select('id, name, planId, createdAt')
      .order('createdAt', { ascending: false })

    if (error) {
      const message = String((error as any)?.message || '')
      if (message.includes("Could not find the table 'public.Tenant'")) {
        return NextResponse.json(
          {
            error: 'Multi-tenant ainda não configurado no banco.',
            hint: 'Aplique a migration supabase/migrations/20260203001000_multitenant_rbac.sql no Supabase.',
          },
          { status: 500 }
        )
      }
      throw error
    }

    return NextResponse.json({ success: true, tenants: tenants || [] }, { status: 200 })
  } catch (e) {
    console.error('Erro ao listar tenants:', e)
    return NextResponse.json({ error: 'Erro ao listar tenants' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ctx = getAuthContext(request)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!hasGlobalRole(ctx, ['admin'])) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const { tenantId, planId } = body as { tenantId?: string; planId?: string }

    if (!tenantId || !planId) {
      return NextResponse.json({ error: 'tenantId e planId são obrigatórios' }, { status: 400 })
    }

    if (!PLAN_ORDER.includes(planId as any)) {
      return NextResponse.json({ error: `planId inválido. Use: ${PLAN_ORDER.join(', ')}` }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('Tenant')
      .update({ planId })
      .eq('id', tenantId)
      .select('id, name, planId')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, tenant: data })
  } catch (e) {
    console.error('Erro ao atualizar plano do tenant:', e)
    return NextResponse.json({ error: 'Erro ao atualizar plano' }, { status: 500 })
  }
}
