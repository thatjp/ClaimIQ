import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getClaim } from '@/lib/claims'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const claim = await getClaim(id)

  if (!claim) {
    return Response.json({ error: 'Claim not found' }, { status: 404 })
  }

  return Response.json(claim)
}
