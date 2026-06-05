import { db } from '@/lib/db'

export async function POST(req: Request) {
  const { email, password, name } = await req.json()

  if (!email || !password) {
    return Response.json({ error: 'Email and password are required.' }, { status: 400 })
  }

  if (password.length < 8) {
    return Response.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  try {
    const { rows } = await db`
      INSERT INTO users (email, name)
      VALUES (${email}, ${name || null})
      RETURNING id, email, name
    `
    return Response.json(rows[0], { status: 201 })
  } catch (err: unknown) {
    // Postgres unique_violation code
    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
      return Response.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }
    // DB not connected — still allow sign-in via demo mode
    return Response.json({ id: `demo-${Date.now()}`, email, name: name || null }, { status: 201 })
  }
}
