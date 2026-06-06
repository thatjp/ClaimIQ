import Link from 'next/link'
import { StatusBadge } from '@/components/StatusBadge'
import { getClaimReadiness } from '@/lib/claims/grounding'
import type { ClaimItem } from '@/types/items'

interface Claim {
  id: string
  state: string
  policy_type: string
  date_of_loss: string
  status: string
  items?: ClaimItem[]
}

interface Props {
  claim: Claim
  claimId: string
}

export function ClaimHeader({ claim, claimId }: Props) {
  const items = claim.items ?? []
  const readiness = getClaimReadiness(items)
  const canGenerate = readiness.canGenerateDocument

  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-lg md:text-xl font-semibold text-gray-900">
            Claim {claim.id.slice(0, 8)}
          </h1>
          <StatusBadge status={claim.status} />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
          <span>State: <span className="text-gray-700 font-medium">{claim.state}</span></span>
          <span>Policy: <span className="text-gray-700 font-medium">{claim.policy_type}</span></span>
          <span>
            Date of Loss:{' '}
            <span className="text-gray-700 font-medium">
              {new Date(claim.date_of_loss).toLocaleDateString()}
            </span>
          </span>
        </div>
        {items.length > 0 && (
          <p className={`text-xs mt-2 ${canGenerate ? 'text-green-700' : 'text-amber-700'}`}>
            {canGenerate
              ? `All ${items.length} items approved and grounded — ready to generate document`
              : `${readiness.approvedCount} of ${items.length} items approved — each line needs price, age, source URL, and approval`}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/app/dashboard"
          className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-md text-xs md:text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          All Claims
        </Link>
        <Link
          href={`/app/claims/${claimId}/add-items`}
          className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-md text-xs md:text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          + Add Items
        </Link>
        {canGenerate ? (
          <Link
            href={`/app/claims/${claimId}/generate`}
            className="bg-gray-800 text-white px-3 py-1.5 rounded-md text-xs md:text-sm font-medium hover:bg-gray-900 transition-colors"
          >
            Generate Document
          </Link>
        ) : (
          <span
            title="Approve every line item with price, age, and source URL first"
            className="bg-gray-300 text-gray-500 px-3 py-1.5 rounded-md text-xs md:text-sm font-medium cursor-not-allowed"
          >
            Generate Document
          </span>
        )}
      </div>
    </div>
  )
}
