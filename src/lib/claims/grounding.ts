import type { ClaimItem } from '@/types/items'

export interface GroundingIssue {
  field: 'source' | 'price' | 'approval'
  message: string
}

export function isValidSourceUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function getValidSources(sources?: string[] | null): string[] {
  return (sources ?? []).filter(isValidSourceUrl)
}

export function getItemGroundingIssues(item: ClaimItem): GroundingIssue[] {
  const issues: GroundingIssue[] = []

  if (getValidSources(item.price_sources).length === 0) {
    issues.push({ field: 'source', message: 'At least one source URL is required' })
  }

  if (item.price == null) {
    issues.push({ field: 'price', message: 'Price is required' })
  }

  return issues
}

export function canApproveItem(item: ClaimItem): boolean {
  return getItemGroundingIssues(item).length === 0
}

export function getClaimReadiness(items: ClaimItem[]) {
  const itemStatuses = items.map((item) => ({
    id: item.id,
    name: item.name,
    approved: !!item.approved,
    canApprove: canApproveItem(item),
    issues: getItemGroundingIssues(item),
  }))

  const approvedCount = itemStatuses.filter((s) => s.approved).length
  const allApproved = items.length > 0 && itemStatuses.every((s) => s.approved)
  const allGrounded = items.length > 0 && itemStatuses.every((s) => s.canApprove)
  const canGenerateDocument = allApproved && allGrounded

  return {
    approvedCount,
    total: items.length,
    allApproved,
    allGrounded,
    canGenerateDocument,
    itemStatuses,
  }
}
