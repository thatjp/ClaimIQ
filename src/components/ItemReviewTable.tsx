'use client'

import { ExtractedItem, BLANK_ITEM, CATEGORIES, CONDITIONS } from '@/types/items'

interface Props {
  items: ExtractedItem[]
  step: 'review' | 'pricing' | 'done'
  addingItem: boolean
  newItem: ExtractedItem
  onRemove: (index: number) => void
  onNewItemChange: (item: ExtractedItem) => void
  onAddConfirm: () => void
  onAddCancel: () => void
}

export function ItemReviewTable({
  items,
  step,
  addingItem,
  newItem,
  onRemove,
  onNewItemChange,
  onAddConfirm,
  onAddCancel,
}: Props) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-4">
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
              </td>
              <td className="px-4 py-3 text-gray-700 capitalize">{item.category}</td>
              <td className="px-4 py-3 text-gray-700 capitalize">{item.condition}</td>
              <td className="px-4 py-3 text-gray-700">{item.estimatedAge ?? '—'}</td>
              <td className="px-4 py-3 text-gray-700">{item.quantity}</td>
              <td className="px-4 py-3">
                {item.priceStatus === 'pending' && <span className="text-yellow-600 text-xs">Pricing...</span>}
                {item.priceStatus === 'found' && item.price && <span className="text-green-700 font-medium">${item.price.toLocaleString()}</span>}
                {item.priceStatus === 'error' && <span className="text-red-500 text-xs">Error</span>}
                {!item.priceStatus && <span className="text-gray-400 text-xs">Not priced</span>}
              </td>
              <td className="px-4 py-3 text-right">
                {step === 'review' && (
                  <button
                    onClick={() => onRemove(i)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
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
                  <button
                    onClick={onAddConfirm}
                    className="text-xs text-blue-600 font-medium hover:text-blue-700"
                  >
                    Add
                  </button>
                  <button
                    onClick={onAddCancel}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
