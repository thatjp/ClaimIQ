import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const STATE_RULES: Record<string, string> = {
  'US-FL': 'Florida: Hurricane claims follow FL Statute 627.70132. 90-day settlement requirement.',
  'US-CA': 'California: Fair Claims Settlement Practices Act. 40-day settlement requirement.',
  'US-TX': 'Texas: Prompt Payment Act. 15-day acknowledgment requirement.',
  'US-NY': 'New York: Insurance Law Section 2601. 15-day acknowledgment requirement.',
  'US-IL': 'Illinois: Insurance Code Section 154.6. Standard HO-3 policy rules apply.',
}

export function proxy(request: NextRequest) {
  const country = request.headers.get('x-vercel-ip-country') || 'US'
  const region = request.headers.get('x-vercel-ip-region') || ''
  const regionKey = `${country}-${region}`

  const response = NextResponse.next()
  response.headers.set('x-claim-region', regionKey)
  response.headers.set(
    'x-claim-rules',
    STATE_RULES[regionKey] || 'Standard HO-3 policy rules apply.'
  )
  return response
}

export const config = {
  matcher: [
    '/app/:path*',
    '/api/:path*',
    '/((?!.well-known/workflow/).*)',
  ],
}
