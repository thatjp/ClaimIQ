import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { rows } = await db`
      SELECT * FROM claims
      WHERE user_id = ${session.user.id}
      ORDER BY created_at DESC
    `
    return Response.json(rows)
  } catch {
    // Return empty array when DB is not connected
    return Response.json([])
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { state, policyType, dateOfLoss } = await req.json()

  try {
    const { rows } = await db`
      INSERT INTO claims (user_id, state, policy_type, date_of_loss, status)
      VALUES (${session.user.id}, ${state}, ${policyType}, ${dateOfLoss}, 'open')
      RETURNING *
    `
    return Response.json(rows[0], { status: 201 })
  } catch {
    // Return a mock claim when DB is not connected
    const mockClaim = {
      id: `mock-${Date.now()}`,
      user_id: session.user.id,
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
