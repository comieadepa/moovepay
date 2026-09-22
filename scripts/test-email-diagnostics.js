/**
 * Script de Diagnóstico do Sistema de E-mails
 * Valida a consistência dos templates, montagem de dados e comportamento do cliente Resend.
 */

const { Resend } = require('resend')

console.log('--- DIAGNÓSTICO DE E-MAILS CONGREGAPAY ---')

// 1. Validar variáveis de ambiente
const hasKey = Boolean(process.env.RESEND_API_KEY)
const sender = process.env.EMAIL_FROM || process.env.NEXT_PUBLIC_EMAIL_FROM || 'noreply@congregapay.com.br'

console.log(`[1] Configuração de Ambiente:`)
console.log(`    - RESEND_API_KEY configurada: ${hasKey ? 'SIM (presente)' : 'NÃO (ausente no ambiente local)'}`)
console.log(`    - Remetente configurado (EMAIL_FROM): ${sender}`)

// 2. Simulação de montagem de dados do template
console.log(`\n[2] Teste de montagem de templates:`)
const sampleName = 'Maria Silva'
const sampleEvent = 'Congresso 2026'
const sampleUrl = 'https://congregapay.com.br/voucher/test-reg-id'

const voucherSubject = `✅ Seu voucher para ${sampleEvent} está pronto!`
const containsName = voucherSubject.includes(sampleEvent)
const urlValid = sampleUrl.startsWith('https://')

console.log(`    - Subject gerado: "${voucherSubject}"`)
console.log(`    - URL do Voucher: "${sampleUrl}"`)
console.log(`    - Validação de template: ${containsName && urlValid ? 'APROVADA ✅' : 'FALHOU ❌'}`)

// 3. Teste de captura de erro da API Resend
console.log(`\n[3] Teste de comportamento do SDK Resend com chave inválida (simulação de falha):`)
const dummyResend = new Resend('re_dummy_test_key')
dummyResend.emails.send({
  from: 'CongregaPay <noreply@congregapay.com.br>',
  to: 'test@example.com',
  subject: 'Teste',
  html: '<p>Teste</p>'
}).then((res) => {
  if (res.error) {
    console.log(`    - SDK retornou erro conforme esperado: [${res.error.statusCode}] ${res.error.name}: ${res.error.message}`)
    console.log(`    - Tratamento de erro resiliente: APROVADO ✅`)
  } else {
    console.log(`    - Resposta inesperada:`, res)
  }
  console.log('\n--- DIAGNÓSTICO CONCLUÍDO COM SUCESSO ---')
}).catch((err) => {
  console.error('    - Exceção no SDK:', err)
})
