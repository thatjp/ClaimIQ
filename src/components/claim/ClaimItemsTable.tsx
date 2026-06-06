'use client'

import { useState, useEffect } from 'react'
import type { ClaimItem } from '@/types/items'
import type { PriceTraceStep } from '@/lib/pricing/trace'
import { canApproveItem, getItemGroundingIssues, getValidSources, isValidSourceUrl } from '@/lib/claims/grounding'
import { PriceLookupTrace } from '@/components/claim/PriceLookupTrace'

function sourceDomain(url: string) {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}

function SourceCell({
  item,
  onUpdateSources,
}: {
  item: ClaimItem
  onUpdateSources: (sources: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  const sources = getValidSources(item.price_sources)

  function addSource() {
    const trimmed = draft.trim()
    if (!isValidSourceUrl(trimmed)) return
    if (sources.includes(trimmed)) {
      setDraft('')
      return
    }
    onUpdateSources([...sources, trimmed])
    setDraft('')
  }

  return (
    <div className="space-y-1.5 min-w-[140px]">
      {sources.length === 0 ? (
        <p className="text-xs text-amber-700">Add a source URL</p>
      ) : (
        <ul className="space-y-1">
          {sources.map((url, index) => (
            <li key={url} className="text-xs">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={`hover:underline ${index === 0 ? 'text-blue-700 font-medium' : 'text-blue-600'}`}
                title={url}
              >
                {index === 0 ? `${sourceDomain(url)} ↗ (primary)` : `${sourceDomain(url)} ↗`}
              </a>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-1">
        <input
          type="url"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="https://..."
          className="flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSource())}
        />
        <button
          type="button"
          onClick={addSource}
          disabled={!draft.trim()}
          className="px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  )
}

function AgeCell({
  item,
  onUpdateAge,
}: {
  item: ClaimItem
  onUpdateAge: (age: number | null) => void
}) {
  const missing = item.estimated_age == null || item.estimated_age < 0
  const [local, setLocal] = useState(item.estimated_age?.toString() ?? '')

  useEffect(() => {
    setLocal(item.estimated_age?.toString() ?? '')
  }, [item.estimated_age])

  function commit() {
    const val = local.trim()
    const next = val === '' ? null : Number(val)
    if (next != null && Number.isNaN(next)) return
    if (next === item.estimated_age || (next == null && item.estimated_age == null)) return
    onUpdateAge(next)
  }

  return (
    <div>
      <input
        type="number"
        min={0}
        value={local}
        placeholder="—"
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className={`w-16 px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
          missing ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
        }`}
      />
      {missing && <p className="text-[10px] text-amber-700 mt-0.5">Required</p>}
    </div>
  )
}

function ApprovalCell({
  item,
  onApprove,
}: {
  item: ClaimItem
  onApprove: (approved: boolean) => void
}) {
  const eligible = canApproveItem(item)
  const issues = getItemGroundingIssues(item)
  const title = issues.map((i) => i.message).join('; ')

  return (
    <div className="space-y-1" title={title || undefined}>
      <label
        className={`flex items-center gap-2 text-xs ${
          eligible || item.approved ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'
        }`}
      >
        <input
          type="checkbox"
          checked={!!item.approved}
          disabled={!eligible && !item.approved}
          onChange={(e) => onApprove(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
        />
        <span className={item.approved ? 'text-gray-700 font-medium' : 'text-gray-500'}>
          {item.approved ? 'Approved' : 'Pending approval'}
        </span>
      </label>
      {!eligible && !item.approved && (
        <p className="text-[10px] text-amber-700 max-w-[120px]">{issues[0]?.message}</p>
      )}
    </div>
  )
}

function PriceSourceBadge({ source }: { source: ClaimItem['priceSource'] }) {
  const config: Record<string, { label: string; className: string; title: string; icon: string }> = {
    cache:               { label: 'KV Cache',         className: 'text-blue-600',   icon: '⚡', title: 'Exact match from Redis cache (7-day TTL)' },
    vector_cache:        { label: 'Vector Cache',     className: 'text-purple-600', icon: '🔮', title: 'Semantic match from pgvector similarity search (90-day TTL)' },
    vector_cache_stale:  { label: 'Stale Cache',      className: 'text-orange-500', icon: '⏳', title: 'Semantic match older than 90 days — may not reflect current market price' },
    ebay:                { label: 'eBay Sold',        className: 'text-yellow-600', icon: '🛒', title: 'Average of recent sold listings via eBay Finding API' },
    amazon:              { label: 'Amazon',           className: 'text-orange-600', icon: '📦', title: 'Retail price from Amazon product search' },
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
  canRefreshPrice: (item: ClaimItem) => boolean
  onRefreshPrice: (item: ClaimItem) => void
  onUpdateItem: (itemId: string, updates: Record<string, unknown>) => Promise<void>
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
  canRefreshPrice,
  onRefreshPrice,
  onUpdateItem,
}: Props) {
  const total = items.reduce((sum, i) => sum + (i.price || 0) * i.quantity, 0)
  const approvedCount = items.filter((i) => i.approved).length

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">Line Items ({items.length})</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {approvedCount} of {items.length} approved — all items need price, age, and source before approval
          </p>
        </div>
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
              <div key={item.id} className={`px-4 py-3 table-row-resize ${item.flagged ? 'bg-red-50' : ''}`}>
                <div className="space-y-2">
                  <div className="font-medium text-gray-900 text-sm">{item.name}</div>
                  <ItemTraceRow
                    item={item}
                    getTraceForItem={getTraceForItem}
                    shouldReplay={shouldReplay}
                    isPricing={isPricing}
                  />
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500 block mb-1">Age</span>
                      <AgeCell
                        item={item}
                        onUpdateAge={(age) => onUpdateItem(item.id, { estimated_age: age, approved: false })}
                      />
                    </div>
                    <div>
                      <span className="text-gray-500 block mb-1">Price</span>
                      {item.price ? (
                        <span className="font-semibold">${item.price.toLocaleString()}</span>
                      ) : (
                        <span className="text-gray-400">{isPricing(item) ? 'Pricing…' : 'Pending'}</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs block mb-1">Sources</span>
                    <SourceCell
                      item={item}
                      onUpdateSources={(sources) => onUpdateItem(item.id, { price_sources: sources, approved: false })}
                    />
                  </div>
                  <ApprovalCell
                    item={item}
                    onApprove={(approved) => onUpdateItem(item.id, { approved })}
                  />
                  <button
                    onClick={() => onRefreshPrice(item)}
                    disabled={isPricing(item) || !canRefreshPrice(item)}
                    title={canRefreshPrice(item) ? 'Refresh price from primary source' : 'Add a source URL first'}
                    className="text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
                  >
                    {isPricing(item) ? 'Pricing…' : 'Refresh from primary source'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Item</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Condition</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Age</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Qty</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Price</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Sources</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Approved</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className={`table-row-resize ${item.flagged ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
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
                    <td className="px-4 py-3">
                      <AgeCell
                        item={item}
                        onUpdateAge={(age) => onUpdateItem(item.id, { estimated_age: age, approved: false })}
                      />
                    </td>
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
                    <td className="px-4 py-3">
                      <SourceCell
                        item={item}
                        onUpdateSources={(sources) => onUpdateItem(item.id, { price_sources: sources, approved: false })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <ApprovalCell
                        item={item}
                        onApprove={(approved) => onUpdateItem(item.id, { approved })}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onRefreshPrice(item)}
                        disabled={isPricing(item) || !canRefreshPrice(item)}
                        title={canRefreshPrice(item) ? 'Refresh price from primary source URL' : 'Add a source URL first'}
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
                    <td colSpan={4} className="px-4 py-3 text-sm font-medium text-gray-700 text-right">
                      Total Replacement Cost:
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">${total.toLocaleString()}</td>
                    <td colSpan={3}></td>
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
