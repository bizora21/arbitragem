import { NextRequest, NextResponse } from 'next/server'
import { getAccuracyStats } from '@/lib/edge-tracker/realization-tracker'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') ?? '7')
    const stats = await getAccuracyStats(days)
    return NextResponse.json({ data: stats, timestamp: new Date().toISOString() })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message, timestamp: new Date().toISOString() }, { status: 500 })
  }
}
