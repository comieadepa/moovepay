import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, hasGlobalRole } from '@/lib/rbac'
import { supabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

type PaymentRow = {
  id: string
  value: number
  status: string
  paidAt: string | null
  event: { id: string; name: string; tenantId: string } | { id: string; name: string; tenantId: string }[] | null
}

export async function GET(request: NextRequest) {
  try {
    const ctx = getAuthContext(request)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    if (!hasGlobalRole(ctx, ['admin', 'finance'])) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('Payment')
      .select('id, value, status, paidAt, event:Event(id, name, tenantId)')
      .eq('status', 'received')

    if (error) {
      const message = String((error as any)?.message || '')
      if (message.includes('tenantId') || message.includes('column') || message.includes('schema cache')) {
        return NextResponse.json(
          {
            error: 'Multi-tenant ainda não configurado no banco (Event.tenantId).',
            hint: 'Aplique a migration supabase/migrations/20260203001000_multitenant_rbac.sql no Supabase.',
          },
          { status: 500 }
        )
      }
      throw error
    }

    const payments = (data || []) as unknown as PaymentRow[]

    const byTenant = new Map<string, { tenantId: string; gross: number; fee: number; net: number; count: number }>()

    for (const p of payments) {
      const eventObj = Array.isArray(p.event) ? p.event[0] : p.event
      const tenantId = eventObj?.tenantId
      if (!tenantId) continue

      const gross = Number(p.value || 0)
      const fee = gross * 0.1
      const net = gross - fee

      const current = byTenant.get(tenantId) || { tenantId, gross: 0, fee: 0, net: 0, count: 0 }
      current.gross += gross
      current.fee += fee
      current.net += net
      current.count += 1
      byTenant.set(tenantId, current)
    }

    const summary = Array.from(byTenant.values()).sort((a, b) => b.fee - a.fee)

    const totals = summary.reduce(
      (acc, row) => {
        acc.gross += row.gross
        acc.fee += row.fee
        acc.net += row.net
        acc.count += row.count
        return acc
      },
      { gross: 0, fee: 0, net: 0, count: 0 }
    )

    return NextResponse.json({ success: true, totals, summary }, { status: 200 })
  } catch (e) {
    console.error('Erro ao calcular taxas (admin):', e)
    return NextResponse.json({ error: 'Erro ao calcular financeiro' }, { status: 500 })
  }
}
