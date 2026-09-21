/**
 * Script de teste automatizado para a Fase 1: Agregação de Relatórios de Vendas e Portaria
 * Execução: node scripts/test-reports-phase1.js
 */

const assert = require('assert')

// 1. Função pura de agregação e formatação com timezone (espelho da lógica de route.ts)
const TIMEZONE = 'America/Sao_Paulo'

function formatInTimeZone(date, timeZone = TIMEZONE) {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) {
    return { date: '1970-01-01', hour: '00:00' }
  }

  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  })

  const parts = formatter.formatToParts(d)
  const partMap = {}
  for (const p of parts) {
    partMap[p.type] = p.value
  }

  const yyyy = partMap.year || '1970'
  const mm = partMap.month || '01'
  const dd = partMap.day || '01'
  const hh = partMap.hour || '00'

  return {
    date: `${yyyy}-${mm}-${dd}`,
    hour: `${hh}:00`,
  }
}

function aggregateReportData(params) {
  const tz = params.timeZone || TIMEZONE

  const startMs = params.startDate ? new Date(params.startDate).getTime() : -Infinity
  const endMs = params.endDate ? new Date(params.endDate).getTime() : Infinity

  const confirmedPayments = (params.payments || []).filter((p) => {
    const st = String(p.status || '').toLowerCase()
    const isConfirmed = st === 'paid' || st === 'received'
    if (!isConfirmed) return false

    const ts = new Date(p.paidAt || p.createdAt).getTime()
    if (isNaN(ts)) return false
    return ts >= startMs && ts <= endMs
  })

  let totalRevenue = 0
  const methodMap = {}
  const timelineMap = {}

  for (const p of confirmedPayments) {
    const val = Number(p.value || 0)
    totalRevenue += val

    const rawMethod = String(p.method || 'outro').toLowerCase()
    const method =
      rawMethod === 'pix'
        ? 'PIX'
        : rawMethod === 'credit_card'
        ? 'Cartão de Crédito'
        : rawMethod === 'boleto'
        ? 'Boleto Bancário'
        : rawMethod === 'free'
        ? 'Gratuito'
        : rawMethod.toUpperCase()

    if (!methodMap[method]) {
      methodMap[method] = { count: 0, grossValue: 0 }
    }
    methodMap[method].count += 1
    methodMap[method].grossValue = Number((methodMap[method].grossValue + val).toFixed(2))

    const { date: dateStr } = formatInTimeZone(p.paidAt || p.createdAt, tz)
    if (!timelineMap[dateStr]) {
      timelineMap[dateStr] = { count: 0, grossValue: 0 }
    }
    timelineMap[dateStr].count += 1
    timelineMap[dateStr].grossValue = Number((timelineMap[dateStr].grossValue + val).toFixed(2))
  }

  const byMethod = Object.entries(methodMap)
    .map(([method, data]) => ({
      method,
      count: data.count,
      grossValue: data.grossValue,
    }))
    .sort((a, b) => b.grossValue - a.grossValue)

  const timeline = Object.entries(timelineMap)
    .map(([date, data]) => ({
      date,
      count: data.count,
      grossValue: data.grossValue,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const filteredLogs = (params.checkinLogs || []).filter((l) => {
    const ts = new Date(l.scannedAt).getTime()
    if (isNaN(ts)) return false
    return ts >= startMs && ts <= endMs
  })

  let successfulCheckins = 0
  const hourlyMap = {}
  const operatorMap = {}
  const refusalMap = {}

  for (const log of filteredLogs) {
    const result = String(log.result || '').toLowerCase()
    const isSuccess = result === 'ok' || result === 'success'

    if (isSuccess) {
      successfulCheckins += 1
    }

    if (isSuccess) {
      const { hour: hourStr } = formatInTimeZone(log.scannedAt, tz)
      hourlyMap[hourStr] = (hourlyMap[hourStr] || 0) + 1
    }

    const opId = String(log.scannedBy || 'desconhecido')
    const opName = String(log.scannedByName || opId)
    if (!operatorMap[opId]) {
      operatorMap[opId] = {
        operatorId: opId,
        operatorName: opName,
        totalScans: 0,
        successCount: 0,
        alreadyUsedCount: 0,
        notPaidCount: 0,
        otherCount: 0,
      }
    }
    operatorMap[opId].totalScans += 1
    if (isSuccess) {
      operatorMap[opId].successCount += 1
    } else if (result === 'already_used') {
      operatorMap[opId].alreadyUsedCount += 1
    } else if (result === 'not_paid') {
      operatorMap[opId].notPaidCount += 1
    } else {
      operatorMap[opId].otherCount += 1
    }

    if (!isSuccess) {
      const reasonLabel =
        result === 'already_used'
          ? 'Voucher já utilizado'
          : result === 'not_paid'
          ? 'Pagamento não confirmado'
          : result === 'not_found'
          ? 'Inscrição não encontrada'
          : result || 'Outro motivo'
      refusalMap[reasonLabel] = (refusalMap[reasonLabel] || 0) + 1
    }
  }

  const byHour = Object.entries(hourlyMap)
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => a.hour.localeCompare(b.hour))

  const byOperator = Object.values(operatorMap).sort((a, b) => b.totalScans - a.totalScans)

  const refusals = Object.entries(refusalMap)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)

  return {
    sales: {
      totalRevenue: Number(totalRevenue.toFixed(2)),
      confirmedPaymentsCount: confirmedPayments.length,
      byMethod,
      timeline,
    },
    checkin: {
      totalScans: filteredLogs.length,
      successfulCheckins,
      byHour,
      byOperator,
      refusals,
    },
  }
}

// 2. Simulação de Autorização e Isolamento de Tenant
function simulateEndpointAccess({ user, tenantPlan, event }) {
  // A. Guard de feature
  const isFeatureAllowed = user.role === 'admin' || tenantPlan.features.advancedReports === true
  if (!isFeatureAllowed) {
    return { status: 403, error: 'Funcionalidade não disponível para o seu plano' }
  }

  // B. Isolamento de tenant: o evento deve pertencer ao tenant autenticado ou usuário ser criador/admin
  const isOwner = event.tenantId === user.tenantId || event.creatorId === user.userId || user.role === 'admin'
  if (!isOwner) {
    return { status: 404, error: 'Evento não encontrado ou acesso não autorizado' }
  }

  return { status: 200, ok: true }
}

// ─── EXECUÇÃO DOS TESTES ────────────────────────────────────────────────────────

console.log('=== TESTES DA FASE 1: BACKEND DE RELATÓRIOS & PORTARIA ===\n')

// Teste 1: Regras financeiras e descarte de status não confirmados
{
  const mockPayments = [
    { id: 'p1', method: 'pix', status: 'paid', value: 100.0, paidAt: '2026-09-20T14:00:00Z' },
    { id: 'p2', method: 'pix', status: 'received', value: 50.0, paidAt: '2026-09-20T15:00:00Z' },
    { id: 'p3', method: 'credit_card', status: 'paid', value: 200.0, paidAt: '2026-09-21T10:00:00Z' },
    // Status que NÃO DEVEM ser contabilizados como receita confirmada:
    { id: 'p4', method: 'pix', status: 'pending', value: 300.0, createdAt: '2026-09-21T10:00:00Z' },
    { id: 'p5', method: 'boleto', status: 'cancelled', value: 80.0, createdAt: '2026-09-21T10:00:00Z' },
    { id: 'p6', method: 'credit_card', status: 'refunded', value: 150.0, paidAt: '2026-09-20T10:00:00Z' },
    { id: 'p7', method: 'credit_card', status: 'chargeback', value: 120.0, paidAt: '2026-09-20T10:00:00Z' },
  ]

  const result = aggregateReportData({ payments: mockPayments, checkinLogs: [] })

  assert.strictEqual(result.sales.totalRevenue, 350.0, 'Receita confirmada deve somar exatamente 350.00')
  assert.strictEqual(result.sales.confirmedPaymentsCount, 3, 'Apenas 3 pagamentos confirmados')

  const pix = result.sales.byMethod.find((m) => m.method === 'PIX')
  assert.strictEqual(pix.count, 2)
  assert.strictEqual(pix.grossValue, 150.0)

  const card = result.sales.byMethod.find((m) => m.method === 'Cartão de Crédito')
  assert.strictEqual(card.count, 1)
  assert.strictEqual(card.grossValue, 200.0)

  console.log('✓ Cenário 1: Agregação financeira e descarte de status pendentes/estornados/cancelados OK')
}

// Teste 2: Agregação de Check-in (horários, operadores e motivos de recusa)
{
  const mockLogs = [
    { scannedBy: 'op1', scannedByName: 'Portaria 1', result: 'ok', scannedAt: '2026-09-21T18:15:00Z' },
    { scannedBy: 'op1', scannedByName: 'Portaria 1', result: 'ok', scannedAt: '2026-09-21T18:45:00Z' },
    { scannedBy: 'op2', scannedByName: 'Portaria 2', result: 'ok', scannedAt: '2026-09-21T19:10:00Z' },
    { scannedBy: 'op1', scannedByName: 'Portaria 1', result: 'already_used', scannedAt: '2026-09-21T19:15:00Z' },
    { scannedBy: 'op2', scannedByName: 'Portaria 2', result: 'not_paid', scannedAt: '2026-09-21T19:20:00Z' },
    { scannedBy: 'op2', scannedByName: 'Portaria 2', result: 'not_paid', scannedAt: '2026-09-21T19:25:00Z' },
  ]

  const result = aggregateReportData({ payments: [], checkinLogs: mockLogs })

  assert.strictEqual(result.checkin.totalScans, 6, 'Total de scans deve ser 6')
  assert.strictEqual(result.checkin.successfulCheckins, 3, 'Sucessos devem ser 3')

  // Operadores
  const op1 = result.checkin.byOperator.find((o) => o.operatorId === 'op1')
  assert.strictEqual(op1.totalScans, 3)
  assert.strictEqual(op1.successCount, 2)
  assert.strictEqual(op1.alreadyUsedCount, 1)

  const op2 = result.checkin.byOperator.find((o) => o.operatorId === 'op2')
  assert.strictEqual(op2.totalScans, 3)
  assert.strictEqual(op2.successCount, 1)
  assert.strictEqual(op2.notPaidCount, 2)

  // Recusas
  const alreadyUsed = result.checkin.refusals.find((r) => r.reason === 'Voucher já utilizado')
  assert.strictEqual(alreadyUsed.count, 1)
  const notPaid = result.checkin.refusals.find((r) => r.reason === 'Pagamento não confirmado')
  assert.strictEqual(notPaid.count, 2)

  console.log('✓ Cenário 2: Agregação de portaria por operador, hora e motivos de recusa OK')
}

// Teste 3: Fuso Horário do Projeto (America/Sao_Paulo)
{
  // 2026-09-21 23:30 UTC -> em SP (UTC-3) é 20:30 do mesmo dia
  const utcDate = '2026-09-21T23:30:00Z'
  const formatted = formatInTimeZone(utcDate, 'America/Sao_Paulo')
  assert.strictEqual(formatted.hour, '20:00', 'Horário deve ser convertido para 20:00 em America/Sao_Paulo')

  // 2026-09-22 01:30 UTC -> em SP (UTC-3) é 22:30 de 21/09
  const lateDate = '2026-09-22T01:30:00Z'
  const lateFormatted = formatInTimeZone(lateDate, 'America/Sao_Paulo')
  assert.strictEqual(lateFormatted.date, '2026-09-21', 'Data deve corresponder a 21/09 em SP')
  assert.strictEqual(lateFormatted.hour, '22:00', 'Horário deve ser 22:00 em SP')

  console.log('✓ Cenário 3: Conversão e agrupamento rigoroso em America/Sao_Paulo OK')
}

// Teste 4: Filtros de período (Data Inicial e Final)
{
  const mockPayments = [
    { id: 'p1', method: 'pix', status: 'paid', value: 100.0, paidAt: '2026-09-10T10:00:00Z' },
    { id: 'p2', method: 'pix', status: 'paid', value: 200.0, paidAt: '2026-09-15T10:00:00Z' },
    { id: 'p3', method: 'pix', status: 'paid', value: 300.0, paidAt: '2026-09-20T10:00:00Z' },
  ]

  const resultFiltered = aggregateReportData({
    payments: mockPayments,
    checkinLogs: [],
    startDate: '2026-09-12T00:00:00Z',
    endDate: '2026-09-18T23:59:59Z',
  })

  assert.strictEqual(resultFiltered.sales.totalRevenue, 200.0, 'Apenas o pagamento do dia 15 deve entrar')
  assert.strictEqual(resultFiltered.sales.confirmedPaymentsCount, 1)

  console.log('✓ Cenário 4: Filtro de período por data inicial e final OK')
}

// Teste 5: Guard de Plano (Bloqueio no Essencial, Liberação no Pro e Admin)
{
  const event = { id: 'evt-1', tenantId: 'tenant-igreja-1', creatorId: 'user-pastor-1' }

  // Tenant no plano Essencial (advancedReports: false)
  const essencialRes = simulateEndpointAccess({
    user: { userId: 'user-pastor-1', tenantId: 'tenant-igreja-1', role: 'user' },
    tenantPlan: { id: 'essencial', features: { advancedReports: false } },
    event,
  })
  assert.strictEqual(essencialRes.status, 403, 'Plano Essencial deve ser bloqueado com 403')

  // Tenant no plano Pro (advancedReports: true)
  const proRes = simulateEndpointAccess({
    user: { userId: 'user-pastor-1', tenantId: 'tenant-igreja-1', role: 'user' },
    tenantPlan: { id: 'pro', features: { advancedReports: true } },
    event,
  })
  assert.strictEqual(proRes.status, 200, 'Plano Pro deve ser autorizado com 200')

  // Usuário Superadmin
  const adminRes = simulateEndpointAccess({
    user: { userId: 'admin-user', tenantId: 'admin-tenant', role: 'admin' },
    tenantPlan: { id: 'essencial', features: { advancedReports: false } },
    event,
  })
  assert.strictEqual(adminRes.status, 200, 'Admin global tem bypass garantido')

  console.log('✓ Cenário 5: Guard requirePlanFeature e permissões de acesso OK')
}

// Teste 6: Isolamento Multi-tenant (bloqueio de acesso a evento de outro tenant)
{
  const eventIgrejaA = { id: 'evt-100', tenantId: 'tenant-igreja-A', creatorId: 'user-a' }

  // Usuário do tenant B tentando acessar evento da igreja A
  const crossTenantRes = simulateEndpointAccess({
    user: { userId: 'user-b', tenantId: 'tenant-igreja-B', role: 'user' },
    tenantPlan: { id: 'pro', features: { advancedReports: true } },
    event: eventIgrejaA,
  })
  assert.strictEqual(crossTenantRes.status, 404, 'Acesso cross-tenant deve ser bloqueado (404/Not Found)')

  console.log('✓ Cenário 6: Isolamento multi-tenant rigoroso OK')
}

console.log('\n>>> TODOS OS TESTES DA FASE 1 PASSARAM COM SUCESSO! <<<\n')
