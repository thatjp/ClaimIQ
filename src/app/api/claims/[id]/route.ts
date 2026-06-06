import { getClaim } from '@/lib/claims'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const claim = await getClaim(id)

  if (!claim) {
    return Response.json({ error: 'Claim not found' }, { status: 404 })
  }

  return Response.json(claim)
}
