'use client'

import { useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import type { UIMessage } from 'ai'

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((p) => p.type === 'text')
    .map((p) => ('text' in p ? p.text : ''))
    .join('')
}

export function AIChatPanel({ claimId }: { claimId: string }) {
  const [chatInput, setChatInput] = useState('')
  const [open, setOpen] = useState(false)

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: { claimId },
    }),
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!chatInput.trim()) return
    sendMessage({ text: chatInput })
    setChatInput('')
  }

  return (
    <div className="md:w-80 md:border-l border-gray-200 bg-white flex flex-col shrink-0">
      {/* Header — tappable on mobile to toggle, static on desktop */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="md:cursor-default w-full flex items-center justify-between px-4 py-3 border-t md:border-t-0 border-gray-200 md:border-b"
      >
        <div className="text-left">
          <h2 className="text-sm font-semibold text-gray-700">AI Assistant</h2>
          <p className="text-xs text-gray-400 mt-0.5 hidden md:block">Ask questions about this claim</p>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform md:hidden ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>

      {/* Body — always visible on desktop, toggled on mobile */}
      <div className={`flex-col flex-1 overflow-hidden ${open ? 'flex' : 'hidden'} md:flex`}>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-72 md:max-h-none">
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
          {isLoading && (
            <div className="bg-gray-100 text-gray-500 text-xs rounded-md px-3 py-2 mr-4">
              Thinking...
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200">
          <div className="flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask about this claim..."
              className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={isLoading || !chatInput.trim()}
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
