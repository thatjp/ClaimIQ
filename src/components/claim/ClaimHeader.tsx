import Link from 'next/link'
import { StatusBadge } from '@/components/StatusBadge'

interface Claim {
  id: string
  state: string
  policy_type: string
  date_of_loss: string
  status: string
}

interface Props {
  claim: Claim
  claimId: string
}

export function ClaimHeader({ claim, claimId }: Props) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-xl font-semibold text-gray-900">
            Claim {claim.id.slice(0, 8)}
          </h1>
          <StatusBadge status={claim.status} />
        </div>
        <div className="flex gap-4 text-sm text-gray-500">
          <span>State: <span className="text-gray-700 font-medium">{claim.state}</span></span>
          <span>Policy: <span className="text-gray-700 font-medium">{claim.policy_type}</span></span>
          <span>
            Date of Loss:{' '}
            <span className="text-gray-700 font-medium">
              {new Date(claim.date_of_loss).toLocaleDateString()}
            </span>
          </span>
        </div>
      </div>
      <div className="flex gap-2">
        <Link
          href="/app/dashboard"
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          All Claims
        </Link>
        <Link
          href={`/app/claims/${claimId}/add-items`}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          + Add Items
        </Link>
        <Link
          href={`/app/claims/${claimId}/generate`}
          className="bg-gray-800 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-900 transition-colors"
        >
          Generate Document
        </Link>
      </div>
    </div>
  )
}
