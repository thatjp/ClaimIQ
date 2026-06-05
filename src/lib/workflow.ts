import { start } from 'workflow/api'
import { priceItemWorkflow } from '@/workflows/price'

export interface ClaimItemInput {
  id?: string
  name: string
  brand?: string
  model?: string
  condition: string
  estimatedAge?: number
  quantity?: number
}

export interface WorkflowResult {
  workflowRunId: string
  status: 'pending'
}

export async function triggerPriceWorkflow(
  item: ClaimItemInput | undefined
): Promise<WorkflowResult> {
  if (!item) {
    return { workflowRunId: 'mock-no-item', status: 'pending' }
  }

  const run = await start(priceItemWorkflow, [item])
  return { workflowRunId: run.runId, status: 'pending' }
}
