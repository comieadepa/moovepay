import 'server-only'
import { createClient } from '@supabase/supabase-js'

// ⚠️ NUNCA EXPORTAR PARA CLIENT-SIDE
// Apenas usar em Server Components, Route Handlers, Server Actions

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables')
}

// Cliente com SERVICE_ROLE_KEY (bypass RLS, acesso total)
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// ==================== TIPOS ====================
export interface User {
  id: string
  name: string
  email: string
  password: string
  cpf?: string
  whatsapp?: string
  avatarUrl?: string
  address?: any
  role: string
  createdAt: string
  updatedAt: string
}

export interface Event {
  id: string
  creatorId: string
  name: string
  slug: string
  description?: string
  logo?: string
  banner?: string
  startDate: string
  endDate?: string
  status: string
  customFields?: any // JSONB
  createdAt: string
  updatedAt: string
}

export interface Registration {
  id: string
  eventId: string
  inscriptionTypeId: string
  fullName: string
  email: string
  whatsapp?: string
  cpf: string
  customData?: any // JSONB
  status: string
  totalValue: number
  cartId?: string
  createdAt: string
  updatedAt: string
}

// ==================== HELPERS ====================

/**
 * Buscar usuário por email
 */
export async function getUserByEmail(email: string) {
  const { data, error } = await supabase
    .from('User')
    .select('*')
    .eq('email', email)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw error
  }

  return data as User
}

/**
 * Criar novo usuário
 */
export async function createUser(userData: {
  name: string
  email: string
  password: string
  cpf?: string
  whatsapp?: string
}) {
  const { data, error } = await supabase
    .from('User')
    .insert({
      ...userData,
      role: 'user',
    })
    .select()
    .single()

  if (error) throw error
  return data as User
}

/**
 * Criar registro de inscrição
 */
export async function createRegistration(registrationData: {
  eventId: string
  inscriptionTypeId: string
  fullName: string
  email: string
  whatsapp?: string
  cpf: string
  customData?: any
  totalValue: number
  status?: string
  cartId?: string
}) {
  const { data, error } = await supabase
    .from('Registration')
    .insert({
      ...registrationData,
      status: registrationData.status || 'pending',
    })
    .select()
    .single()

  if (error) throw error
  return data as Registration
}

/**
 * Buscar evento por ID
 */
export async function getEventById(eventId: string) {
  const { data, error } = await supabase
    .from('Event')
    .select('*')
    .eq('id', eventId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }

  return data as Event
}

/**
 * Listar eventos de um usuário
 */
export async function getUserEvents(userId: string) {
  const { data, error } = await supabase
    .from('Event')
    .select('*')
    .eq('creatorId', userId)
    .order('createdAt', { ascending: false })

  if (error) throw error
  return data as Event[]
}
