/* eslint-disable no-console */

const { createClient } = require('@supabase/supabase-js')

function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const [key, maybeValue] = token.slice(2).split('=')
    if (maybeValue !== undefined) {
      args[key] = maybeValue
    } else {
      const next = argv[i + 1]
      if (next && !next.startsWith('--')) {
        args[key] = next
        i++
      } else {
        args[key] = true
      }
    }
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv)

  const eventId = String(args.eventId || '')
  const toEmail = String(args.toEmail || '')

  if (!eventId || !toEmail) {
    console.error('Uso: --eventId <uuid> --toEmail <email>')
    process.exit(1)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Faltam variáveis do Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: toUser, error: toUserError } = await supabase
    .from('User')
    .select('id, email, name, role, defaultTenantId')
    .eq('email', toEmail)
    .maybeSingle()

  if (toUserError) throw toUserError
  if (!toUser?.id) {
    console.error('Usuário destino não encontrado:', toEmail)
    process.exit(1)
  }

  const { data: event, error: eventError } = await supabase
    .from('Event')
    .select('id, name, slug, status, creatorId, tenantId')
    .eq('id', eventId)
    .maybeSingle()

  if (eventError) throw eventError
  if (!event?.id) {
    console.error('Evento não encontrado:', eventId)
    process.exit(1)
  }

  const targetTenantId = toUser.defaultTenantId || toUser.id

  console.log('BEFORE', {
    eventId: event.id,
    name: event.name,
    slug: event.slug,
    status: event.status,
    creatorId: event.creatorId,
    tenantId: event.tenantId,
  })

  const { data: updated, error: updateError } = await supabase
    .from('Event')
    .update({ creatorId: toUser.id, tenantId: targetTenantId })
    .eq('id', eventId)
    .select('id, name, slug, status, creatorId, tenantId')
    .single()

  if (updateError) throw updateError

  // Best-effort: garantir que o usuário é membro/owner do tenant dele
  try {
    const { data: existingMember, error: memberFetchError } = await supabase
      .from('TenantMember')
      .select('id, role')
      .eq('tenantId', targetTenantId)
      .eq('userId', toUser.id)
      .maybeSingle()

    if (memberFetchError) throw memberFetchError

    if (!existingMember?.id) {
      await supabase.from('TenantMember').insert({ tenantId: targetTenantId, userId: toUser.id, role: 'owner' })
    }

    // Best-effort: setar defaultTenantId se estiver vazio
    if (!toUser.defaultTenantId) {
      await supabase.from('User').update({ defaultTenantId: targetTenantId }).eq('id', toUser.id)
    }
  } catch (e) {
    console.warn('Aviso: não foi possível garantir TenantMember/defaultTenantId:', e && e.message ? e.message : e)
  }

  console.log('AFTER', updated)
  console.log('OK: evento transferido para', { toEmail: toUser.email, toUserId: toUser.id, tenantId: targetTenantId })
}

main().catch((e) => {
  console.error('ERR', e && e.message ? e.message : e)
  process.exit(1)
})
