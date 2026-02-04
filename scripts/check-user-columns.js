const { createClient } = require('@supabase/supabase-js')

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Env do Supabase ausente (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const candidates = [
    { column: 'avatarUrl', select: 'id, avatarUrl' },
    { column: 'photoUrl', select: 'id, photoUrl' },
    { column: 'address', select: 'id, address' },
    { column: 'endereco', select: 'id, endereco' },
  ]

  for (const c of candidates) {
    const { error } = await supabase.from('User').select(c.select).limit(1)
    console.log(`${c.column}: ${error ? 'NÃO' : 'SIM'}`)
    if (error) console.log(`  erro: ${error.message}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
