import type { ClaimItem } from '@/types/items'
import { PriceSourceBadge, SourceLinks } from './PriceSourceBadge'

type PriceCellVariant = 'full' | 'amount' | 'sources'

export function ClaimItemPriceCell({
  item,
  pricing,
  strategy,
  priceKey,
  priceClass,
  variant = 'full',
}: {
  item: ClaimItem
  pricing: boolean
  strategy: string | undefined
  priceKey: string
  priceClass: string
  variant?: PriceCellVariant
}) {
  if (variant === 'sources') {
    if (!item.price) return null
    return (
      <div className="mt-1">
        {item.priceSource && <PriceSourceBadge source={item.priceSource} />}
        <SourceLinks sources={item.price_sources} />
      </div>
    )
  }

  if (item.price) {
    if (variant === 'amount') {
      return (
        <span key={priceKey} className={`font-semibold text-gray-900 text-sm ${priceClass}`}>
          ${item.price.toLocaleString()}
        </span>
      )
    }
    return (
      <div key={priceKey} className={priceClass}>
        <span className="font-medium text-gray-900">${item.price.toLocaleString()}</span>
        {item.priceSource && <PriceSourceBadge source={item.priceSource} />}
        <SourceLinks sources={item.price_sources} />
      </div>
    )
  }

  if (pricing) {
    return (
      <span className="text-yellow-600 text-xs flex items-center gap-1.5">
        <span className="inline-block w-2.5 h-2.5 border border-yellow-500 border-t-transparent rounded-full animate-spin shrink-0" />
        {strategy}…
      </span>
    )
  }

  if (variant === 'amount') return null

  return <span className="text-xs text-gray-400">no source found</span>
}
