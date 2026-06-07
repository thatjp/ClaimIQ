import { db } from '@/lib/db'

const DEMO_USER_ID = 'demo'

export async function GET() {
  try {
    const { rows } = await db`
      SELECT id, state, policy_type, date_of_loss, status, intake_run_id, intake_key, created_at
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
  const { state, policyType, dateOfLoss } = await req.json()

  try {
    const { rows } = await db`
      INSERT INTO claims (user_id, state, policy_type, date_of_loss, status)
      VALUES (${DEMO_USER_ID}, ${state}, ${policyType}, ${dateOfLoss}, 'open')
      RETURNING *
    `
    return Response.json(rows[0], { status: 201 })
  } catch {
    const mockClaim = {
      id: `mock-${Date.now()}`,
      user_id: DEMO_USER_ID,
      state: state || 'CA',
      policy_type: policyType || 'HO-3',
      date_of_loss: dateOfLoss || new Date().toISOString().split('T')[0],
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    return Response.json(mockClaim, { status: 201 })
  }
}
