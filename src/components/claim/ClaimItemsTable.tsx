import type { ClaimItem } from '@/types/items'
import type { PriceTraceStep } from '@/lib/pricing/trace'
import { PriceLookupTrace } from '@/components/claim/PriceLookupTrace'

function SourceLinks({ sources }: { sources?: string[] | null }) {
  if (!sources || sources.length === 0) return <span className="text-gray-300 text-xs">—</span>
  const [first, ...rest] = sources
  const domain = new URL(first).hostname.replace('www.', '')
  return (
    <div className="text-xs">
      <a href={first} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
        {domain} ↗
      </a>
      {rest.length > 0 && <span className="text-gray-400 ml-1">+{rest.length}</span>}
    </div>
  )
}

function PriceSourceBadge({ source }: { source: ClaimItem['priceSource'] }) {
  const config: Record<string, { label: string; className: string; title: string; icon: string }> = {
    cache:               { label: 'KV Cache',         className: 'text-blue-600',   icon: '⚡', title: 'Exact match from Redis cache (7-day TTL)' },
    vector_cache:        { label: 'Vector Cache',     className: 'text-purple-600', icon: '🔮', title: 'Semantic match from pgvector similarity search (90-day TTL)' },
    vector_cache_stale:  { label: 'Stale Cache',      className: 'text-orange-500', icon: '⏳', title: 'Semantic match older than 90 days — may not reflect current market price' },
    ebay:                { label: 'eBay Sold',        className: 'text-yellow-600', icon: '🛒', title: 'Average of recent sold listings via eBay Finding API' },
    web_search:          { label: 'Live Web Search',  className: 'text-green-600',  icon: '🌐', title: 'Retrieved via Anthropic web search tool through Vercel Workflow' },
    estimated:           { label: 'AI Estimate',      className: 'text-gray-500',   icon: '🤖', title: 'Estimated by AI model — live pricing was unavailable. Review before use.' },
  }
  const c = config[source!]
  if (!c) return null
  return (
    <div className={`text-xs mt-0.5 font-medium ${c.className}`} title={c.title}>
      {c.icon} {c.label}
    </div>
  )
}

interface Props {
  items: ClaimItem[]
  getTraceForItem: (item: ClaimItem) => PriceTraceStep[] | undefined
  shouldReplay: (item: ClaimItem) => boolean
  isPricing: (item: ClaimItem) => boolean
  onRefreshPrice: (item: ClaimItem) => void
}

function ItemTraceRow({
  item,
  getTraceForItem,
  shouldReplay,
  isPricing,
}: {
  item: ClaimItem
  getTraceForItem: Props['getTraceForItem']
  shouldReplay: Props['shouldReplay']
  isPricing: Props['isPricing']
}) {
  const trace = getTraceForItem(item)
  if (!trace?.length && !isPricing(item)) return null
  return (
    <PriceLookupTrace
      trace={trace ?? []}
      replay={shouldReplay(item)}
      compact
    />
  )
}

export function ClaimItemsTable({
  items,
  getTraceForItem,
  shouldReplay,
  isPricing,
  onRefreshPrice,
}: Props) {
  const total = items.reduce((sum, i) => sum + (i.price || 0) * i.quantity, 0)

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Line Items ({items.length})</h2>
        {items.some((i) => i.price) && (
          <span className="text-sm font-semibold text-gray-900">${total.toLocaleString()}</span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-gray-400">No items added yet.</p>
        </div>
      ) : (
        <>
          <div className="md:hidden divide-y divide-gray-100">
            {items.map((item) => (
              <div key={item.id} className={`px-4 py-3 ${item.flagged ? 'bg-red-50' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 text-sm truncate">{item.name}</div>
                    {(item.brand || item.model) && (
                      <div className="text-xs text-gray-500">{[item.brand, item.model].filter(Boolean).join(' ')}</div>
                    )}
                    <ItemTraceRow
                      item={item}
                      getTraceForItem={getTraceForItem}
                      shouldReplay={shouldReplay}
                      isPricing={isPricing}
                    />
                    {item.flagged && item.flag_reason && (
                      <div className="text-xs text-red-600 mt-0.5">⚠ {item.flag_reason}</div>
                    )}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
                      <span className="capitalize">{item.condition}</span>
                      {item.estimated_age && <span>{item.estimated_age}y</span>}
                      <span>Qty {item.quantity}</span>
                    </div>
                    {item.price && (
                      <div className="mt-1">
                        {item.priceSource && <PriceSourceBadge source={item.priceSource} />}
                        <SourceLinks sources={item.price_sources} />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {item.price ? (
                      <span className="font-semibold text-gray-900 text-sm">${item.price.toLocaleString()}</span>
                    ) : (
                      <span className="text-gray-400 text-xs">{isPricing(item) ? 'Pricing…' : 'Pending'}</span>
                    )}
                    <button
                      onClick={() => onRefreshPrice(item)}
                      disabled={isPricing(item)}
                      className="text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
                    >
                      {isPricing(item) ? 'Pricing…' : 'Refresh'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Item</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Condition</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Age</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Qty</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Price</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Source</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className={item.flagged ? 'bg-red-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{item.name}</div>
                      {(item.brand || item.model) && (
                        <div className="text-xs text-gray-500">{[item.brand, item.model].filter(Boolean).join(' ')}</div>
                      )}
                      <ItemTraceRow
                        item={item}
                        getTraceForItem={getTraceForItem}
                        shouldReplay={shouldReplay}
                        isPricing={isPricing}
                      />
                      {item.flagged && item.flag_reason && (
                        <div className="text-xs text-red-600 mt-0.5">Flagged: {item.flag_reason}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 capitalize text-gray-700">{item.condition}</td>
                    <td className="px-4 py-3 text-gray-700">{item.estimated_age ? `${item.estimated_age}y` : '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{item.quantity}</td>
                    <td className="px-4 py-3">
                      {item.price ? (
                        <div>
                          <span className="font-medium text-gray-900">${item.price.toLocaleString()}</span>
                          {item.priceSource && <PriceSourceBadge source={item.priceSource} />}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">{isPricing(item) ? 'Pricing…' : 'Pending'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3"><SourceLinks sources={item.price_sources} /></td>
                    <td className="px-4 py-3">
                      {item.flagged
                        ? <span className="text-xs text-red-600 font-medium">Flagged</span>
                        : <span className="text-xs text-green-600">OK</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onRefreshPrice(item)}
                        disabled={isPricing(item)}
                        className="text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
                      >
                        {isPricing(item) ? 'Pricing…' : 'Refresh Price'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {items.some((i) => i.price) && (
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50">
                    <td colSpan={5} className="px-4 py-3 text-sm font-medium text-gray-700 text-right">
                      Total Replacement Cost:
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">${total.toLocaleString()}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  )
}
