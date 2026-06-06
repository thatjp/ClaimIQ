export const PRICE_LOOKUP_CONCURRENCY = 10

export async function mapWithConcurrencyLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>
): Promise<void> {
  if (items.length === 0) return

  const concurrency = Math.max(1, Math.min(limit, items.length))
  let nextIndex = 0

  async function runWorker() {
    while (true) {
      const index = nextIndex++
      if (index >= items.length) break
      await fn(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => runWorker()))
}
