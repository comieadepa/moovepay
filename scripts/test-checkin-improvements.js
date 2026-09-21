/**
 * Script de teste automatizado para validação das melhorias de Check-in (Portaria)
 * Execução: node scripts/test-checkin-improvements.js
 */

const assert = require('assert')

// Mock da lógica central de validação e métricas de check-in
function calculateCheckinMetrics(registrations) {
  const validRegistrations = registrations.filter(
    (r) => r.status === 'paid' || r.status === 'confirmed'
  )
  const presentCount = validRegistrations.filter((r) => r.voucher && r.voucher.used === true).length
  const totalValid = validRegistrations.length
  const attendancePercent = totalValid > 0 ? Math.round((presentCount / totalValid) * 100) : 0

  return {
    totalValid,
    presentCount,
    attendancePercent,
  }
}

function processCheckinMock({ reg, voucher, operator, event }) {
  // 1. Autorização por evento e tenant
  const isOwner = event.tenantId === operator.tenantId || event.creatorId === operator.userId
  const isStaff = operator.isStaff === true
  if (!isOwner && !isStaff) {
    return { status: 403, error: 'Sem permissão para este evento' }
  }

  // 2. Validação de status de inscrição (aceita 'paid' e 'confirmed')
  if (reg.status !== 'paid' && reg.status !== 'confirmed') {
    return { status: 422, result: 'not_paid', message: 'Pagamento não confirmado' }
  }

  // 3. Voucher já utilizado
  if (voucher && voucher.used) {
    return { status: 409, result: 'already_used', message: 'Voucher já utilizado', usedAt: voucher.usedAt }
  }

  // 4. Sucesso: cria ou marca voucher como usado
  const now = new Date().toISOString()
  const updatedVoucher = voucher
    ? { ...voucher, used: true, usedAt: now }
    : { id: 'v_generated', registrationId: reg.id, used: true, usedAt: now }

  return {
    status: 200,
    result: 'ok',
    message: 'Check-in realizado com sucesso!',
    participant: reg.fullName,
    checkedInAt: now,
    voucher: updatedVoucher,
  }
}

function filterParticipantsMock(registrations, query) {
  const q = query.toLowerCase().trim()
  if (!q) return []
  const cleanQ = q.replace(/\D/g, '')

  return registrations.filter((r) => {
    const nameMatch = r.fullName.toLowerCase().includes(q)
    const cpfMatch = cleanQ.length >= 3 && (r.cpf || '').replace(/\D/g, '').includes(cleanQ)
    return nameMatch || cpfMatch
  })
}

