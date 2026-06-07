import { kv } from '@/lib/kv'
import { db } from '@/lib/db'

// Dev-only endpoint — clears the price cache (KV + item_prices) so workflows
// hit live sources instead of returning cached results.
export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'Not available in production' }, { status: 403 })
  }

  const results: { step: string; detail: string }[] = []

  // Clear KV price keys (price:* pattern)
  try {
    const keys = await kv.keys('price:*')
    if (keys.length > 0) {
      await kv.del(...keys)
    }
    results.push({ step: 'kv', detail: `Deleted ${keys.length} price key${keys.length === 1 ? '' : 's'}` })
  } catch (err) {
    results.push({ step: 'kv', detail: `Error: ${err instanceof Error ? err.message : String(err)}` })
  }

  // Clear item_prices table
  try {
    await db`TRUNCATE TABLE item_prices RESTART IDENTITY`
    results.push({ step: 'item_prices', detail: 'Truncated' })
  } catch (err) {
    results.push({ step: 'item_prices', detail: `Error: ${err instanceof Error ? err.message : String(err)}` })
  }

  return Response.json({ ok: true, results })
}
