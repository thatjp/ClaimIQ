import type { ClaimItem } from '@/types/items'

const SOURCE_CONFIG: Record<string, { label: string; className: string; title: string; icon: string }> = {
  kv_cache:           { label: 'KV Cache',     className: 'text-blue-600',   icon: '⚡', title: 'Exact match from Redis cache (7-day TTL)' },
  vector_cache:       { label: 'Vector Cache',  className: 'text-purple-600', icon: '🔮', title: 'Semantic match from pgvector (90-day TTL)' },
  vector_cache_stale: { label: 'Stale Cache',   className: 'text-orange-500', icon: '⏳', title: 'Semantic match older than 90 days — may not reflect current market price' },
  ebay:               { label: 'eBay',          className: 'text-yellow-600', icon: '🛒', title: 'Retrieved via eBay sold listings' },
  amazon:             { label: 'Amazon',        className: 'text-orange-600', icon: '📦', title: 'Retrieved via Amazon (SerpAPI)' },
  walmart:            { label: 'Walmart',       className: 'text-blue-500',   icon: '🏪', title: 'Retrieved via Walmart (SerpAPI)' },
  home_depot:         { label: 'Home Depot',    className: 'text-orange-700', icon: '🔨', title: 'Retrieved via Home Depot (SerpAPI)' },
  manual:             { label: 'Manual Entry',  className: 'text-gray-500',   icon: '✏️', title: 'Price entered manually by adjuster' },
}

export function PriceSourceBadge({ source }: { source: ClaimItem['priceSource'] }) {
  const c = SOURCE_CONFIG[source!]
  if (!c) return null
  return (
    <div className={`text-xs mt-0.5 font-medium ${c.className}`} title={c.title}>
      {c.icon} {c.label}
    </div>
  )
}

export function SourceLinks({ sources }: { sources?: string[] | null }) {
  if (!sources || sources.length === 0) return <span className="text-gray-300 text-xs">—</span>
  const [first, ...rest] = sources
  let domain = first
  try { domain = new URL(first).hostname.replace('www.', '') } catch { /* keep raw */ }
  return (
    <div className="text-xs">
      <a href={first} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
        {domain} ↗
      </a>
      {rest.length > 0 && <span className="text-gray-400 ml-1">+{rest.length}</span>}
    </div>
  )
}
