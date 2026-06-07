import { getRun } from 'workflow/api'
import { readIntakeProgress } from '@/lib/pricing/intake-progress'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  const { runId } = await params
  const { searchParams } = new URL(req.url)
  const intakeKey = searchParams.get('intakeKey')

  // Check workflow status — used only for failure detection
  let workflowStatus = 'pending'
  try {
    const run = getRun(runId)
    workflowStatus = await run.status
  } catch {
    // workflow SDK unavailable — proceed with KV data
  }

  if (workflowStatus === 'failed') {
    return Response.json({ phase: 'error', items: [], error: 'Workflow failed', workflowStatus }, { status: 500 })
  }

  // KV is the canonical source of truth for progress
  if (intakeKey) {
    try {
      const progress = await readIntakeProgress(intakeKey)
      if (progress) {
        return Response.json({ ...progress, workflowStatus })
      }
    } catch {
      // KV read failed — fall through to default
    }
  }

  // Not ready yet (workflow just started, KV not written)
  return Response.json({ phase: 'extracting', items: [], workflowStatus })
}