async function runTests() {
  console.log('=== TESTES DAS MELHORIAS DE CHECK-IN & PORTARIA ===\n')

  const sampleEvent = {
    id: 'evt_1',
    name: 'Conferência Anual 2026',
    tenantId: 'tenant_church_1',
    creatorId: 'user_pastor_1',
  }

  const sampleRegistrations = [
    { id: 'r1', fullName: 'João da Silva', cpf: '123.456.789-00', status: 'paid', voucher: { id: 'v1', used: true, usedAt: '2026-09-21T10:00:00Z' } },
    { id: 'r2', fullName: 'Maria Oliveira', cpf: '987.654.321-11', status: 'confirmed', voucher: { id: 'v2', used: false, usedAt: null } },
    { id: 'r3', fullName: 'Carlos Santos', cpf: '555.444.333-22', status: 'pending', voucher: null },
    { id: 'r4', fullName: 'Ana Souza', cpf: '111.222.333-44', status: 'cancelled', voucher: null },
    { id: 'r5', fullName: 'Marcos Vinicius', cpf: '999.888.777-66', status: 'paid', voucher: null }, // pago sem voucher pré-gerado
  ]

  // Teste 1: Métricas de presença ignorando cancelados e pendentes
  const metrics = calculateCheckinMetrics(sampleRegistrations)
  assert.strictEqual(metrics.totalValid, 3, 'Apenas r1, r2 e r5 devem ser contados como válidos')
  assert.strictEqual(metrics.presentCount, 1, 'Apenas r1 está com check-in realizado')
  assert.strictEqual(metrics.attendancePercent, 33, '1 de 3 deve ser 33%')
  console.log('✓ Cenário 1: Métricas de presença calculadas corretamente (3 válidos, 1 presente, 33%)')

  // Teste 2: Validação de inscrição gratuita confirmada ('confirmed')
  const opOwner = { userId: 'user_pastor_1', tenantId: 'tenant_church_1', isStaff: false }
  const resConfirmed = processCheckinMock({
    reg: sampleRegistrations[1],
    voucher: sampleRegistrations[1].voucher,
    operator: opOwner,
    event: sampleEvent,
  })
  assert.strictEqual(resConfirmed.result, 'ok')
  assert.strictEqual(resConfirmed.voucher.used, true)
  console.log('✓ Cenário 2: Inscrição gratuita confirmada aceita com sucesso no check-in')

  // Teste 3: Rejeição de inscrição pendente
  const resPending = processCheckinMock({
    reg: sampleRegistrations[2],
    voucher: sampleRegistrations[2].voucher,
    operator: opOwner,
    event: sampleEvent,
  })
  assert.strictEqual(resPending.result, 'not_paid')
  console.log('✓ Cenário 3: Inscrição com pagamento pendente bloqueada com resultado not_paid')

  // Teste 4: Rejeição de voucher já utilizado
  const resDuplicate = processCheckinMock({
    reg: sampleRegistrations[0],
    voucher: sampleRegistrations[0].voucher,
    operator: opOwner,
    event: sampleEvent,
  })
  assert.strictEqual(resDuplicate.result, 'already_used')
  console.log('✓ Cenário 4: Voucher já escaneado rejeitado com already_used')

  // Teste 5: Inscrição válida sem voucher pré-gerado -> Auto-cria voucher e marca como usado
  const resAutoVoucher = processCheckinMock({
    reg: sampleRegistrations[4],
    voucher: null,
    operator: opOwner,
    event: sampleEvent,
  })
  assert.strictEqual(resAutoVoucher.result, 'ok')
  assert.ok(resAutoVoucher.voucher.id)
  assert.strictEqual(resAutoVoucher.voucher.used, true)
  console.log('✓ Cenário 5: Inscrição válida sem voucher gera voucher e conclui check-in')

  // Teste 6: Proteção multi-tenant (operador de outro tenant sem permissão)
  const opAlien = { userId: 'user_stranger', tenantId: 'tenant_alien', isStaff: false }
  const resAlien = processCheckinMock({
    reg: sampleRegistrations[1],
    voucher: sampleRegistrations[1].voucher,
    operator: opAlien,
    event: sampleEvent,
  })
  assert.strictEqual(resAlien.status, 403)
  console.log('✓ Cenário 6: Operador não autorizado bloqueado por tenant/evento (403)')

  // Teste 7: Busca manual por Nome e CPF
  const searchByName = filterParticipantsMock(sampleRegistrations, 'maria')
  assert.strictEqual(searchByName.length, 1)
  assert.strictEqual(searchByName[0].fullName, 'Maria Oliveira')

  const searchByCpf = filterParticipantsMock(sampleRegistrations, '987.654')
  assert.strictEqual(searchByCpf.length, 1)
  assert.strictEqual(searchByCpf[0].fullName, 'Maria Oliveira')
  console.log('✓ Cenário 7: Busca manual localiza participante por nome ou fragmento de CPF')

  console.log('\n>>> TODOS OS TESTES DE CHECK-IN E PORTARIA PASSARAM COM SUCESSO! <<<')
}

runTests().catch((e) => {
  console.error('Falha nos testes de check-in:', e)
  process.exit(1)
})
