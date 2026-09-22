import { NextRequest } from 'next/server'
import { POST as canonicalAsaasWebhookHandler } from '@/app/api/webhooks/asaas/route'

export const dynamic = 'force-dynamic'

/**
 * Rota Legada de Webhook Asaas: /api/v1/asaas/webhook
 * Delega 100% da execução para o handler canônico em /api/webhooks/asaas.
 * 
 * Isso garante:
 * - Mesma validação de autenticação via ASAAS_WEBHOOK_TOKEN.
 * - Idempotência e associação determinística (cartId, orderReference e externalId).
 * - Atualização consistente de Payment e Registration.
 * - Emissão padronizada de Vouchers com QR Code e disparo de e-mails.
 */
export async function POST(request: NextRequest) {
  return canonicalAsaasWebhookHandler(request)
}
