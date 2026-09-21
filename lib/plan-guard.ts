import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, type AuthContext } from '@/lib/rbac'
import { supabase } from '@/lib/supabase-server'
import { getPlanFeatures, PLANS, type PlanFeatures, type PlanId } from '@/lib/plans'

export type FeatureKey = keyof PlanFeatures

export interface PlanAccessResult {
  allowed: boolean
  planId: PlanId
  tenantId: string
  features: PlanFeatures
  reason?: string
}

/**
 * Obtém o planId e features do tenant autenticado garantindo que:
 * 1. O tenantId venha EXCLUSIVAMENTE do token de autenticação (AuthContext), nunca de query param / body do cliente.
 * 2. Caso o tenant não possua planId gravado ou ocorra erro de consulta, aplica o fallback seguro ('free') com fail-closed.
 */
export async function getTenantPlanContext(ctx: AuthContext): Promise<{
  tenantId: string
  planId: PlanId
  features: PlanFeatures
  error?: boolean
}> {
  const tenantId = ctx.tenantId || ctx.userId
  const defaultFallbackPlan: PlanId = 'free'

  try {
    const { data, error } = await supabase
      .from('Tenant')
      .select('planId')
      .eq('id', tenantId)
      .maybeSingle()

    // Erro de consulta no banco: fail-closed seguro (plano free, sem permissões comerciais)
    if (error) {
      console.error('[plan-guard] Erro ao consultar plano do tenant:', error)
      return {
        tenantId,
        planId: defaultFallbackPlan,
        features: getPlanFeatures(defaultFallbackPlan),
        error: true,
      }
    }

    // Ausência legítima de plano ou campo nulo: fallback padrão é 'free'
    if (!data?.planId) {
      return {
        tenantId,
        planId: defaultFallbackPlan,
        features: getPlanFeatures(defaultFallbackPlan),
      }
    }

    const planId = (data.planId as PlanId) in PLANS ? (data.planId as PlanId) : defaultFallbackPlan
    return {
      tenantId,
      planId,
      features: getPlanFeatures(planId),
    }
  } catch (err) {
    // Exceção de rede ou runtime: fail-closed garantido
    console.error('[plan-guard] Exceção ao resolver plano do tenant:', err)
    return {
      tenantId,
      planId: defaultFallbackPlan,
      features: getPlanFeatures(defaultFallbackPlan),
      error: true,
    }
  }
}

/**
 * Avalia se o tenant autenticado possui acesso à feature solicitada.
 * Admins globais têm acesso irrestrito às funcionalidades de sistema.
 */
export async function checkPlanFeature(
  ctx: AuthContext,
  feature: FeatureKey
): Promise<PlanAccessResult> {
  // Administradores globais têm bypass para auditoria e suporte
  if (ctx.role === 'admin') {
    const planCtx = await getTenantPlanContext(ctx)
    return {
      allowed: true,
      planId: planCtx.planId,
      tenantId: planCtx.tenantId,
      features: planCtx.features,
    }
  }

  const { tenantId, planId, features, error: dbError } = await getTenantPlanContext(ctx)
  const allowed = Boolean(features[feature])

  let reason: string | undefined = undefined
  if (!allowed) {
    if (dbError) {
      reason = `Não foi possível verificar a assinatura do tenant. Por segurança, o recurso '${String(feature)}' foi bloqueado temporariamente.`
    } else {
      reason = `Funcionalidade '${String(feature)}' não disponível no plano ${PLANS[planId]?.name || planId}`
    }
  }

  return {
    allowed,
    planId,
    tenantId,
    features,
    reason,
  }
}

/**
 * Guard para Route Handlers (APIs).
 * Retorna null se autorizado, ou NextResponse com erro 401/403 pronto para ser retornado pela rota.
 *
 * Exemplo de uso em route.ts:
 * const guard = await requirePlanFeature(request, 'advancedReports')
 * if (guard.response) return guard.response
 * const { tenantId, planId } = guard.context
 */
export async function requirePlanFeature(
  request: NextRequest,
  feature: FeatureKey
): Promise<{
  response: NextResponse | null
  context?: {
    auth: AuthContext
    tenantId: string
    planId: PlanId
    features: PlanFeatures
  }
}> {
  const ctx = getAuthContext(request)
  if (!ctx) {
    return {
      response: NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      ),
    }
  }

  const check = await checkPlanFeature(ctx, feature)
  if (!check.allowed) {
    return {
      response: NextResponse.json(
        {
          error: 'Funcionalidade não disponível para o seu plano',
          code: 'FEATURE_NOT_AVAILABLE',
          feature,
          currentPlan: check.planId,
          upgradeRequired: true,
          message: check.reason,
        },
        { status: 403 }
      ),
    }
  }

  return {
    response: null,
    context: {
      auth: ctx,
      tenantId: check.tenantId,
      planId: check.planId,
      features: check.features,
    },
  }
}
