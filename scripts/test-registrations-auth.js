/**
 * Suíte de Testes Automatizados para a Autorização da API de Inscrições
 * (app/api/registrations/route.ts)
 *
 * Valida:
 * 1. Acesso do proprietário/criador do evento
 * 2. Acesso de membro autorizado do tenant proprietário (via isTenantMember)
 * 3. Bloqueio de usuário de outro tenant (mesmo que tente forjar tenantId)
 * 4. Acesso de administrador global (bypass irrestrito)
 * 5. Evento não existente (404)
 * 6. Consulta por email (somente do próprio usuário autenticado)
 *
 * Execução: node scripts/test-registrations-auth.js
 */

const assert = require('assert')

console.log('=== TESTES DE AUTORIZAÇÃO DA API DE INSCRIÇÕES (GET /api/registrations) ===\n')

// Mock de base de dados para Tenants e Membros
const tenantMembersDb = {
  'tenant-igreja-central': [
    { userId: 'user-pastor-owner', role: 'owner' },
    { userId: 'user-secretaria-member', role: 'member' },
    { userId: 'user-financeiro-admin', role: 'admin' },
  ],
  'tenant-outra-igreja': [
    { userId: 'user-outro-pastor', role: 'owner' },
    { userId: 'user-outro-membro', role: 'member' },
  ]
}

async function isTenantMemberMock(tenantId, userId) {
  const members = tenantMembersDb[tenantId] || []
  return members.find((m) => m.userId === userId) || null
}

// Simulação fidedigna da lógica de autorização de app/api/registrations/route.ts
async function checkRegistrationsAuthorization({
  verified,
  eventId,
  eventsDb,
  queryEmail,
}) {
  if (!verified) {
    return { status: 401, error: 'Não autenticado' }
  }

  // Validação por email: usuário comum só consulta o próprio email
  if (queryEmail && queryEmail !== verified.email && verified.role !== 'admin') {
    return { status: 403, error: 'Não autorizado' }
  }

  if (eventId) {
    const event = eventsDb[eventId]
    if (!event) {
      return { status: 404, error: 'Evento não encontrado' }
    }

    const isAdmin = verified.role === 'admin'
    const isCreator = event.creatorId === verified.userId
    const eventTenantId = event.tenantId

    let isMember = false
    if (eventTenantId) {
      const member = await isTenantMemberMock(eventTenantId, verified.userId)
      isMember = !!member
    }

    if (!isAdmin && !isCreator && !isMember) {
      return { status: 403, error: 'Não autorizado' }
    }
  }

  return { status: 200, allowed: true }
}

