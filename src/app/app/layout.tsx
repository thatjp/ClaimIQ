import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import Link from 'next/link'
import { SessionProvider } from '@/components/SessionProvider'

export const metadata = {
  robots: { index: false, follow: false },
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/signin')
  }

  return (
    <SessionProvider>
      <div className="flex h-full min-h-screen">
        {/* Sidebar */}
        <aside className="w-56 bg-gray-900 text-gray-100 flex flex-col shrink-0">
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

            <Link
              href="/app/evals"
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 rounded-md hover:bg-gray-800 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Eval Dashboard
            </Link>
          </nav>

          <div className="px-4 py-4 border-t border-gray-700">
            <p className="text-xs text-gray-400 truncate">{session.user?.email}</p>
            <p className="text-xs text-gray-500">{session.user?.name}</p>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto bg-gray-50">
          {children}
        </main>
      </div>
    </SessionProvider>
  )
}
