import { start } from 'workflow/api'
import { priceItemWorkflow } from '@/workflows/price'

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
  /** When set, skip full ladder and price from this claim source URL (first source). */
  refreshFromSource?: string
  /** All claim source URLs — preserved on source refresh (first is primary). */
  priceSources?: string[]
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
