import { NextRequest, NextResponse } from 'next/server'
import { getOKXFundingRateHistory } from '@/lib/exchanges/okx'
import { getBinanceFundingRateHistory } from '@/lib/exchanges/binance'
import { getBybitFundingRateHistory } from '@/lib/exchanges/bybit'
import { toExchangeSymbol } from '@/lib/utils'
import { Exchange } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get('symbol') ?? 'BTCUSDT'
    const limit = parseInt(searchParams.get('limit') ?? '100')

    // Fetch history from all 3 exchanges in parallel
    const [okxHistory, binanceHistory, bybitHistory] = await Promise.allSettled([
      getOKXFundingRateHistory(toExchangeSymbol(symbol, 'OKX'), limit),
      getBinanceFundingRateHistory(toExchangeSymbol(symbol, 'BINANCE'), limit),
      getBybitFundingRateHistory(toExchangeSymbol(symbol, 'BYBIT'), limit),
    ])

    const data = {
      OKX: okxHistory.status === 'fulfilled' ? okxHistory.value : [],
      BINANCE: binanceHistory.status === 'fulfilled' ? binanceHistory.value : [],
      BYBIT: bybitHistory.status === 'fulfilled' ? bybitHistory.value : [],
    }

    const errors: Record<string, string> = {}
    if (okxHistory.status === 'rejected') errors['OKX'] = okxHistory.reason?.message
    if (binanceHistory.status === 'rejected') errors['BINANCE'] = binanceHistory.reason?.message
    if (bybitHistory.status === 'rejected') errors['BYBIT'] = bybitHistory.reason?.message

    // Merge all points into a chart-friendly format
    // Align by timestamp (group by date)
    const pointsMap: Record<string, { timestamp: string; OKX?: number; BINANCE?: number; BYBIT?: number }> = {}

    const processHistory = (history: { fundingRate: number; timestamp: Date }[], exchange: Exchange) => {
      for (const point of history) {
        const key = new Date(point.timestamp).toISOString().slice(0, 16) // minute precision
        if (!pointsMap[key]) pointsMap[key] = { timestamp: key }
        pointsMap[key][exchange] = point.fundingRate
      }
    }

    if (data.OKX.length > 0) processHistory(data.OKX, 'OKX')
    if (data.BINANCE.length > 0) processHistory(data.BINANCE, 'BINANCE')
    if (data.BYBIT.length > 0) processHistory(data.BYBIT, 'BYBIT')

    const chartData = Object.values(pointsMap).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    return NextResponse.json({
      data: chartData,
      raw: data,
      symbol,
      errors,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message, timestamp: new Date().toISOString() }, { status: 500 })
  }
}
