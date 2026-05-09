import { NextResponse } from 'next/server'
import { generateWeeklyReport } from '@/lib/reports/weekly-report'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const report = await generateWeeklyReport()
    return NextResponse.json({ data: report, timestamp: new Date().toISOString() })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message, timestamp: new Date().toISOString() }, { status: 500 })
  }
}
