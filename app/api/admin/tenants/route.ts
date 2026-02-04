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

    const { data: tenants, error } = await supabase
      .from('Tenant')
      .select('*')
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