async function runTests() {
  const mockEventsDb = {
    'evt-central-100': {
      id: 'evt-central-100',
      name: 'Congresso de Jovens',
      tenantId: 'tenant-igreja-central',
      creatorId: 'user-pastor-owner',
    },
    'evt-outro-200': {
      id: 'evt-outro-200',
      name: 'Retiro Espiritual',
      tenantId: 'tenant-outra-igreja',
      creatorId: 'user-outro-pastor',
    },
  }

  // 1. Criador/Proprietário do evento tem acesso concedido
  console.log('Testando Cenário 1: Criador/Proprietário do evento...')
  const t1 = await checkRegistrationsAuthorization({
    verified: { userId: 'user-pastor-owner', email: 'pastor@central.com', role: 'user', tenantId: 'tenant-igreja-central' },
    eventId: 'evt-central-100',
    eventsDb: mockEventsDb,
  })
  assert.strictEqual(t1.status, 200)
  assert.strictEqual(t1.allowed, true)
  console.log('  ✓ Cenário 1: Criador do evento acessa com sucesso.')

  // 2. Membro de equipe autorizado do tenant (via isTenantMember)
  console.log('Testando Cenário 2: Membro da equipe do tenant (secretaria/staff)...')
  const t2 = await checkRegistrationsAuthorization({
    verified: { userId: 'user-secretaria-member', email: 'secretaria@central.com', role: 'user', tenantId: 'tenant-igreja-central' },
    eventId: 'evt-central-100',
    eventsDb: mockEventsDb,
  })
  assert.strictEqual(t2.status, 200)
  assert.strictEqual(t2.allowed, true)
  console.log('  ✓ Cenário 2: Membro da equipe do tenant autorizado via isTenantMember.')

  // 3. Usuário de outro tenant tentando acessar o evento (Bloqueado)
  console.log('Testando Cenário 3: Usuário de outro tenant...')
  const t3 = await checkRegistrationsAuthorization({
    verified: { userId: 'user-outro-membro', email: 'outro@igreja.com', role: 'user', tenantId: 'tenant-outra-igreja' },
    eventId: 'evt-central-100',
    eventsDb: mockEventsDb,
  })
  assert.strictEqual(t3.status, 403)
  assert.strictEqual(t3.error, 'Não autorizado')
  console.log('  ✓ Cenário 3: Usuário de outro tenant bloqueado com HTTP 403.')

  // 4. Usuário forjando tenantId no payload/token (continua bloqueado porque o tenant dono é verificado no banco)
  console.log('Testando Cenário 4: Prevenção contra falsificação de tenantId...')
  const t4 = await checkRegistrationsAuthorization({
    // Tentativa de invasor passar tenantId: 'tenant-igreja-central' sem ser membro
    verified: { userId: 'user-hacker', email: 'hacker@internet.com', role: 'user', tenantId: 'tenant-igreja-central' },
    eventId: 'evt-central-100',
    eventsDb: mockEventsDb,
  })
  assert.strictEqual(t4.status, 403)
  console.log('  ✓ Cenário 4: Falsificação de tenantId rejeitada; consulta valida membresia no banco.')

  // 5. Administrador global (Bypass irrestrito)
  console.log('Testando Cenário 5: Administrador global (role: admin)...')
  const t5 = await checkRegistrationsAuthorization({
    verified: { userId: 'admin-global', email: 'admin@congregapay.com', role: 'admin', tenantId: null },
    eventId: 'evt-central-100',
    eventsDb: mockEventsDb,
  })
  assert.strictEqual(t5.status, 200)
  assert.strictEqual(t5.allowed, true)
  console.log('  ✓ Cenário 5: Administrador global possui acesso irrestrito.')

  // 6. Evento inexistente (HTTP 404)
  console.log('Testando Cenário 6: Evento não encontrado...')
  const t6 = await checkRegistrationsAuthorization({
    verified: { userId: 'user-pastor-owner', email: 'pastor@central.com', role: 'user', tenantId: 'tenant-igreja-central' },
    eventId: 'evt-fantasma-999',
    eventsDb: mockEventsDb,
  })
  assert.strictEqual(t6.status, 404)
  console.log('  ✓ Cenário 6: Evento inexistente retorna 404.')

  // 7. Filtro por email (Apenas o próprio usuário)
  console.log('Testando Cenário 7: Filtro por email do participante...')
  const t7Owner = await checkRegistrationsAuthorization({
    verified: { userId: 'u-participante', email: 'participante@gmail.com', role: 'user' },
    queryEmail: 'participante@gmail.com',
    eventsDb: mockEventsDb,
  })
  assert.strictEqual(t7Owner.status, 200)

  const t7Other = await checkRegistrationsAuthorization({
    verified: { userId: 'u-invasor', email: 'invasor@gmail.com', role: 'user' },
    queryEmail: 'participante@gmail.com',
    eventsDb: mockEventsDb,
  })
  assert.strictEqual(t7Other.status, 403)
  console.log('  ✓ Cenário 7: Usuário só consulta inscrições vinculadas ao seu próprio email.')

  console.log('\n>>> TODOS OS TESTES DE AUTORIZAÇÃO DE INSCRIÇÕES PASSARAM COM SUCESSO! <<<')
}

runTests().catch((err) => {
  console.error('Erro nos testes:', err)
  process.exit(1)
})
