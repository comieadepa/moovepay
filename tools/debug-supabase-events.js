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

  const email = String(args.email || '')
  const nameLike = String(args.nameLike || '')

  if (!email) {
    console.error('Uso: --email voce@dominio.com [--nameLike "PARTE DO NOME DO EVENTO"]')
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

  const { data: user, error: userError } = await supabase
    .from('User')
    .select('id, email, name, role, defaultTenantId')
    .eq('email', email)
    .maybeSingle()

  if (userError) throw userError

  console.log('USER', user)

  if (!user?.id) {
    console.log('Nenhum usuário encontrado com esse email.')
    return
  }

  const eventQuery = supabase
    .from('Event')
    .select('id, name, slug, status, creatorId, tenantId, createdAt, startDate')
    .order('createdAt', { ascending: false })

  const { data: events, error: eventsError } = nameLike
    ? await eventQuery.ilike('name', `%${nameLike}%`)
    : await eventQuery.eq('creatorId', user.id)

  if (eventsError) throw eventsError

  console.log('EVENTS', events)

  try {
    const { data: members, error: membersError } = await supabase
      .from('TenantMember')
      .select('id, tenantId, userId, role')
      .eq('userId', user.id)

    if (membersError) throw membersError

    console.log('TENANT_MEMBERS', members)
  } catch (e) {
    console.log('TENANT_MEMBERS', '(skipped)', String(e && e.message ? e.message : e))
  }
}

main().catch((e) => {
  console.error('ERR', e && e.message ? e.message : e)
  process.exit(1)
})
