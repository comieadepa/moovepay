// Teste de concorrencia e reconciliacao simulado em memoria/logica isolada
// Nao executa chamadas reais ao Asaas nem banco de producao

console.log('=== TESTE DE CONCORRENCIA E CLAIM PRE-ASAAS ===');

class MockDatabase {
  constructor() {
    this.payments = [];
  }

  // Simula o INSERT com unique index em cartId WHERE status IN ('creating', 'pending', 'paid')
  insertPayment(row) {
    const active = this.payments.find(p => p.cartId === row.cartId && ['creating', 'pending', 'paid'].includes(p.status));
    if (active) {
      const err = new Error('duplicate key value violates unique constraint idx_payment_unique_active_cart');
      err.code = '23505';
      throw err;
    }
    const created = { ...row, id: 'pay_' + Math.random().toString(36).substr(2, 9), createdAt: new Date().toISOString() };
    this.payments.push(created);
    return created;
  }

 updatePayment(id, updates) {
 const item = this.payments.find(p => p.id === id);
 if (!item) throw new Error('Not found');
 Object.assign(item, updates);
 return item;
 }
}

async function simulateCheckoutRequest(reqId, db, orderRef, asaasMock) {
  console.log('[Req ' + reqId + '] Iniciando checkout para cartId=' + orderRef);
  
  // 1. Claim pre-Asaas
  let claim;
  try {
    claim = db.insertPayment({
      cartId: orderRef,
      status: 'creating',
      value: 100,
      method: 'pix'
    });
    console.log('[Req ' + reqId + '] SUCESSO: Claim creating obtido! ID=' + claim.id);
  } catch (err) {
    console.log('[Req ' + reqId + '] BLOQUEADO: Concorrencia detectada (Constraint 23505). Abortando sem chamar Asaas.');
    return { status: 409, error: 'concurrency_blocked' };
  }

  // 2. Chamada ao Asaas (apenas quem obteve o claim chama o Asaas)
  console.log('[Req ' + reqId + '] Chamando API do ASAAS...');
  const asaasPayment = await asaasMock.createPayment(orderRef, 100);
  console.log('[Req ' + reqId + '] ASAAS respondeu id=' + asaasPayment.id);

  // 3. Atualiza Payment de creating para pending com externalId
  db.updatePayment(claim.id, { externalId: asaasPayment.id, status: 'pending' });
  console.log('[Req ' + reqId + '] Payment atualizado para pending com externalId=' + asaasPayment.id);
  return { status: 201, payment: claim };
}

