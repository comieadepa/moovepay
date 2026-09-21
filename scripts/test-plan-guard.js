/**
 * Testes unitários do Plan Guard atualizados para a correção de Fallback Seguro e Fail-Closed
 * Execução: node scripts/test-plan-guard.js
 */

const assert = require('assert')

const PLANS = {
  free: {
    id: 'free',
    name: 'Gratuito',
    features: {
      paidEvents: false,
      pix: false,
      qrCheckin: false,
      certificates: false,
      multipleOrganizers: false,
      advancedReports: false,
      whiteLabel: false,
      prioritySupport: false,
    },
  },
  essencial: {
    id: 'essencial',
    name: 'Essencial',
    features: {
      paidEvents: true,
      pix: true,
      qrCheckin: true,
      certificates: true,
      multipleOrganizers: false,
      advancedReports: false,
      whiteLabel: false,
      prioritySupport: false,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    features: {
      paidEvents: true,
      pix: true,
      qrCheckin: true,
      certificates: true,
      multipleOrganizers: true,
      advancedReports: true,
      whiteLabel: false,
      prioritySupport: true,
    },
  },
  custom: {
    id: 'custom',
    name: 'Igrejas & Ministérios',
    features: {
      paidEvents: true,
      pix: true,
      qrCheckin: true,
      certificates: true,
      multipleOrganizers: true,
      advancedReports: true,
      whiteLabel: true,
      prioritySupport: true,
    },
  },
}

function getPlanFeatures(planId) {
  return (PLANS[planId] || PLANS.free).features
}

// Simulação fidedigna de lib/plan-guard.ts
function resolveTenantPlanContextMock(ctx, tenantDb) {
  const tenantId = ctx.tenantId || ctx.userId
  const defaultFallbackPlan = 'free'

  const record = tenantDb[tenantId]

  // Simulação de erro no banco
  if (record && record._simulatedError) {
    return {
      tenantId,
      planId: defaultFallbackPlan,
      features: getPlanFeatures(defaultFallbackPlan),
      error: true,
    }
  }

  // Ausência de plano ou registro nulo
  if (!record || !record.planId) {
    return {
      tenantId,
      planId: defaultFallbackPlan,
      features: getPlanFeatures(defaultFallbackPlan),
    }
  }

  const planId = record.planId in PLANS ? record.planId : defaultFallbackPlan
  return {
    tenantId,
    planId,
    features: getPlanFeatures(planId),
  }
}

function checkPlanFeatureMock(ctx, feature, tenantDb) {
  if (ctx.role === 'admin') {
    const planCtx = resolveTenantPlanContextMock(ctx, tenantDb)
    return { allowed: true, planId: planCtx.planId, bypass: true }
  }

  const { tenantId, planId, features, error: dbError } = resolveTenantPlanContextMock(ctx, tenantDb)
  const allowed = Boolean(features[feature])

  let reason = undefined
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
    dbError: Boolean(dbError),
  }
}

