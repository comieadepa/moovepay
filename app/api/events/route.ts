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

    // Verifica membership — se a tabela não existir ainda (migration pendente), usa fallback por creatorId
    let useTenantFilter = true
    try {
      let member = await isTenantMember(tenantId, verified.userId)
      if (!member) {
        if (tenantId === verified.userId) {
          try {
            await supabase.from('Tenant').upsert({ id: tenantId, name: verified.email }, { onConflict: 'id' })
            await supabase.from('TenantMember').insert({ tenantId, userId: verified.userId, role: 'owner' })
          } catch {
            // insert falhou (já existe ou tabela ausente) — continua
          }
        } else {
          return NextResponse.json({ error: 'Não autorizado (tenant)' }, { status: 403 })
        }
      }
    } catch {
      // Migration de multi-tenant não aplicada — usa fallback por creatorId
      useTenantFilter = false
    }

    let query = supabase
      .from('Event')
      .select(`
        *,
        registrations:Registration(id),
        payments:Payment(value, status),
        inscriptionTypes:InscriptionType(value)
      `)
      .order('createdAt', { ascending: false })

    if (useTenantFilter) {
      query = query.eq('tenantId', tenantId)
    } else {
      query = query.eq('creatorId', verified.userId)
    }

    const { data: events, error: eventsError } = await query

    if (eventsError) {
      // Tabela Event não existe ainda — retorna lista vazia sem erro
      const msg = String((eventsError as any)?.message || '')
      if (msg.includes('does not exist') || msg.includes('PGRST')) {
        return NextResponse.json({ success: true, events: [] }, { status: 200 })
      }
      throw eventsError
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

    if (!member) return NextResponse.json({ error: 'Não autorizado (tenant)' }, { status: 403 })
    if (!['owner', 'admin'].includes(member.role)) {
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

    payload.tenantId = tenantId

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
