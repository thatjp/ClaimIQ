import type { ClaimItem } from '@/types/items'

function SourceLinks({ sources }: { sources?: string[] | null }) {
  if (!sources || sources.length === 0) return <span className="text-gray-300 text-xs">—</span>

  const [first, ...rest] = sources
  const domain = new URL(first).hostname.replace('www.', '')

  return (
    <div className="text-xs">
      <a
        href={first}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline"
      >
        {domain} ↗
      </a>
      {rest.length > 0 && (
        <span className="text-gray-400 ml-1">+{rest.length}</span>
      )}
    </div>
  )
}

function PriceSourceBadge({ source }: { source: ClaimItem['priceSource'] }) {
  const config = {
    cache: { label: 'KV Cache', className: 'text-blue-600', title: 'Exact match from Redis cache (7-day TTL)' },
    vector_cache: { label: 'Vector Cache', className: 'text-purple-600', title: 'Semantic match from pgvector similarity search (90-day TTL)' },
    web_search: { label: 'Live Web Search', className: 'text-green-600', title: 'Retrieved via Anthropic web search tool through Vercel Workflow' },
  }
  const c = config[source!]
  return (
    <div className={`text-xs mt-0.5 font-medium ${c.className}`} title={c.title}>
      {source === 'cache' && '⚡ '}
      {source === 'vector_cache' && '🔮 '}
      {source === 'web_search' && '🌐 '}
      {c.label}
    </div>
  )
}

interface Props {
  items: ClaimItem[]
  pricingItemId: string | null
  onRefreshPrice: (item: ClaimItem) => void
}

export function ClaimItemsTable({ items, pricingItemId, onRefreshPrice }: Props) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700">
          Line Items ({items.length})
        </h2>
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-gray-400">No items added yet.</p>
        </div>
      ) : (
        <table className="w-full text-sm">
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
                    <div className="text-xs text-gray-500">
                      {[item.brand, item.model].filter(Boolean).join(' ')}
                    </div>
                  )}
                  {item.flagged && item.flag_reason && (
                    <div className="text-xs text-red-600 mt-0.5">Flagged: {item.flag_reason}</div>
                  )}
                </td>
                <td className="px-4 py-3 capitalize text-gray-700">{item.condition}</td>
                <td className="px-4 py-3 text-gray-700">
                  {item.estimated_age ? `${item.estimated_age}y` : '—'}
                </td>
                <td className="px-4 py-3 text-gray-700">{item.quantity}</td>
                <td className="px-4 py-3">
                  {item.price ? (
                    <div>
                      <span className="font-medium text-gray-900">${item.price.toLocaleString()}</span>
                      {item.priceSource && <PriceSourceBadge source={item.priceSource} />}
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">Pending</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <SourceLinks sources={item.price_sources} />
                </td>
                <td className="px-4 py-3">
                  {item.flagged ? (
                    <span className="text-xs text-red-600 font-medium">Flagged</span>
                  ) : (
                    <span className="text-xs text-green-600">OK</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onRefreshPrice(item)}
                    disabled={pricingItemId === item.id}
                    className="text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
                  >
                    {pricingItemId === item.id ? 'Pricing...' : 'Refresh Price'}
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
                <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                  ${items.reduce((sum, i) => sum + (i.price || 0) * i.quantity, 0).toLocaleString()}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      )}
    </div>
  )
}
