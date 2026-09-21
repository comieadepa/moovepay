import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/rbac'
import { getTenantPlanContext } from '@/lib/plan-guard'
import { PLANS } from '@/lib/plans'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const ctx = getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // Obter contexto seguro do plano baseado estritamente na autenticação
  const planCtx = await getTenantPlanContext(ctx)
  const planDetails = PLANS[planCtx.planId] ?? PLANS.essencial

  return NextResponse.json({
    success: true,
    tenantId: planCtx.tenantId,
    planId: planCtx.planId,
    plan: {
      id: planDetails.id,
      name: planDetails.name,
      monthlyPrice: planDetails.monthlyPrice,
      feePercent: planDetails.feePercent,
      features: planCtx.features,
      badge: planDetails.badge,
    },
  })
}
