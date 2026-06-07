'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { StatusBadge } from '@/components/StatusBadge'
import { DeleteClaimButton } from '@/components/DeleteClaimButton'
import type { IntakeProgress, IntakeProgressItem } from '@/lib/pricing/intake-progress'

interface Claim {
  id: string
  state: string
  policy_type: string
  date_of_loss: string
  status: string
  created_at: string
  intake_run_id: string | null
  intake_key: string | null
}

const POLL_INTERVAL_MS = 2000
const MAX_POLLS = 150

function PricingStatusRow({ item }: { item: IntakeProgressItem }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-xs border-b border-gray-50 last:border-0">
      <span className="text-gray-700 font-medium truncate mr-3">{item.name}</span>
      <div className="flex items-center gap-2 shrink-0">
        {item.priceStatus === 'queued' && (
          <span className="text-gray-400">Queued</span>
        )}
        {item.priceStatus === 'pricing' && (
          <span className="flex items-center gap-1 text-yellow-600">
            <span className="inline-block w-2.5 h-2.5 border border-yellow-500 border-t-transparent rounded-full animate-spin" />
            Pricing…
          </span>
        )}
        {item.priceStatus === 'found' && item.price != null && (
          <span className="text-green-700 font-semibold">${item.price.toLocaleString()}</span>
        )}
        {item.priceStatus === 'error' && (
          <span className="text-red-500">Not found</span>
        )}
      </div>
    </div>
  )
}

function ClaimCard({
  claim,
  onDeleted,
}: {
  claim: Claim
  onDeleted: () => void
}) {
  const [open, setOpen] = useState(false)
  const [progress, setProgress] = useState<IntakeProgress | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollsRef = useRef(0)

  const isPricing = !!claim.intake_key && !!claim.intake_run_id

  // Stop polling when we unmount or claim is done
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!isPricing) return

    const { id, intake_run_id, intake_key } = claim

    async function poll() {
      pollsRef.current++
      if (pollsRef.current > MAX_POLLS) { stopPolling(); return }

      try {
        const res = await fetch(
          `/api/claims/${id}/intake/${intake_run_id}?intakeKey=${encodeURIComponent(intake_key!)}`
        )
        if (!res.ok) return
        const data = await res.json() as IntakeProgress
        setProgress(data)
        if (data.phase === 'done' || data.phase === 'error') stopPolling()
      } catch {
        // network blip
      }
    }

    poll()
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS)
    return stopPolling
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claim.id, claim.intake_key, claim.intake_run_id])

  useEffect(() => () => stopPolling(), [stopPolling])

  const phase = progress?.phase
  const items = progress?.items ?? []
  const found = items.filter((i) => i.priceStatus === 'found').length
  const total = items.length

  const showBadge = isPricing && phase && phase !== 'done'
  const accordionAvailable = isPricing && items.length > 0

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs text-gray-500">{claim.id.slice(0, 8)}…</span>
            <StatusBadge status={claim.status} />
            {showBadge && (
              <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                {phase === 'extracting' && 'Extracting…'}
                {phase === 'pricing' && total > 0 && `Pricing ${found}/${total}`}
                {phase === 'pricing' && total === 0 && 'Pricing…'}
                {phase === 'error' && 'Failed'}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
            <span>{claim.state} · {claim.policy_type}</span>
            <span>Loss: {new Date(claim.date_of_loss).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {accordionAvailable && (
            <button
              onClick={() => setOpen((o) => !o)}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
              aria-expanded={open}
            >
              <svg
                className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              {open ? 'Hide' : 'Show items'}
            </button>
          )}
          <DeleteClaimButton claimId={claim.id} onDeleted={onDeleted} />
          <Link
            href={`/app/claims/${claim.id}`}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Open
          </Link>
        </div>
      </div>

      {open && items.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
          <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">
            Live pricing — {found} of {total} resolved
          </p>
          <div>
            {items.map((item) => (
              <PricingStatusRow key={item.id} item={item} />
            ))}
          </div>
          <Link
            href={`/app/claims/${claim.id}`}
            className="mt-3 inline-block text-xs text-blue-600 hover:underline"
          >
            Open claim workspace →
          </Link>
        </div>
      )}
    </div>
  )
}

export function ClaimsDashboard() {
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadClaims = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/claims')
      if (!res.ok) throw new Error('Failed to load claims')
      setClaims(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load claims')
      setClaims([])
    }
  }, [])

  useEffect(() => {
    loadClaims().finally(() => setLoading(false))
  }, [loadClaims])

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Claims</h1>
          <p className="text-sm text-gray-500 mt-1">
            {loading
              ? 'Loading…'
              : `${claims.length} total claim${claims.length !== 1 ? 's' : ''}`}
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

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {loading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading claims…</p>
        </div>
      ) : claims.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
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
        <div className="space-y-2">
          {claims.map((claim) => (
            <ClaimCard key={claim.id} claim={claim} onDeleted={loadClaims} />
          ))}
        </div>
      )}
    </div>
  )
}
