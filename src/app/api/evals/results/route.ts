import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { NextResponse } from 'next/server'
import { getLatestEvalReport } from '@/lib/evals/runner'
import type { EvalRunReport } from '@/lib/evals/types'

function readReportFromDisk(): EvalRunReport | null {
  const resultsPath = resolve(process.cwd(), 'evals/results/latest.json')
  if (!existsSync(resultsPath)) return null
  try {
    return JSON.parse(readFileSync(resultsPath, 'utf8')) as EvalRunReport
  } catch {
    return null
  }
}

export async function GET() {
  const report = getLatestEvalReport() ?? readReportFromDisk()

  if (!report) {
    return NextResponse.json(
      { error: 'No eval results yet. Run evals from this page.' },
      { status: 404 }
    )
  }

  return NextResponse.json(report)
}
