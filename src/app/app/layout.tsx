import Link from 'next/link'

export const metadata = {
  robots: { index: false, follow: false },
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-screen">
      {/* Sidebar — desktop only */}
      <aside className="hidden md:flex w-56 bg-gray-900 text-gray-100 flex-col shrink-0">
        <div className="px-5 py-5 border-b border-gray-700">
          <h1 className="text-base font-semibold tracking-tight text-white">ClaimIQ</h1>
          <p className="text-xs text-gray-400 mt-0.5">Claims Assistant</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <Link
            href="/app/dashboard"
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 rounded-md hover:bg-gray-800 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Dashboard
          </Link>

          <Link
            href="/app/claims/new"
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 rounded-md hover:bg-gray-800 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            New Claim
          </Link>
        </nav>
      </aside>

      {/* Main content + mobile bottom nav */}
      <div className="flex flex-col flex-1 min-h-screen">
        {/* Mobile header */}
        <header className="md:hidden flex items-center px-4 py-3 bg-gray-900 border-b border-gray-700 shrink-0">
          <h1 className="text-sm font-semibold text-white">ClaimIQ</h1>
          <p className="text-xs text-gray-400 ml-2">Claims Assistant</p>
        </header>

        <main className="flex-1 overflow-auto bg-gray-50 pb-16 md:pb-0">
          {children}
        </main>

        {/* Bottom nav — mobile only */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 w-full bg-gray-900 border-t border-gray-700 flex z-50 overflow-hidden">
          <Link
            href="/app/dashboard"
            className="flex-1 flex flex-col items-center gap-1 py-3 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs font-medium">Claims</span>
          </Link>

          <Link
            href="/app/claims/new"
            className="flex-1 flex flex-col items-center gap-1 py-3 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-xs font-medium">New Claim</span>
          </Link>
        </nav>
      </div>
    </div>
  )
}
