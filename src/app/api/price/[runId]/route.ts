import { getRun } from 'workflow/api'
import { mergePriceTrace, type PriceTraceStep } from '@/lib/pricing/trace'

interface WorkflowResult {
  price: number
  sources: string[]
  source: 'ebay' | 'web_search' | 'estimated'
  trace?: PriceTraceStep[]
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params
  const run = getRun(runId)
  const status = await run.status

  if (status === 'completed') {
    const result = await run.returnValue as WorkflowResult
    return Response.json({
      status,
      price: result.price,
      sources: result.sources,
      source: result.source,
      workflowTrace: result.trace ?? [],
    })
  }

  if (status === 'failed') {
    return Response.json({ status }, { status: 500 })
  }

  return Response.json({ status })
}
