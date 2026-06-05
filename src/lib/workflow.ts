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

/**
 * Stub for triggering the price workflow.
 * In production, this would call the Vercel Workflows API to start
 * a durable multi-step workflow that does web search + price normalization.
 *
 * The workflow pattern is critical here because price lookup involves:
 * 1. Web search (slow, 5-15 seconds)
 * 2. LLM price normalization
 * 3. DB + KV cache storage
 *
 * A plain serverless function risks timeout. Workflows persist each step,
 * so a failure mid-way resumes from the last checkpoint.
 */
export async function triggerPriceWorkflow(
  item: ClaimItemInput | undefined
): Promise<WorkflowResult> {
  if (!item) {
    return { workflowRunId: 'mock-no-item', status: 'pending' }
  }

  // TODO: Replace with actual Vercel Workflows trigger when WDK is available
  // const { workflowRunId } = await fetch('/api/workflows/price', {
  //   method: 'POST',
  //   body: JSON.stringify({ item }),
  // }).then(r => r.json())
  // return { workflowRunId, status: 'pending' }

  return {
    workflowRunId: `mock-${Date.now()}-${item.name.replace(/\s+/g, '-').toLowerCase()}`,
    status: 'pending',
  }
}
