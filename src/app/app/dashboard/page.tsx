import Link from 'next/link'
import { db } from '@/lib/db'

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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-700',
    pending: 'bg-yellow-100 text-yellow-800',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status] || styles.pending}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export default async function DashboardPage() {
  const claims = await getClaims()

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Claims</h1>
          <p className="text-sm text-gray-500 mt-1">
            {claims.length} total claim{claims.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/app/claims/new"
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Claim
        </Link>
      </div>

      {claims.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-500 text-sm">No claims yet.</p>
          <Link
            href="/app/claims/new"
            className="mt-4 inline-block text-blue-600 text-sm font-medium hover:text-blue-700"
          >
            Create your first claim
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Claim ID</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">State</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Policy Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Date of Loss</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {claims.map((claim) => (
                <tr key={claim.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">
                    {claim.id.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3 text-gray-700">{claim.state}</td>
                  <td className="px-4 py-3 text-gray-700">{claim.policy_type}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {new Date(claim.date_of_loss).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={claim.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(claim.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/app/claims/${claim.id}`}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
