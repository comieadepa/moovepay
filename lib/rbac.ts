import { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'

export type AuthContext = {
  userId: string
  email: string
  role: string
  tenantId: string
}

export function getAuthContext(request: NextRequest): AuthContext | null {
  const token = request.cookies.get('token')?.value
  if (!token) return null

  const verified = verifyToken(token)
  if (!verified) return null

  const userId = verified.userId
  const email = verified.email
  const role = verified.role || 'user'
  const tenantId = verified.tenantId || verified.userId

  return { userId, email, role, tenantId }
}

export function hasGlobalRole(ctx: AuthContext, allowed: string[]) {
  return allowed.includes(ctx.role)
}

export async function isTenantMember(tenantId: string, userId: string) {
  try {
    const { data, error } = await supabase
      .from('TenantMember')
      .select('id, role')
      .eq('tenantId', tenantId)
      .eq('userId', userId)
      .maybeSingle()

    if (error) throw error
    return data
  } catch (error: any) {
    const message = String(error?.message || '')
    // Se a migration ainda não foi aplicada, volta ao comportamento antigo:
    // o tenant do usuário é o próprio userId.
    if (message.includes("Could not find the table 'public.TenantMember'")) {
      return tenantId === userId ? { id: 'legacy', role: 'owner' } : null
    }
    throw error
  }
}
