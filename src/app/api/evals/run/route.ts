import { runEvals, evalsPassed } from '@/lib/evals/runner'
import type { RunEvalsOptions } from '@/lib/evals/types'

export const maxDuration = 300

export async function POST(req: Request) {
  let options: RunEvalsOptions = {}

  try {
    const body = await req.json().catch(() => ({}))
    options = {
      extractionOnly: body.extractionOnly === true,
      pricingOnly: body.pricingOnly === true,
    }
  } catch {
    // empty body is fine
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(data)}\n`))
      }

      try {
        const report = await runEvals({
          ...options,
          onProgress: (progress) => send({ type: 'progress', ...progress }),
        })

        send({
          type: 'complete',
          report,
          passed: evalsPassed(report, options),
        })
      } catch (err) {
        send({
          type: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
    },
  })
}
