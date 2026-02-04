/* eslint-disable no-console */

const { createClient } = require('@supabase/supabase-js')
const bcrypt = require('bcryptjs')

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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Faltam variáveis do Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local')
    process.exit(1)
  }

  const email = args.email || process.env.BOOTSTRAP_ADMIN_EMAIL
  const password = args.password || process.env.BOOTSTRAP_ADMIN_PASSWORD
  const name = args.name || process.env.BOOTSTRAP_ADMIN_NAME || 'Admin'
  const role = (args.role || process.env.BOOTSTRAP_ADMIN_ROLE || 'admin').toString()

  if (!email || !password) {
    console.error('Uso: --email voce@empresa.com --password "senha-forte" [--name "Nome"] [--role admin]')
    console.error('Ou via env: BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD / BOOTSTRAP_ADMIN_NAME / BOOTSTRAP_ADMIN_ROLE')
    process.exit(1)
  }

  if (!['admin', 'support', 'finance'].includes(role)) {
    console.error('role inválida. Use: admin | support | finance')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: existing, error: existingError } = await supabase
    .from('User')
    .select('id, email, role')
    .eq('email', email)
    .maybeSingle()

  if (existingError) {
    console.error('Erro ao buscar usuário existente:', existingError)
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 10)

  let user = existing
  if (!user?.id) {
    const { data: created, error: createError } = await supabase
      .from('User')
      .insert({ name, email, password: passwordHash, role })
      .select('id, name, email, role')
      .single()

    if (createError) {
      console.error('Erro ao criar usuário:', createError)
      process.exit(1)
    }

    user = created
    console.log(`Usuário staff criado: ${user.email} (${user.role}) id=${user.id}`)
  } else {
    const { error: updateError } = await supabase
      .from('User')
      .update({ name, password: passwordHash, role })
      .eq('id', user.id)

    if (updateError) {
      console.error('Erro ao atualizar usuário existente:', updateError)
      process.exit(1)
    }

    console.log(`Usuário staff atualizado: ${email} (${role}) id=${user.id}`)
  }

  // Best-effort multi-tenant bootstrap (caso as migrations existam)
  try {
    await supabase.from('Tenant').insert({ id: user.id, name })
    await supabase.from('TenantMember').insert({ tenantId: user.id, userId: user.id, role: 'owner' })
    await supabase.from('User').update({ defaultTenantId: user.id }).eq('id', user.id)
  } catch (e) {
    console.warn('Multi-tenant bootstrap ignorado (talvez migrations não aplicadas):', e?.message || e)
  }

  console.log('Pronto. Agora acesse /admin/login com: email + senha + Código do Admin (ADMIN_ACCESS_CODE).')
}

main().catch((e) => {
  console.error('Falha inesperada:', e)
  process.exit(1)
})
