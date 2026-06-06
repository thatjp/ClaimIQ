'use client'

import { ExtractedItem, BLANK_ITEM, CATEGORIES, CONDITIONS } from '@/types/items'
import type { PriceTraceStep } from '@/lib/pricing/trace'
import { PriceLookupTrace } from '@/components/claim/PriceLookupTrace'

interface Props {
  items: ExtractedItem[]
  step: 'review' | 'pricing' | 'done'
  addingItem: boolean
  newItem: ExtractedItem
  pricingTraces?: Record<number, PriceTraceStep[]>
  replayIndices?: Set<number>
  onRemove: (index: number) => void
  onNewItemChange: (item: ExtractedItem) => void
  onAddConfirm: () => void
  onAddCancel: () => void
}

function PriceCell({ item }: { item: ExtractedItem }) {
  if (item.priceStatus === 'pending') return <span className="text-yellow-600 text-xs">Pricing...</span>
  if (item.priceStatus === 'found' && item.price) return <span className="text-green-700 font-medium">${item.price.toLocaleString()}</span>
  if (item.priceStatus === 'error') return <span className="text-red-500 text-xs">Error</span>
  return <span className="text-gray-400 text-xs">Not priced</span>
}

export function ItemReviewTable({
  items,
  step,
  addingItem,
  newItem,
  pricingTraces = {},
  replayIndices = new Set(),
  onRemove,
  onNewItemChange,
  onAddConfirm,
  onAddCancel,
}: Props) {
  return (
    <div className="mb-4 space-y-2">
      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {items.map((item, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-lg px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-gray-900 text-sm truncate">{item.name}</div>
                {(item.brand || item.model) && (
                  <div className="text-xs text-gray-500">{[item.brand, item.model].filter(Boolean).join(' ')}</div>
                )}
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
                  <span className="capitalize">{item.category}</span>
                  <span className="capitalize">{item.condition}</span>
                  {item.estimatedAge && <span>{item.estimatedAge}y</span>}
                  <span>Qty {item.quantity}</span>
                </div>
                {(item.priceTrace ?? pricingTraces[i]) && (
                  <PriceLookupTrace
                    trace={item.priceTrace ?? pricingTraces[i] ?? []}
                    replay={replayIndices.has(i)}
                    compact
                  />
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <PriceCell item={item} />
                {step === 'review' && (
                  <button onClick={() => onRemove(i)} className="text-xs text-red-400 hover:text-red-600">
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {addingItem && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 space-y-2">
            <input
              autoFocus
              placeholder="Item name *"
              value={newItem.name}
              onChange={(e) => onNewItemChange({ ...newItem, name: e.target.value })}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Brand"
                value={newItem.brand ?? ''}
                onChange={(e) => onNewItemChange({ ...newItem, brand: e.target.value })}
                className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <input
                placeholder="Model"
                value={newItem.model ?? ''}
                onChange={(e) => onNewItemChange({ ...newItem, model: e.target.value })}
                className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <select
                value={newItem.category}
                onChange={(e) => onNewItemChange({ ...newItem, category: e.target.value })}
                className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                value={newItem.condition}
                onChange={(e) => onNewItemChange({ ...newItem, condition: e.target.value })}
                className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                type="number"
                min={0}
                placeholder="Age (yrs)"
                value={newItem.estimatedAge ?? ''}
                onChange={(e) => onNewItemChange({ ...newItem, estimatedAge: e.target.value ? Number(e.target.value) : undefined })}
                className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <input
                type="number"
                min={1}
                placeholder="Qty"
                value={newItem.quantity}
                onChange={(e) => onNewItemChange({ ...newItem, quantity: Number(e.target.value) })}
                className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={onAddConfirm} className="text-sm text-blue-600 font-medium hover:text-blue-700">Add</button>
              <button onClick={onAddCancel} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Item</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Condition</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Age (yrs)</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Qty</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Price</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item, i) => (
              <tr key={i}>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{item.name}</div>
                  {(item.brand || item.model) && (
                    <div className="text-xs text-gray-500">
                      {[item.brand, item.model].filter(Boolean).join(' ')}
                    </div>
                  )}
                  {(item.priceTrace ?? pricingTraces[i]) && (
                    <PriceLookupTrace
                      trace={item.priceTrace ?? pricingTraces[i] ?? []}
                      replay={replayIndices.has(i)}
                      compact
                    />
                  )}
                </td>
                <td className="px-4 py-3 text-gray-700 capitalize">{item.category}</td>
                <td className="px-4 py-3 text-gray-700 capitalize">{item.condition}</td>
                <td className="px-4 py-3 text-gray-700">{item.estimatedAge ?? '—'}</td>
                <td className="px-4 py-3 text-gray-700">{item.quantity}</td>
                <td className="px-4 py-3"><PriceCell item={item} /></td>
                <td className="px-4 py-3 text-right">
                  {step === 'review' && (
                    <button onClick={() => onRemove(i)} className="text-xs text-red-400 hover:text-red-600">
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {addingItem && (
              <tr className="bg-blue-50">
                <td className="px-4 py-3">
                  <input
                    autoFocus
                    placeholder="Item name *"
                    value={newItem.name}
                    onChange={(e) => onNewItemChange({ ...newItem, name: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm mb-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    placeholder="Brand"
                    value={newItem.brand ?? ''}
                    onChange={(e) => onNewItemChange({ ...newItem, brand: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </td>
                <td className="px-4 py-3">
                  <select
                    value={newItem.category}
                    onChange={(e) => onNewItemChange({ ...newItem, category: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={newItem.condition}
                    onChange={(e) => onNewItemChange({ ...newItem, condition: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={0}
                    placeholder="—"
                    value={newItem.estimatedAge ?? ''}
                    onChange={(e) => onNewItemChange({ ...newItem, estimatedAge: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={1}
                    value={newItem.quantity}
                    onChange={(e) => onNewItemChange({ ...newItem, quantity: Number(e.target.value) })}
                    className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">—</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-2 justify-end">
                    <button onClick={onAddConfirm} className="text-xs text-blue-600 font-medium hover:text-blue-700">Add</button>
                    <button onClick={onAddCancel} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