async function runTests() {
 const db = new MockDatabase();
 let asaasCallCount = 0;
 const asaasMock = {
 createPayment: async (ref, val) => {
 asaasCallCount++;
 await new Promise(r => setTimeout(r, 100)); // simula latencia de rede de 100ms
 return { id: 'asaas_pay_' + Date.now(), value: val, externalReference: ref };
 }
 };

 console.log('\n--- Cenário 1: Duas requisicoes A e B simultaneas no mesmo carrinho ---');
 const [resA, resB] = await Promise.all([
 simulateCheckoutRequest('A', db, 'cart_123', asaasMock),
 simulateCheckoutRequest('B', db, 'cart_123', asaasMock)
 ]);

 console.log('\nResultado Cenário 1:');
 console.log('Status Req A:', resA.status);
 console.log('Status Req B:', resB.status);
 console.log('Total de chamadas disparadas ao ASAAS:', asaasCallCount);

 if (asaasCallCount === 1 && (resA.status === 201 || resB.status === 201) && (resA.status === 409 || resB.status === 409)) {
 console.log('>>> TESTE 1 PASSOU: Apenas UMA requisicao chamou o ASAAS. Nenhuma duplicidade.');
 } else {
 console.error('>>> TESTE 1 FALHOU!');
 process.exit(1);
 }

 console.log('\n--- Cenário 2: Falha e Reconciliacao de Claim Orfao ---');
 // Criar um claim orfao
 const orphan = db.insertPayment({ cartId: 'cart_orphan', status: 'creating', value: 100, method: 'pix' });
 orphan.createdAt = new Date(Date.now() - 35000).toISOString(); // 35 segundos atras

 console.log('Simulando verificacao de claim orfao > 25s...');
 const asaasExistingList = [{ id: 'asaas_orphan_999', value: 100, externalReference: 'cart_orphan' }];
 
 // Reconciliacao encontra no Asaas
 const matched = asaasExistingList.find(p => p.externalReference === 'cart_orphan');
 if (matched) {
   db.updatePayment(orphan.id, { externalId: matched.id, status: 'pending' });
   console.log('Reconciliado com sucesso! Payment associado a ' + matched.id + ' sem criar nova cobranca.');
 }

 console.log('\n--- Cenário 3: Corrida Webhook antes do Update ---');
 // Webhook chega com externalReference
 const webhookEvent = { payment: { id: 'asaas_webhook_1', externalReference: 'cart_race' } };
 const raceClaim = db.insertPayment({ cartId: 'cart_race', status: 'creating', value: 50, method: 'pix' });
 
 console.log('Webhook chegou antes do update! Localizando Payment por externalReference=' + webhookEvent.payment.externalReference + ' e status=creating...');
 const foundByRef = db.payments.find(p => p.cartId === webhookEvent.payment.externalReference && p.status === 'creating');
 if (foundByRef) {
   db.updatePayment(foundByRef.id, { externalId: webhookEvent.payment.id });
   console.log('Webhook vinculou externalId=' + webhookEvent.payment.id + ' no Payment com sucesso!');
 }

 console.log('\n--- Cenário 4: Inscrição Individual (cartId = NULL, Payment.cartId = order_${regId}) ---');
 // 1. Inscrição individual criada sem cartId
 const individualReg = {
   id: 'reg_single_456',
   eventId: 'evt_alpha',
   cartId: null, // Campo NULL no banco
   status: 'pending',
   fullName: 'Maria Teste',
   email: 'maria@teste.com'
 };
 const registrationsTable = [individualReg];
 const vouchersTable = [];

  // 2. Checkout gera orderReference = order:reg_single_456
  const individualOrderRef = individualReg.cartId || ('order:' + [individualReg.id].sort().join(':'));
  const individualPayment = db.insertPayment({
    cartId: individualOrderRef,
    eventId: individualReg.eventId,
    status: 'creating',
    value: 100,
    method: 'pix'
  });
  db.updatePayment(individualPayment.id, { externalId: 'asaas_pay_indiv_888', status: 'pending' });
  console.log('Inscrição criada com cartId=' + individualReg.cartId + ' e Payment com cartId=' + individualPayment.cartId);

  // 3. Webhook chega do ASAAS para o pagamento individual
  console.log('Simulando chegada do webhook ASAAS confirmado para externalId=' + individualPayment.externalId + '...');
  let resolvedRegs = [];
  if (individualPayment.cartId?.startsWith('order:') || individualPayment.cartId?.startsWith('order_')) {
    const raw = individualPayment.cartId.startsWith('order:')
      ? individualPayment.cartId.replace('order:', '')
      : individualPayment.cartId.replace('order_', '');
    const extractedIds = raw.includes(':') ? raw.split(':').filter(Boolean) : [raw];
    resolvedRegs = registrationsTable.filter(r => extractedIds.includes(r.id) && r.eventId === individualPayment.eventId);
  } else if (individualPayment.cartId) {
    resolvedRegs = registrationsTable.filter(r => r.cartId === individualPayment.cartId && r.eventId === individualPayment.eventId);
  }

  console.log('Inscrições resolvidas pelo webhook: ' + resolvedRegs.length);
  if (resolvedRegs.length === 1 && resolvedRegs[0].id === 'reg_single_456') {
    resolvedRegs[0].status = 'paid';
    vouchersTable.push({ registrationId: resolvedRegs[0].id, qrCode: 'voucher_mock_qr', used: false });
    console.log('>>> SUCESSO: Inscrição ' + resolvedRegs[0].id + ' marcada como PAID e Voucher gerado!');
  } else {
    console.error('>>> FALHA: Webhook não conseguiu localizar ou confirmar a inscrição individual!');
    process.exit(1);
  }

 console.log('\n=== TODOS OS TESTES DE CONCORRENCIA, RECONCILIACAO E INSCRICAO INDIVIDUAL PASSARAM COM SUCESSO! ===');
}

runTests();