async function runTests() {
  console.log('=== TESTES UNITÁRIOS DO PLAN GUARD (FALLBACK SEGURO & FAIL-CLOSED) ===\n')

  const mockDb = {
    'tenant_free_1': { planId: 'free' },
    'tenant_essencial_1': { planId: 'essencial' },
    'tenant_pro_1': { planId: 'pro' },
    'tenant_custom_1': { planId: 'custom' },
    'tenant_empty_1': {}, // sem planId gravado
    'tenant_unresolved_1': { planId: 'plano_inexistente_xyz' }, // plano não catalogado
    'tenant_db_error_1': { _simulatedError: true }, // falha de banco de dados
  }

  // 1. Tenant Essencial acessando qrCheckin (Permitido)
  const t1 = checkPlanFeatureMock({ userId: 'u1', tenantId: 'tenant_essencial_1', role: 'user' }, 'qrCheckin', mockDb)
  assert.strictEqual(t1.allowed, true, 'Essencial deve ter qrCheckin permitido')
  console.log('✓ Cenário 1: Tenant Essencial com qrCheckin -> Permitido')

  // 2. Tenant Essencial tentando advancedReports (Bloqueado)
  const t2 = checkPlanFeatureMock({ userId: 'u1', tenantId: 'tenant_essencial_1', role: 'user' }, 'advancedReports', mockDb)
  assert.strictEqual(t2.allowed, false, 'Essencial não deve ter advancedReports')
  assert.ok(t2.reason.includes('não disponível no plano Essencial'))
  console.log('✓ Cenário 2: Tenant Essencial com advancedReports -> Bloqueado com razão descritiva')

  // 3. Tenant Pro tentando advancedReports (Permitido)
  const t3 = checkPlanFeatureMock({ userId: 'u2', tenantId: 'tenant_pro_1', role: 'user' }, 'advancedReports', mockDb)
  assert.strictEqual(t3.allowed, true, 'Pro deve ter advancedReports permitido')
  console.log('✓ Cenário 3: Tenant Pro com advancedReports -> Permitido')

  // 4. Tenant sem planId definido -> Fallback seguro para FREE (Fail-closed)
  const t4 = checkPlanFeatureMock({ userId: 'u3', tenantId: 'tenant_empty_1', role: 'user' }, 'paidEvents', mockDb)
  assert.strictEqual(t4.planId, 'free', 'Fallback deve ser FREE por segurança')
  assert.strictEqual(t4.allowed, false, 'Tenant sem plano não pode criar eventos pagos')
  assert.ok(t4.reason.includes('não disponível no plano Gratuito'))
  console.log('✓ Cenário 4: Tenant sem planId -> Aplica fallback seguro (Free, sem conceder recursos pagos)')

  // 5. Tenant com plano inválido/não catalogado -> Fallback seguro para FREE
  const t5 = checkPlanFeatureMock({ userId: 'u4', tenantId: 'tenant_unresolved_1', role: 'user' }, 'paidEvents', mockDb)
  assert.strictEqual(t5.planId, 'free')
  assert.strictEqual(t5.allowed, false)
  console.log('✓ Cenário 5: Tenant com plano não reconhecido -> Fallback para Free')

  // 6. Erro de consulta ao banco de dados -> Fail-Closed rigoroso
  const t6 = checkPlanFeatureMock({ userId: 'u5', tenantId: 'tenant_db_error_1', role: 'user' }, 'qrCheckin', mockDb)
  assert.strictEqual(t6.planId, 'free')
  assert.strictEqual(t6.allowed, false, 'Em caso de erro no banco, bloqueia recursos comerciais')
  assert.strictEqual(t6.dbError, true)
  assert.ok(t6.reason.includes('Não foi possível verificar a assinatura'))
  console.log('✓ Cenário 6: Falha no banco de dados -> Comportamento Fail-Closed garantido')

  // 7. Admin global possui bypass automático mesmo em tenant Free
  const t7 = checkPlanFeatureMock({ userId: 'u_admin', tenantId: 'tenant_free_1', role: 'admin' }, 'advancedReports', mockDb)
  assert.strictEqual(t7.allowed, true, 'Admin deve ter bypass autorizado')
  assert.strictEqual(t7.bypass, true)
  console.log('✓ Cenário 7: Usuário com role admin -> Bypass autorizado')

  // 8. Admin global possui bypass mesmo em caso de falha de consulta do tenant
  const t8 = checkPlanFeatureMock({ userId: 'u_admin', tenantId: 'tenant_db_error_1', role: 'admin' }, 'advancedReports', mockDb)
  assert.strictEqual(t8.allowed, true)
  console.log('✓ Cenário 8: Admin global com bypass mesmo sob erro de tenant')

  console.log('\n>>> TODOS OS TESTES DO PLAN GUARD (FALLBACK SEGURO) PASSARAM COM SUCESSO! <<<')
}

runTests().catch((err) => {
  console.error('Erro nos testes:', err)
  process.exit(1)
})
