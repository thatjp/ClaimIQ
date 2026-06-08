import { db } from '@/lib/db'

const DEMO_USER_ID = 'demo'

export async function GET() {
  try {
    const { rows } = await db`
      SELECT id, title, state, policy_type, date_of_loss, status, intake_run_id, intake_key, created_at
      FROM claims
      WHERE user_id = ${DEMO_USER_ID}
      ORDER BY created_at DESC
    `
    return Response.json(rows)
  } catch {
    return Response.json([])
  }
}

export async function POST(req: Request) {
  const { title, state, policyType, dateOfLoss } = await req.json()

  try {
    const { rows } = await db`
      INSERT INTO claims (user_id, title, state, policy_type, date_of_loss, status)
      VALUES (${DEMO_USER_ID}, ${title ?? null}, ${state}, ${policyType}, ${dateOfLoss}, 'open')
      RETURNING *
    `
    return Response.json(rows[0], { status: 201 })
  } catch (err) {
    console.error('Failed to create claim:', err)
    return Response.json({ error: 'Failed to create claim' }, { status: 500 })
  }
}
