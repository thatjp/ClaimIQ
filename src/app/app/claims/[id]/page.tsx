'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import type { UIMessage } from 'ai'

interface ClaimItem {
  id: string
  name: string
  brand?: string
  model?: string
  category: string
  condition: string
  estimated_age?: number
  quantity: number
  adjuster_notes?: string
  price?: number
  price_sources?: string[]
  flagged: boolean
  flag_reason?: string
}

interface Claim {
  id: string
  state: string
  policy_type: string
  date_of_loss: string
  status: string
  created_at: string
  items: ClaimItem[]
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-700',
    pending: 'bg-yellow-100 text-yellow-800',
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status] || styles.pending}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function getMessageText(message: UIMessage): string {
  const textParts = message.parts.filter((p) => p.type === 'text')
  return textParts.map((p) => ('text' in p ? p.text : '')).join('')
}

export default function ClaimWorkspacePage() {
  const params = useParams()
  const claimId = params.id as string

  const [claim, setClaim] = useState<Claim | null>(null)
  const [loading, setLoading] = useState(true)
  const [pricingItemId, setPricingItemId] = useState<string | null>(null)
  const [chatInput, setChatInput] = useState('')

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: { claimId },
    }),
  })

  const chatLoading = status === 'streaming' || status === 'submitted'

  useEffect(() => {
    async function loadClaim() {
      try {
        const res = await fetch(`/api/claims/${claimId}`)
        if (res.ok) {
          const data = await res.json()
          setClaim(data)
        } else {
          setClaim({
            id: claimId,
            state: 'CA',
            policy_type: 'HO-3',
            date_of_loss: new Date().toISOString().split('T')[0],
            status: 'open',
            created_at: new Date().toISOString(),
            items: [],
          })
        }
      } catch {
        setClaim({
          id: claimId,
          state: 'CA',
          policy_type: 'HO-3',
          date_of_loss: new Date().toISOString().split('T')[0],
          status: 'open',
          created_at: new Date().toISOString(),
          items: [],
        })
      } finally {
        setLoading(false)
      }
    }
    loadClaim()
  }, [claimId])

  async function handleRefreshPrice(item: ClaimItem) {
    setPricingItemId(item.id)
    try {
      const res = await fetch('/api/price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item }),
      })
      if (!res.ok) return

      const data = await res.json()

      if (data.price) {
        setClaim((prev) =>
          prev
            ? { ...prev, items: prev.items.map((i) => i.id === item.id ? { ...i, price: data.price } : i) }
            : prev
        )
        return
      }

      if (data.workflowRunId) {
        await pollForPrice(item.id, data.workflowRunId)
      }
    } catch {
      // ignore
    } finally {
      setPricingItemId(null)
    }
  }

  async function pollForPrice(itemId: string, runId: string) {
    const maxAttempts = 30
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000))
      try {
        const res = await fetch(`/api/price/${runId}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.status === 'completed' && data.price) {
          setClaim((prev) =>
            prev
              ? { ...prev, items: prev.items.map((i) => i.id === itemId ? { ...i, price: data.price } : i) }
              : prev
          )
          return
        }
        if (data.status === 'failed') return
      } catch {
        return
      }
    }
  }

  function handleChatSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!chatInput.trim()) return
    sendMessage({ text: chatInput })
    setChatInput('')
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-3">
        <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full" />
        <span className="text-sm text-gray-500">Loading claim...</span>
      </div>
    )
  }

  if (!claim) {
    return (
      <div className="p-8">
        <p className="text-red-600 text-sm">Claim not found.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Main claim content */}
      <div className="flex-1 overflow-auto p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-semibold text-gray-900">
                Claim {claim.id.slice(0, 8)}
              </h1>
              <StatusBadge status={claim.status} />
            </div>
            <div className="flex gap-4 text-sm text-gray-500">
              <span>
                State:{' '}
                <span className="text-gray-700 font-medium">{claim.state}</span>
              </span>
              <span>
                Policy:{' '}
                <span className="text-gray-700 font-medium">{claim.policy_type}</span>
              </span>
              <span>
                Date of Loss:{' '}
                <span className="text-gray-700 font-medium">
                  {new Date(claim.date_of_loss).toLocaleDateString()}
                </span>
              </span>
            </div>
          </div>
          <Link
            href={`/app/claims/${claimId}/generate`}
            className="bg-gray-800 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-900 transition-colors"
          >
            Generate Document
          </Link>
        </div>

        {/* Items table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              Line Items ({claim.items.length})
            </h2>
          </div>

          {claim.items.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-gray-400">No items added yet.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">
                    Item
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">
                    Condition
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">
                    Age
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">
                    Qty
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">
                    Price
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {claim.items.map((item) => (
                  <tr
                    key={item.id}
                    className={item.flagged ? 'bg-red-50' : 'hover:bg-gray-50'}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{item.name}</div>
                      {(item.brand || item.model) && (
                        <div className="text-xs text-gray-500">
                          {[item.brand, item.model].filter(Boolean).join(' ')}
                        </div>
                      )}
                      {item.flagged && item.flag_reason && (
                        <div className="text-xs text-red-600 mt-0.5">
                          Flagged: {item.flag_reason}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 capitalize text-gray-700">
                      {item.condition}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {item.estimated_age ? `${item.estimated_age}y` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{item.quantity}</td>
                    <td className="px-4 py-3">
                      {item.price ? (
                        <span className="font-medium text-gray-900">
                          ${item.price.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.flagged ? (
                        <span className="text-xs text-red-600 font-medium">
                          Flagged
                        </span>
                      ) : (
                        <span className="text-xs text-green-600">OK</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleRefreshPrice(item)}
                        disabled={pricingItemId === item.id}
                        className="text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
                      >
                        {pricingItemId === item.id ? 'Pricing...' : 'Refresh Price'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {claim.items.some((i) => i.price) && (
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50">
                    <td
                      colSpan={4}
                      className="px-4 py-3 text-sm font-medium text-gray-700 text-right"
                    >
                      Total Replacement Cost:
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                      $
                      {claim.items
                        .reduce((sum, i) => sum + (i.price || 0) * i.quantity, 0)
                        .toLocaleString()}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>

      {/* AI Chat Panel */}
      <div className="w-80 border-l border-gray-200 bg-white flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700">AI Assistant</h2>
          <p className="text-xs text-gray-400 mt-0.5">Ask questions about this claim</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-xs text-gray-400 text-center mt-4">
              <p>Ask me to:</p>
              <p className="mt-1">• Flag unusual items</p>
              <p>• Check policy coverage</p>
              <p>• Refresh a price</p>
              <p>• Review the full claim</p>
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`text-xs rounded-md px-3 py-2 ${
                m.role === 'user'
                  ? 'bg-blue-50 text-blue-900 ml-4'
                  : 'bg-gray-100 text-gray-800 mr-4'
              }`}
            >
              <span className="font-medium block mb-0.5">
                {m.role === 'user' ? 'You' : 'Assistant'}
              </span>
              <span className="whitespace-pre-wrap">{getMessageText(m)}</span>
            </div>
          ))}
          {chatLoading && (
            <div className="bg-gray-100 text-gray-500 text-xs rounded-md px-3 py-2 mr-4">
              Thinking...
            </div>
          )}
        </div>

        <form onSubmit={handleChatSubmit} className="p-3 border-t border-gray-200">
          <div className="flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask about this claim..."
              className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={chatLoading || !chatInput.trim()}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
