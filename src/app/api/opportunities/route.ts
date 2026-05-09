import { NextRequest, NextResponse } from 'next/server'
import { findOpportunities } from '@/lib/analyzer/opportunity-finder'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const capital = parseFloat(searchParams.get('capital') ?? '5')
    const limit = parseInt(searchParams.get('limit') ?? '20')

    const positionSize = isNaN(capital) || capital < 5 ? 5 : capital

    const opportunities = await findOpportunities(positionSize)

    return NextResponse.json({
      data: opportunities.slice(0, limit),
      total: opportunities.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message, timestamp: new Date().toISOString() }, { status: 500 })
  }
}
