import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { createEventSchema } from '@/lib/validations'
import { supabase } from '@/lib/supabase-server'
import { isTenantMember } from '@/lib/rbac'

function slugify(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

async function ensureUniqueSlug(baseSlug: string) {
  let slug = baseSlug
  for (let i = 0; i < 20; i++) {
    const { data, error } = await supabase
      .from('Event')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    // Se a coluna/consulta falhar por algum motivo inesperado, não bloqueia criação
    if (error && (error as any)?.code !== 'PGRST116') {
      const msg = String((error as any)?.message || '')
      if (!msg.includes('PGRST')) {
        // segue; mas ainda tentamos usar o slug base
      }
    }

    if (!data?.id) return slug
    slug = `${baseSlug}-${i + 2}`
  }
  // fallback final
  return `${baseSlug}-${Date.now().toString(36)}`
}

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const verified = verifyToken(token)
    if (!verified) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    const tenantId = verified.tenantId || verified.userId

    // Se multi-tenant ainda não foi aplicado no banco, caímos no modo legado.
    const member = await isTenantMember(tenantId, verified.userId)
    const legacyMode = member?.id === 'legacy'
    if (!member && !legacyMode) {
      return NextResponse.json({ error: 'Não autorizado (tenant)' }, { status: 403 })
    }

    // Buscar eventos do usuário
    let events: any[] | null = null

    // Tenta multi-tenant (tenantId); se a coluna não existir, usa creatorId.
    const { data: eventsByTenant, error: tenantError } = await supabase
      .from('Event')
      .select(`
        *,
        registrations:Registration(id),
        payments:Payment(value, status)
      `)
      .eq('tenantId', tenantId)
      .order('createdAt', { ascending: false })

    if (tenantError) {
      const msg = String((tenantError as any)?.message || '')
      if (msg.includes('tenantId') || msg.includes('column') || msg.includes('schema cache')) {
        const { data: eventsByCreator, error: creatorError } = await supabase
          .from('Event')
          .select(`
            *,
            registrations:Registration(id),
            payments:Payment(value, status)
          `)
          .eq('creatorId', verified.userId)
          .order('createdAt', { ascending: false })
        if (creatorError) throw creatorError
        events = eventsByCreator
      } else {
        throw tenantError
      }
    } else {
      events = eventsByTenant
    }

    return NextResponse.json({ success: true, events }, { status: 200 })
  } catch (error) {
    console.error('Erro ao listar eventos:', error)
    return NextResponse.json(
      { error: 'Erro ao listar eventos' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const verified = verifyToken(token)
    if (!verified) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    const tenantId = verified.tenantId || verified.userId
    const member = await isTenantMember(tenantId, verified.userId)

    // No modo legado, o usuário é o próprio owner.
    if (!member) return NextResponse.json({ error: 'Não autorizado (tenant)' }, { status: 403 })
    if (member.id !== 'legacy' && !['owner', 'admin'].includes(member.role)) {
      return NextResponse.json({ error: 'Não autorizado (tenant)' }, { status: 403 })
    }

    const body = await request.json()

    // Validar dados
    const validatedData = createEventSchema.parse(body)

    // Criar evento
    const baseSlug = slugify(validatedData.name)
    const slug = await ensureUniqueSlug(baseSlug)

    const payload: any = {
      ...validatedData,
      slug,
      creatorId: verified.userId,
      status: 'draft',
    }

    // Se o banco já tem multi-tenant, salva tenantId.
    if (member.id !== 'legacy') {
      payload.tenantId = tenantId
    }

    const { data: event, error } = await supabase
      .from('Event')
      .insert(payload)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(
      { success: true, message: 'Evento criado com sucesso', event },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Erro ao criar evento:', error)

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Erro ao criar evento' },
      { status: 500 }
    )
  }
}
