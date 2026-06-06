import Link from 'next/link'
import { db } from '@/lib/db'
import { StatusBadge } from '@/components/StatusBadge'
import { DeleteClaimButton } from '@/components/DeleteClaimButton'

interface Claim {
  id: string
  state: string
  policy_type: string
  date_of_loss: string
  status: 'open' | 'closed' | 'pending'
  created_at: string
}

async function getClaims(): Promise<Claim[]> {
  try {
    const { rows } = await db`
      SELECT * FROM claims
      WHERE user_id = 'demo'
      ORDER BY created_at DESC
    `
    return rows as unknown as Claim[]
  } catch {
    return []
  }
}

export default async function DashboardPage() {
  const claims = await getClaims()

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Claims</h1>
          <p className="text-sm text-gray-500 mt-1">
            {claims.length} total claim{claims.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/app/claims/new"
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-2 md:px-4 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>New Claim</span>
        </Link>
      </div>

      {claims.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-500 text-sm">No claims yet.</p>
          <Link href="/app/claims/new" className="mt-4 inline-block text-blue-600 text-sm font-medium hover:text-blue-700">
            Create your first claim
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {claims.map((claim) => (
            <div key={claim.id} className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs text-gray-500">{claim.id.slice(0, 8)}…</span>
                  <StatusBadge status={claim.status} />
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                  <span>{claim.state} · {claim.policy_type}</span>
                  <span>Loss: {new Date(claim.date_of_loss).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <DeleteClaimButton claimId={claim.id} />
                <Link
                  href={`/app/claims/${claim.id}`}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Open
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
