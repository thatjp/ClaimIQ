import { getRun } from 'workflow/api'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params
  const run = getRun(runId)
  const status = await run.status

  if (status === 'completed') {
    const result = await run.returnValue as { price: number; sources: string[] }
    return Response.json({ status, price: result.price, sources: result.sources })
  }

  if (status === 'failed') {
    return Response.json({ status }, { status: 500 })
  }

  return Response.json({ status })
}
