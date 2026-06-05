import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
})

type QueryResult = { rows: Record<string, unknown>[] }

export function db(strings: TemplateStringsArray, ...values: unknown[]): Promise<QueryResult> {
  let text = ''
  const params: unknown[] = []
  strings.forEach((str, i) => {
    text += str
    if (i < values.length) {
      params.push(values[i])
      text += `$${params.length}`
    }
  })
  return pool.query(text, params)
}
