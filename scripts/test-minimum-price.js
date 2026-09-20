const { z } = require('zod')

// 1. Schema geral de InscriptionType
const inscriptionTypeSchema = z
  .object({
    name: z.string().min(1, 'Nome é obrigatório'),
    value: z.coerce.number().nonnegative('Valor deve ser zero ou positivo'),
    available: z.coerce.number().int().nonnegative('Disponibilidade deve ser não-negativa'),
  })
  .superRefine((val, ctx) => {
    if (val.value > 0 && val.value < 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'O valor mínimo para inscrições pagas é R$ 5,00',
        path: ['value'],
      })
    }
  })

// 2. Schema de API da rota /api/events/[id]/inscription-types
const apiUpsertSchema = z
  .object({
    isFree: z.preprocess((v) => {
      if (typeof v === 'string') return v.toLowerCase() === 'true'
      return Boolean(v)
    }, z.boolean()).optional().default(false),
    value: z.coerce.number().min(0, 'Valor inválido').optional().default(0),
    name: z.string().min(1).optional().default('Inscrição'),
  })
  .superRefine((val, ctx) => {
    if (!val.isFree && val.value > 0 && val.value < 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'O valor mínimo para inscrições pagas é R$ 5,00',
        path: ['value'],
      })
    }
    if (!val.isFree && val.value === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Inscrições pagas devem ter valor mínimo de R$ 5,00. Para valor zero, marque como evento gratuito.',
        path: ['value'],
      })
    }
  })

// 3. Regra de publicação do evento (/api/events/[id]/publish)
function validateEventCanPublish(inscriptionTypes) {
  const invalidPaidType = (inscriptionTypes || []).find(
    (t) => Number(t.value) > 0 && Number(t.value) < 5
  )
  if (invalidPaidType) {
    return {
      allowed: false,
      error: 'Não é possível publicar o evento: o tipo de inscrição ' + invalidPaidType.name + ' possui valor de R$ ' + Number(invalidPaidType.value).toFixed(2) + ', inferior ao mínimo permitido de R$ 5,00.',
    }
  }
  return { allowed: true }
}

let passed = 0
let failed = 0

function test(description, fn) {
  try {
    fn()
    console.log('  ✓ ' + description)
    passed++
  } catch (err) {
    console.error('  ✗ ' + description)
    console.error('    ' + err.message)
    failed++
  }
}

console.log('=== TESTES DE VALIDAÇÃO DE VALOR MÍNIMO (R$ 5,00) ===\n')

test('1. Inscrição paga de R$ 0,00 é rejeitada na API (isFree = false, value = 0)', () => {
  const res = apiUpsertSchema.safeParse({ isFree: false, value: 0, name: 'Paga Zero' })
  if (res.success) throw new Error('Deveria ter falhado ao enviar inscrição paga com valor 0')
  const errorMsg = res.error.issues.map((i) => i.message).join('; ')
  if (!errorMsg.includes('Inscrições pagas devem ter valor mínimo de R$ 5,00')) {
    throw new Error('Mensagem incorreta: ' + errorMsg)
  }
})

test('2. Inscrição paga de R$ 4,99 é rejeitada na API e no schema geral', () => {
  const apiRes = apiUpsertSchema.safeParse({ isFree: false, value: 4.99, name: 'Inscrição Barata' })
  if (apiRes.success) throw new Error('API não deveria aceitar R$ 4,99')
  const apiMsg = apiRes.error.issues.map((i) => i.message).join('; ')
  if (!apiMsg.includes('O valor mínimo para inscrições pagas é R$ 5,00')) {
    throw new Error('Mensagem incorreta na API: ' + apiMsg)
  }

  const generalRes = inscriptionTypeSchema.safeParse({ name: 'Tipo 1', value: 4.99, available: 100 })
  if (generalRes.success) throw new Error('inscriptionTypeSchema não deveria aceitar R$ 4,99')
})

test('3. Inscrição paga de R$ 5,00 é aceita com sucesso', () => {
  const apiRes = apiUpsertSchema.safeParse({ isFree: false, value: 5.0, name: 'Inscrição Mínima' })
  if (!apiRes.success) throw new Error('API rejeitou R$ 5,00: ' + apiRes.error.message)

  const generalRes = inscriptionTypeSchema.safeParse({ name: 'Tipo Mínimo', value: 5.0, available: 50 })
  if (!generalRes.success) throw new Error('Schema geral rejeitou R$ 5,00: ' + generalRes.error.message)
})

test('4. Inscrição paga acima de R$ 5,00 (ex: R$ 49,90) é aceita com sucesso', () => {
  const apiRes = apiUpsertSchema.safeParse({ isFree: false, value: 49.9, name: 'Inscrição Padrão' })
  if (!apiRes.success) throw new Error('API rejeitou R$ 49,90: ' + apiRes.error.message)

  const generalRes = inscriptionTypeSchema.safeParse({ name: 'Tipo Padrão', value: 49.9, available: 100 })
  if (!generalRes.success) throw new Error('Schema geral rejeitou R$ 49,90: ' + generalRes.error.message)
})

test('5. Inscrição gratuita de R$ 0,00 é aceita com sucesso', () => {
  const apiRes = apiUpsertSchema.safeParse({ isFree: true, value: 0, name: 'Evento Gratuito' })
  if (!apiRes.success) throw new Error('API rejeitou evento gratuito: ' + apiRes.error.message)

  const generalRes = inscriptionTypeSchema.safeParse({ name: 'Gratuito', value: 0, available: 100 })
  if (!generalRes.success) throw new Error('Schema geral rejeitou gratuito: ' + generalRes.error.message)
})

test('6. Tentativa de bypass direto pela API (ex: isFree=false com value string 1.50 ou 0.01): rejeitada', () => {
  const bypass1 = apiUpsertSchema.safeParse({ isFree: false, value: '1.50', name: 'Bypass' })
  if (bypass1.success) throw new Error('Bypass 1 foi aceito indevidamente')

  const bypass2 = apiUpsertSchema.safeParse({ isFree: 'false', value: '0.01', name: 'Bypass 2' })
  if (bypass2.success) throw new Error('Bypass 2 foi aceito indevidamente')

  const bypassNegative = apiUpsertSchema.safeParse({ isFree: false, value: -10, name: 'Negativo' })
  if (bypassNegative.success) throw new Error('Valor negativo foi aceito indevidamente')
})

test('7. Bloqueio de publicação (/api/events/[id]/publish) se houver inscrição paga histórica < R$ 5,00', () => {
  const typesWithOldInvalid = [
    { id: '1', name: 'Inscrição Antiga', value: 1.0, status: 'active' },
  ]
  const pubRes = validateEventCanPublish(typesWithOldInvalid)
  if (pubRes.allowed) throw new Error('Deveria ter impedido a publicação de evento com tipo pago de R$ 1,00')

  const typesValid = [
    { id: '2', name: 'Inscrição Gratuita', value: 0, status: 'active' },
    { id: '3', name: 'Inscrição VIP', value: 50.0, status: 'active' },
  ]
  const pubResValid = validateEventCanPublish(typesValid)
  if (!pubResValid.allowed) throw new Error('Deveria ter permitido a publicação de evento com tipos válidos')
})

console.log('\nResultado: ' + passed + ' passaram, ' + failed + ' falharam.\n')

if (failed > 0) {
  process.exit(1)
}
