import { NextResponse } from 'next/server'
import { findOpportunities } from '@/lib/analyzer/opportunity-finder'
import { getLatestFundingRates } from '@/lib/analyzer/opportunity-finder'
import { mean } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const [opportunities, rates] = await Promise.allSettled([
      findOpportunities(5),
      getLatestFundingRates(),
    ])

    const opps = opportunities.status === 'fulfilled' ? opportunities.value : []
    const ratesList = rates.status === 'fulfilled' ? rates.value : []

    const bestReturn = opps.length > 0
      ? Math.max(...opps.map((o) => o.annualizedReturn))
      : 0

    const avgFunding = ratesList.length > 0
      ? mean(ratesList.map((r) => r.fundingRate))
      : 0

    // Next funding: most common next funding time
    const nextFundingTimes = ratesList
      .map((r) => r.nextFundingTime)
      .filter(Boolean) as Date[]

    let nextFundingIn = 0
    if (nextFundingTimes.length > 0) {
      const now = Date.now()
      const soonest = Math.min(...nextFundingTimes.map((t) => new Date(t).getTime()))
      nextFundingIn = Math.max(0, Math.floor((soonest - now) / 1000))
    }

    return NextResponse.json({
      data: {
        totalOpportunities: opps.length,
        bestAnnualizedReturn: bestReturn,
        avgFundingRate: avgFunding,
        nextFundingIn,
        activePositions: 0,
        totalPnL: 0,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message, timestamp: new Date().toISOString() }, { status: 500 })
  }
}
