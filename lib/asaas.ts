import 'server-only'
import axios from 'axios'

// Prefer server-only var; fallback para manter compatibilidade com .env.local existente
const ASAAS_API_URL = process.env.ASAAS_API_URL || process.env.NEXT_PUBLIC_ASAAS_API_URL
const ASAAS_API_KEY = process.env.ASAAS_API_KEY

const asaasClient = axios.create({
  baseURL: ASAAS_API_URL,
  headers: {
    'accept': 'application/json',
    'access_token': ASAAS_API_KEY,
  },
})

// ==================== TIPOS ====================
export interface AsaasPaymentRequest {
  customer: string
  billingType: 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX' | 'BOLETO'
  value: number
  dueDate: string
  description: string
  externalReference?: string
  notificationUrl?: string
}

export interface AsaasPixRequest extends AsaasPaymentRequest {
  billingType: 'PIX'
}

export interface AsaasCardRequest extends AsaasPaymentRequest {
  billingType: 'CREDIT_CARD'
  creditCard: {
    holderName: string
    number: string
    expiryMonth: string
    expiryYear: string
    ccv: string
  }
  creditCardHolderInfo: {
    name: string
    email: string
    cpfCnpj: string
    phone: string
    mobilePhone: string
    address: string
    addressNumber: string
    complement?: string
    province: string
    city: string
    postalCode: string
  }
  installmentCount?: number
}

// ==================== MÉTODOS ====================

// Criar pagamento via PIX
export async function createPixPayment(data: AsaasPixRequest) {
  try {
    const response = await asaasClient.post('/payments', data)
    return response.data
  } catch (error) {
    console.error('Erro ao criar pagamento PIX:', error)
    throw error
  }
}

// Criar pagamento via Cartão
export async function createCardPayment(data: AsaasCardRequest) {
  try {
    const response = await asaasClient.post('/payments', data)
    return response.data
  } catch (error) {
    console.error('Erro ao criar pagamento com cartão:', error)
    throw error
  }
}

// Criar boleto
export async function createBoletoPayment(data: AsaasPaymentRequest) {
  try {
    const response = await asaasClient.post('/payments', {
      ...data,
      billingType: 'BOLETO',
    })
    return response.data
  } catch (error) {
    console.error('Erro ao criar boleto:', error)
    throw error
  }
}

// Buscar pagamento
export async function getPayment(id: string) {
  try {
    const response = await asaasClient.get(`/payments/${id}`)
    return response.data
  } catch (error) {
    console.error('Erro ao buscar pagamento:', error)
    throw error
  }
}

// Confirmar pagamento
export async function confirmPayment(id: string) {
  try {
    const response = await asaasClient.post(`/payments/${id}/confirm`)
    return response.data
  } catch (error) {
    console.error('Erro ao confirmar pagamento:', error)
    throw error
  }
}

// Listar pagamentos
export async function listPayments(filters?: Record<string, any>) {
  try {
    const response = await asaasClient.get('/payments', { params: filters })
    return response.data
  } catch (error) {
    console.error('Erro ao listar pagamentos:', error)
    throw error
  }
}

// Refundar pagamento
export async function refundPayment(id: string) {
  try {
    const response = await asaasClient.post(`/payments/${id}/refund`)
    return response.data
  } catch (error) {
    console.error('Erro ao reembolsar pagamento:', error)
    throw error
  }
}

// ==================== CLIENTES ====================

export interface AsaasCustomer {
  id: string
  name: string
  email: string
  cpfCnpj: string
}

export async function findOrCreateCustomer(data: {
  name: string
  email: string
  cpfCnpj: string
  mobilePhone?: string
}): Promise<AsaasCustomer> {
  // Busca cliente existente pelo CPF/CNPJ
  const searchRes = await asaasClient.get('/customers', {
    params: { cpfCnpj: data.cpfCnpj.replace(/\D/g, ''), limit: 1 },
  })
  const existing = searchRes.data?.data?.[0]
  if (existing?.id) return existing as AsaasCustomer

  // Cria novo cliente
  const createRes = await asaasClient.post('/customers', {
    name: data.name,
    email: data.email,
    cpfCnpj: data.cpfCnpj.replace(/\D/g, ''),
    mobilePhone: data.mobilePhone,
  })
  return createRes.data as AsaasCustomer
}

// ==================== PAGAMENTO GENÉRICO ====================

export interface AsaasGenericPaymentRequest {
  customer: string
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD'
  value: number
  dueDate: string
  description: string
  externalReference?: string
}

export async function createPayment(data: AsaasGenericPaymentRequest) {
  try {
    const response = await asaasClient.post('/payments', data)
    return response.data
  } catch (error) {
    console.error('Erro ao criar pagamento:', error)
    throw error
  }
}

// Buscar QR Code PIX de um pagamento
export async function getPixQrCode(paymentId: string): Promise<{ encodedImage: string; payload: string; expirationDate: string }> {
  try {
    const response = await asaasClient.get(`/payments/${paymentId}/pixQrCode`)
    return response.data
  } catch (error) {
    console.error('Erro ao buscar QR Code PIX:', error)
    throw error
  }
}
