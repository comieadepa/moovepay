const { Client } = require('pg')

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL não definido')

  const client = new Client({ connectionString })
  await client.connect()

  const { rows } = await client.query(
    "select table_name,column_name,data_type,udt_name,is_nullable from information_schema.columns where table_schema='public' and (table_name='User' or table_name='user') order by table_name,ordinal_position"
  )

  const tables = {}
  for (const r of rows) {
    if (!tables[r.table_name]) tables[r.table_name] = []
    tables[r.table_name].push({
      column: r.column_name,
      type: r.data_type,
      udt: r.udt_name,
      nullable: r.is_nullable,
    })
  }

  console.log(JSON.stringify(tables, null, 2))

  await client.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
