import { NextResponse } from 'next/server'
import { findOpportunities, getLatestFundingRates } from '@/lib/analyzer/opportunity-finder'
import { mean } from '@/lib/utils'
import { calculateFeeBreakdown, calculateNetEdge } from '@/lib/strategies/fee-engine'
import { calculateFundingReturnSync } from '@/lib/strategies/return-calculator'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const [opportunities, rates] = await Promise.allSettled([
      findOpportunities(1000),
      getLatestFundingRates(),
    ])

    const opps = opportunities.status === 'fulfilled' ? opportunities.value : []
    const ratesList = rates.status === 'fulfilled' ? rates.value : []

    const bestReturn = opps.length > 0
      ? Math.max(...opps.map((o) => o.annualizedReturn))
      : 0

    // Compute net returns and fee impact
    const netReturns = opps.map((o) => {
      const est = calculateFundingReturnSync(o.fundingRateDiff)
      const fees = calculateFeeBreakdown({
        strategy: 'FUNDING',
        capital: 1000,
        exchanges: [o.buyExchange, o.sellExchange],
      })
      const grossEdge = 1000 * o.fundingRateDiff
      return {
        netEdge: calculateNetEdge(grossEdge, fees),
        grossReturn: est.grossReturn,
        adjustedReturn: est.adjustedReturn,
        feeTotal: fees.totalFees,
        grossEdge,
      }
    })

    const bestNetReturn = netReturns.length > 0
      ? Math.max(...netReturns.map((r) => r.adjustedReturn))
      : 0

    const avgFeeImpact = netReturns.length > 0
      ? mean(netReturns.map((r) => r.feeTotal / Math.max(r.grossEdge, 0.01) * 100))
      : 0

    const avgFunding = ratesList.length > 0
      ? mean(ratesList.map((r) => r.fundingRate))
      : 0

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
        bestNetReturn,
        avgFeeImpact,
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
