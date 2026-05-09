import { NextResponse } from 'next/server'
import { getLatestFundingRates } from '@/lib/analyzer/opportunity-finder'
import { normalizeSymbol } from '@/lib/utils'
import { Exchange, FundingRate } from '@/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const rates = await getLatestFundingRates()

    // Group by normalized symbol for easier consumption
    const grouped: Record<string, Record<string, Omit<FundingRate, 'symbol' | 'exchange'>>> = {}

    for (const rate of rates) {
      const normalized = normalizeSymbol(rate.symbol, rate.exchange as Exchange)
      if (!grouped[normalized]) grouped[normalized] = {}
      grouped[normalized][rate.exchange] = {
        fundingRate: rate.fundingRate,
        markPrice: rate.markPrice,
        indexPrice: rate.indexPrice,
        nextFundingTime: rate.nextFundingTime,
        timestamp: rate.timestamp,
      }
    }

    // Build table rows sorted by best diff
    const rows = Object.entries(grouped)
      .map(([symbol, exchanges]) => {
        const rateValues = Object.values(exchanges).map((e) => e.fundingRate)
        const maxRate = Math.max(...rateValues)
        const minRate = Math.min(...rateValues)
        const diff = maxRate - minRate

        return {
          symbol,
          OKX: exchanges['OKX']?.fundingRate ?? null,
          BINANCE: exchanges['BINANCE']?.fundingRate ?? null,
          BYBIT: exchanges['BYBIT']?.fundingRate ?? null,
          bestDiff: diff,
          nextFundingTime:
            exchanges['BINANCE']?.nextFundingTime ??
            exchanges['OKX']?.nextFundingTime ??
            exchanges['BYBIT']?.nextFundingTime ??
            null,
        }
      })
      .filter((row) => row.bestDiff > 0)
      .sort((a, b) => b.bestDiff - a.bestDiff)

    return NextResponse.json({
      data: rows,
      raw: rates,
      timestamp: new Date().toISOString(),
      count: rows.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message, timestamp: new Date().toISOString() }, { status: 500 })
  }
}
