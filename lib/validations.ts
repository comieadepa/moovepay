import { z } from 'zod'

// ==================== AUTH ====================
export const signUpSchema = z.object({
  email: z.string().email('Email inválido'),
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Senhas não conferem',
  path: ['confirmPassword'],
})

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
})

export const adminLoginSchema = loginSchema.extend({
  adminCode: z.string().min(1, 'Código do admin é obrigatório'),
})

// ==================== PERFIL ====================
const emptyToUndefined = (v: unknown) => {
  if (typeof v === 'string' && v.trim() === '') return undefined
  return v
}

export const addressSchema = z
  .object({
    cep: z.preprocess(emptyToUndefined, z.string().min(8).max(9).optional()),
    logradouro: z.preprocess(emptyToUndefined, z.string().min(2).optional()),
    numero: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    complemento: z.preprocess(emptyToUndefined, z.string().optional()),
    bairro: z.preprocess(emptyToUndefined, z.string().optional()),
    cidade: z.preprocess(emptyToUndefined, z.string().optional()),
    uf: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .length(2, 'UF deve ter 2 caracteres')
        .transform((v) => v.toUpperCase())
        .optional()
    ),
  })
  .partial()

export const profileUpdateSchema = z.object({
  name: z.preprocess(emptyToUndefined, z.string().min(3, 'Nome deve ter pelo menos 3 caracteres').optional()),
  whatsapp: z.preprocess(emptyToUndefined, z.string().min(8, 'Celular deve ter pelo menos 8 caracteres').optional()),
  avatarUrl: z.preprocess(emptyToUndefined, z.string().url('URL da foto inválida').optional()),
  address: addressSchema.optional(),
})

// ==================== EVENTO ====================
export const eventCustomFieldSchema = z.object({
  key: z.string().min(1, 'Chave do campo é obrigatória'),
  label: z.string().min(1, 'Nome do campo é obrigatório'),
  type: z.enum(['text', 'textarea', 'number', 'date', 'select', 'checkbox']),
  required: z.boolean().optional().default(false),
  placeholder: z.string().optional(),
  options: z.array(z.string().min(1)).optional(),
}).superRefine((val, ctx) => {
  if (val.type === 'select' && (!val.options || val.options.length === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe opções para o campo select', path: ['options'] })
  }
})

export const createEventSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  description: z.string().optional(),
  banner: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().url().optional()
  ),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  customFields: z.array(eventCustomFieldSchema).optional(),
})

export const inscriptionTypeSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  value: z.coerce.number().positive('Valor deve ser positivo'),
  available: z.coerce.number().int().nonnegative('Disponibilidade deve ser não-negativa'),
})

// ==================== INSCRIÇÃO ====================
const participantSchema = z.object({
  fullName: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF inválido'),
  email: z.string().email('Email inválido'),
  whatsapp: z.string().optional(),
  customData: z.record(z.any()).optional(),
})

// Aceita formato legado (1 participante) e o novo formato (lote)
export const registrationSchema = z.union([
  z.object({
    eventId: z.string().min(1),
    inscriptionTypeId: z.string().min(1),
    fullName: participantSchema.shape.fullName,
    cpf: participantSchema.shape.cpf,
    email: participantSchema.shape.email,
    whatsapp: participantSchema.shape.whatsapp,
    customData: participantSchema.shape.customData,
  }),
  z.object({
    eventId: z.string().min(1),
    inscriptionTypeId: z.string().min(1),
    quantity: z.coerce.number().int().min(1).max(50).default(1),
    participants: z.array(participantSchema).min(1),
  }).superRefine((val, ctx) => {
    if (val.participants.length !== val.quantity) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Quantidade não confere com participantes', path: ['participants'] })
    }
  }),
])

// ==================== PAGAMENTO ====================
export const paymentSchema = z.object({
  method: z.enum(['pix', 'cartao', 'boleto']),
  value: z.number().positive('Valor deve ser positivo'),
})

export const pixPaymentSchema = paymentSchema.extend({
  method: z.literal('pix'),
})

export const cardPaymentSchema = paymentSchema.extend({
  method: z.literal('cartao'),
  cardNumber: z.string().regex(/^\d{16}$/, 'Número de cartão inválido'),
  cardName: z.string(),
  cardExpiry: z.string().regex(/^\d{2}\/\d{2}$/, 'Data inválida'),
  cardCvv: z.string().regex(/^\d{3,4}$/, 'CVV inválido'),
  installments: z.number().int().min(1).max(12),
})

// ==================== SUPORTE ====================
export const createSupportTicketSchema = z.object({
  subject: z.string().min(3, 'Assunto deve ter pelo menos 3 caracteres'),
  message: z.string().min(10, 'Mensagem deve ter pelo menos 10 caracteres'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().default('normal'),
})

export const updateSupportTicketSchema = z.object({
  message: z.string().min(1).optional(),
  status: z.enum(['open', 'pending', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
})

export type SignUpInput = z.infer<typeof signUpSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type AdminLoginInput = z.infer<typeof adminLoginSchema>
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>
export type CreateEventInput = z.infer<typeof createEventSchema>
export type EventCustomFieldInput = z.infer<typeof eventCustomFieldSchema>
export type RegistrationInput = z.infer<typeof registrationSchema>
export type PaymentInput = z.infer<typeof paymentSchema>
export type CardPaymentInput = z.infer<typeof cardPaymentSchema>
export type CreateSupportTicketInput = z.infer<typeof createSupportTicketSchema>
export type UpdateSupportTicketInput = z.infer<typeof updateSupportTicketSchema>
