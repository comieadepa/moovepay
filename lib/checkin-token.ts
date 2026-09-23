import crypto from 'crypto'

/**
 * Utilitários para geração e validação de tokens seguros de check-in móvel
 */

/**
 * Gera um token criptograficamente seguro e aleatório (URL-safe)
 */
export function generateCheckInToken(): string {
  return crypto.randomBytes(24).toString('base64url')
}

/**
 * Gera o hash SHA-256 de um token para armazenamento seguro e busca indexada
 */
export function hashCheckInToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex')
}

/**
 * Mascara o token para logs e exibição segura
 */
export function maskToken(token: string): string {
  if (!token || token.length < 8) return '***'
  return `${token.slice(0, 4)}...${token.slice(-4)}`
}

/**
 * Mascara CPF para proteção e minimização de dados na portaria móvel
 * Exemplo: "123.456.789-00" -> "***.456.789-**" ou "12345678900" -> "***.456.789-**"
 */
export function maskCpf(cpf?: string | null): string {
  if (!cpf) return 'Não informado'
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return '***'
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`
}

/**
 * Calcula a expiração de um link de check-in baseado estritamente nas datas do evento
 * Respeita o fuso horário oficial 'America/Sao_Paulo' (UTC-3).
 *
 * Regras explícitas:
 * 1. Se o evento possui 'endDate': o link expira no final do dia civil do 'endDate' (23:59:59.999 no fuso de Brasília).
 * 2. Se o evento NÃO possui 'endDate': o link expira no final do dia civil do 'startDate' (23:59:59.999 no fuso de Brasília).
 * 3. Se a data for no futuro ou no mesmo dia, o link é considerado ATIVO e dentro do prazo.
 */
export function calculateEventExpiration(startDateStr: string, endDateStr?: string | null): { expired: boolean; expiresAtIso: string } {
  // Define o fuso horário do projeto
  const TIMEZONE_OFFSET_MS = -3 * 60 * 60 * 1000 // UTC-3 (Brasília)

  const referenceDateStr = endDateStr || startDateStr
  const refDate = new Date(referenceDateStr)

  if (isNaN(refDate.getTime())) {
    // Fallback defensivo caso a data seja inválida
    return { expired: false, expiresAtIso: new Date(Date.now() + 86400000).toISOString() }
  }

  // Obter o ano, mês e dia da data de referência no fuso UTC-3
  const refLocal = new Date(refDate.getTime() + TIMEZONE_OFFSET_MS)
  const year = refLocal.getUTCFullYear()
  const month = refLocal.getUTCMonth()
  const day = refLocal.getUTCDate()

  // Fim do dia civil às 23:59:59.999 no fuso UTC-3 (equivalente a 02:59:59.999 UTC do dia seguinte)
  const endOfDayUtcMs = Date.UTC(year, month, day, 23, 59, 59, 999) - TIMEZONE_OFFSET_MS
  const expiresAt = new Date(endOfDayUtcMs)

  const now = Date.now()
  const expired = now > expiresAt.getTime()

  return {
    expired,
    expiresAtIso: expiresAt.toISOString(),
  }
}
