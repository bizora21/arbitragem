import { NextRequest, NextResponse } from 'next/server'
import { identifyBestPairs } from '@/lib/analysis/edge-analyzer'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') ?? '7')
    const pairs = await identifyBestPairs(days)
    return NextResponse.json({ data: pairs, timestamp: new Date().toISOString() })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message, timestamp: new Date().toISOString() }, { status: 500 })
  }
}
