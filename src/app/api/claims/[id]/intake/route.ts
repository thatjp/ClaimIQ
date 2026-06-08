/*
 * WORKFLOW
 * The first iteration of this pipeline was a single API route: call the AI model,
 * parse the response, begin pricing lookups. It worked for simple cases but was
 * fragile — a slow SerpAPI call or a DB write failure would take down the entire run
 * with no way to resume or diagnose where it broke.
 *
 * Moving to Vercel Workflow gave each stage a durable checkpoint. The Workflows UI
 * made it immediately clear where failures were occurring, which is how I identified
 * that the pricing lookups needed to be replaced with a structured SerpAPI pipeline
 * rather than open-ended model-driven searches.
 *
 * The workflow boundary also created a natural containment layer for AI calls —
 * runaway token usage, looping tool calls, and slow responses are now observable
 * and isolated to individual steps rather than silently failing the whole intake.
 */
import { db } from '@/lib/db'
import { triggerIntakeWorkflow } from '@/lib/workflow'

export const maxDuration = 60

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: claimId } = await params

  const { rows } = await db`SELECT id FROM claims WHERE id = ${claimId} LIMIT 1`
  if (rows.length === 0) {
    return Response.json({ error: 'Claim not found' }, { status: 404 })
  }

  let body: { text?: string; imageBase64?: string | null }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.text?.trim()) {
    return Response.json({ error: 'text is required' }, { status: 400 })
  }

  try {
    const result = await triggerIntakeWorkflow(claimId, body.text, body.imageBase64)
    // Persist so dashboard can reconnect to in-flight runs after page navigation
    await db`
      UPDATE claims
      SET intake_run_id = ${result.workflowRunId}, intake_key = ${result.intakeKey}
      WHERE id = ${claimId}
    `
    return Response.json(result, { status: 202 })
  } catch (err) {
    console.error('[intake] Failed to trigger workflow:', err)
    return Response.json({ error: 'Failed to start intake' }, { status: 500 })
  }
}
