import { NextRequest, NextResponse } from 'next/server'
import { findOpportunities } from '@/lib/analyzer/opportunity-finder'
import { calculateFeeBreakdown, calculateNetEdge } from '@/lib/strategies/fee-engine'
import { calculateFundingReturnSync } from '@/lib/strategies/return-calculator'

export const dynamic = 'force-dynamic'
export const revalidate = 300  // Cache 5 min — matches scheduler interval

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const capital = parseFloat(searchParams.get('capital') ?? '1000')
    const limit = parseInt(searchParams.get('limit') ?? '20')
    const minNetEdge = parseFloat(searchParams.get('minNetEdge') ?? '-Infinity')

    const positionSize = isNaN(capital) || capital < 5 ? 1000 : capital

    const opportunities = await findOpportunities(positionSize)

    const enriched = opportunities.map((opp) => {
      const returnEst = calculateFundingReturnSync(opp.fundingRateDiff)
      const fees = calculateFeeBreakdown({
        strategy: 'FUNDING',
        capital: positionSize,
        exchanges: [opp.buyExchange, opp.sellExchange],
      })
      const grossEdge = positionSize * opp.fundingRateDiff
      const netEdge = calculateNetEdge(grossEdge, fees)
      return {
        ...opp,
        grossReturn: returnEst.grossReturn,
        adjustedReturn: returnEst.adjustedReturn,
        grossEdge,
        netEdge,
        decayFactor: returnEst.decayFactor,
        feeTotal: fees.totalFees,
      }
    })

    const filtered = isFinite(minNetEdge)
      ? enriched.filter((o) => o.netEdge >= minNetEdge)
      : enriched

    return NextResponse.json({
      data: filtered.slice(0, limit),
      total: filtered.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message, timestamp: new Date().toISOString() }, { status: 500 })
  }
}
