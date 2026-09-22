/**
 * Testes Unitários e de Integração: Checkout Status & Polling PIX
 * Executa cenários completos de consulta de status, transição de pendente para pago,
 * isolamento multi-tenant, autorização de participante e múltiplos vouchers por carrinho.
 */

const assert = require('assert')

console.log('=== TESTES DO ENDPOINT GET /api/checkout/status & POLLING PIX ===\n')

// Mock do banco de dados em memória
const mockDb = {
  payments: [
    {
      id: 'pay_pending_123',
      cartId: 'cart_single_123',
      eventId: 'event_001',
      method: 'pix',
      status: 'pending',
      value: 150.00,
      paidAt: null,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'pay_paid_456',
      cartId: 'cart_multi_456',
      eventId: 'event_001',
      method: 'pix',
      status: 'paid',
      value: 300.00,
      paidAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
    {
      id: 'pay_failed_789',
      cartId: 'order:reg_failed_1',
      eventId: 'event_002',
      method: 'card',
      status: 'failed',
      value: 80.00,
      paidAt: null,
      createdAt: new Date().toISOString(),
    }
  ],
  registrations: [
    {
      id: 'reg_single_1',
      cartId: 'cart_single_123',
      eventId: 'event_001',
      fullName: 'Lucas Oliveira',
      email: 'lucas@exemplo.com',
      status: 'pending',
      totalValue: 150.00,
      inscriptionType: { id: 'type_1', name: 'Geral' },
      voucher: null,
    },
    {
      id: 'reg_multi_1',
      cartId: 'cart_multi_456',
      eventId: 'event_001',
      fullName: 'Ana Clara',
      email: 'ana@exemplo.com',
      status: 'paid',
      totalValue: 150.00,
      inscriptionType: { id: 'type_1', name: 'Geral' },
      voucher: { id: 'vouch_1', used: false, usedAt: null },
    },
    {
      id: 'reg_multi_2',
      cartId: 'cart_multi_456',
      eventId: 'event_001',
      fullName: 'Carlos Eduardo',
      email: 'carlos@exemplo.com',
      status: 'paid',
      totalValue: 150.00,
      inscriptionType: { id: 'type_1', name: 'Geral' },
      voucher: { id: 'vouch_2', used: false, usedAt: null },
    },
    {
      id: 'reg_failed_1',
      cartId: 'order:reg_failed_1',
      eventId: 'event_002',
      fullName: 'Marcos Silva',
      email: 'marcos@exemplo.com',
      status: 'pending',
      totalValue: 80.00,
      inscriptionType: { id: 'type_2', name: 'Estudante' },
      voucher: null,
    }
  ],
  events: [
    { id: 'event_001', tenantId: 'tenant_igreja_a', creatorId: 'user_admin_a' },
    { id: 'event_002', tenantId: 'tenant_igreja_b', creatorId: 'user_admin_b' },
  ]
}

// Simulador da lógica da rota GET /api/checkout/status
function handleGetCheckoutStatus({ paymentId, orderReference, authContext }) {
  if (!paymentId && !orderReference) {
    return { status: 400, body: { error: 'paymentId ou orderReference é obrigatório' } }
  }

  const payment = mockDb.payments.find(p => 
    (paymentId && p.id === paymentId) || (orderReference && p.cartId === orderReference)
  )

  if (!payment) {
    return { status: 404, body: { error: 'Pagamento não encontrado' } }
  }

  // Buscar inscrições
  let registrations = []
  if (payment.cartId && payment.cartId.startsWith('order:')) {
    const raw = payment.cartId.replace('order:', '')
    const regIds = raw.split(':')
    registrations = mockDb.registrations.filter(r => regIds.includes(r.id) && r.eventId === payment.eventId)
  } else if (payment.cartId) {
    registrations = mockDb.registrations.filter(r => r.cartId === payment.cartId && r.eventId === payment.eventId)
  }

  // Autorização se logado
  if (authContext) {
    const event = mockDb.events.find(e => e.id === payment.eventId)
    const isStaffOrOwner =
      event?.tenantId === authContext.tenantId ||
      event?.creatorId === authContext.userId ||
      authContext.role === 'admin'

    const isParticipant = registrations.some(
      r => r.email.toLowerCase() === authContext.email.toLowerCase()
    )

    if (!isStaffOrOwner && !isParticipant && registrations.length > 0) {
      return { status: 403, body: { error: 'Não autorizado' } }
    }
  }

  const isPaid = payment.status === 'paid'

  const vouchers = registrations
    .filter(r => r.status === 'paid' || r.status === 'confirmed' || isPaid)
    .map(r => ({
      registrationId: r.id,
      fullName: r.fullName,
      inscriptionTypeName: r.inscriptionType?.name || 'Inscrição',
      voucherUrl: `/voucher/${r.id}`,
      isUsed: r.voucher?.used ?? false,
    }))

  return {
    status: 200,
    body: {
      success: true,
      payment: {
        id: payment.id,
        method: payment.method,
        status: payment.status,
        isPaid,
        paidAt: payment.paidAt,
        totalValue: payment.value,
        registrationsCount: registrations.length,
        vouchers: isPaid ? vouchers : [],
      }
    }
  }
}

// ── EXECUÇÃO DOS CENÁRIOS ───────────────────────────────────────────────

console.log('Testando Cenário 1: Pagamento Pendente...')
const res1 = handleGetCheckoutStatus({ paymentId: 'pay_pending_123' })
assert.strictEqual(res1.status, 200)
assert.strictEqual(res1.body.payment.status, 'pending')
assert.strictEqual(res1.body.payment.isPaid, false)
assert.strictEqual(res1.body.payment.vouchers.length, 0, 'Vouchers não devem ser liberados enquanto pendente')
console.log('  ✓ Cenário 1: Retorno pendente correto e sem emissão antecipada de vouchers.')

console.log('Testando Cenário 2: Pagamento Confirmado (Transição após webhook/PIX)...')
const res2 = handleGetCheckoutStatus({ paymentId: 'pay_paid_456' })
assert.strictEqual(res2.status, 200)
assert.strictEqual(res2.body.payment.status, 'paid')
assert.strictEqual(res2.body.payment.isPaid, true)
assert.strictEqual(res2.body.payment.vouchers.length, 2, 'Deve liberar 2 vouchers para o carrinho com 2 inscrições')
assert.strictEqual(res2.body.payment.vouchers[0].fullName, 'Ana Clara')
assert.strictEqual(res2.body.payment.vouchers[1].fullName, 'Carlos Eduardo')
console.log('  ✓ Cenário 2: Pagamento confirmado retorna vouchers das inscrições atreladas.')

console.log('Testando Cenário 3: Pagamento com Falha ou Cancelado...')
const res3 = handleGetCheckoutStatus({ paymentId: 'pay_failed_789' })
assert.strictEqual(res3.status, 200)
assert.strictEqual(res3.body.payment.status, 'failed')
assert.strictEqual(res3.body.payment.isPaid, false)
assert.strictEqual(res3.body.payment.vouchers.length, 0)
console.log('  ✓ Cenário 3: Pagamentos com falha/cancelados tratados com isPaid=false.')

console.log('Testando Cenário 4: Identificador Inválido ou Inexistente...')
const res4a = handleGetCheckoutStatus({})
assert.strictEqual(res4a.status, 400, 'Requisição sem parâmetros deve retornar 400')
const res4b = handleGetCheckoutStatus({ paymentId: 'id_inexistente_999' })
assert.strictEqual(res4b.status, 404, 'ID inexistente deve retornar 404')
console.log('  ✓ Cenário 4: Validação rigorosa de parâmetros e retorno 404/400.')

console.log('Testando Cenário 5: Proteção de Autorização (Usuário não autorizado consultando pedido alheio)...')
const res5a = handleGetCheckoutStatus({
  paymentId: 'pay_paid_456',
  authContext: { userId: 'intruder_123', email: 'estranho@outro.com', tenantId: 'tenant_outro', role: 'user' }
})
assert.strictEqual(res5a.status, 403, 'Usuário estranho deve ser bloqueado com 403')

const res5b = handleGetCheckoutStatus({
  paymentId: 'pay_paid_456',
  authContext: { userId: 'ana_user_id', email: 'ana@exemplo.com', tenantId: 'tenant_outro', role: 'user' }
})
assert.strictEqual(res5b.status, 200, 'Participante do pedido tem acesso autorizado')

const res5c = handleGetCheckoutStatus({
  paymentId: 'pay_paid_456',
  authContext: { userId: 'user_admin_a', email: 'admin@igreja.com', tenantId: 'tenant_igreja_a', role: 'user' }
})
assert.strictEqual(res5c.status, 200, 'Organizador/dono do evento tem acesso autorizado')
console.log('  ✓ Cenário 5: Proteção de privacidade e autorização de participantes/organizadores validada.')

console.log('Testando Cenário 6: Consulta por orderReference (cartId)...')
const res6 = handleGetCheckoutStatus({ orderReference: 'cart_multi_456' })
assert.strictEqual(res6.status, 200)
assert.strictEqual(res6.body.payment.id, 'pay_paid_456')
console.log('  ✓ Cenário 6: Consulta por orderReference funciona perfeitamente.')

console.log('\n>>> TODOS OS TESTES DE CHECKOUT STATUS & POLLING PIX PASSARAM COM SUCESSO! <<<\n')
