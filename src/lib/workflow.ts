import { start } from 'workflow/api'
import { priceItemWorkflow } from '@/workflows/price'
import { claimIntakeWorkflow, type IntakeInput } from '@/workflows/intake'
import { initIntakeProgress } from '@/lib/pricing/intake-progress'

export interface ClaimItemInput {
  id?: string
  name: string
  brand?: string
  model?: string
  category?: string
  condition: string
  estimatedAge?: number
  quantity?: number
  /** Server-generated id for publishing live trace progress to KV during workflow runs. */
  traceKey?: string
}

export interface WorkflowResult {
  workflowRunId: string
  status: 'pending'
}

export async function triggerPriceWorkflow(
  item: ClaimItemInput,
  traceKey?: string
): Promise<WorkflowResult> {
  if (!item) {
    return { workflowRunId: 'mock-no-item', status: 'pending' }
  }

  const workflowItem = traceKey ? { ...item, traceKey } : item
  const run = await start(priceItemWorkflow, [workflowItem])
  return { workflowRunId: run.runId, status: 'pending' }
}

export interface IntakeWorkflowResult {
  workflowRunId: string
  intakeKey: string
  status: 'pending'
}

export async function triggerIntakeWorkflow(
  claimId: string,
  text: string,
  imageBase64?: string | null
): Promise<IntakeWorkflowResult> {
  const intakeKey = crypto.randomUUID()

  // Init KV before start() so polling endpoint always finds a valid state
  await initIntakeProgress(intakeKey)

  const input: IntakeInput = { intakeKey, claimId, text, imageBase64 }
  const run = await start(claimIntakeWorkflow, [input])

  return { workflowRunId: run.runId, intakeKey, status: 'pending' }
}
