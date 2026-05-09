import { NextRequest, NextResponse } from 'next/server'
import { predictFundingRate } from '@/lib/ai/predictor'
import { getOKXFundingRateHistory } from '@/lib/exchanges/okx'
import { getBinanceFundingRateHistory } from '@/lib/exchanges/binance'
import { getBybitFundingRateHistory } from '@/lib/exchanges/bybit'
import { toExchangeSymbol } from '@/lib/utils'
import { Exchange } from '@/types'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { symbol, exchange, currentRate } = body as {
      symbol: string
      exchange: Exchange
      currentRate: number
    }

    if (!symbol || !exchange || currentRate === undefined) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios: symbol, exchange, currentRate' },
        { status: 400 }
      )
    }

    // Fetch historical rates from the given exchange
    let historicalRates: number[] = []
    const exchangeSymbol = toExchangeSymbol(symbol, exchange)

    try {
      let history: { fundingRate: number }[] = []

      if (exchange === 'OKX') {
        history = await getOKXFundingRateHistory(exchangeSymbol, 100)
      } else if (exchange === 'BINANCE') {
        history = await getBinanceFundingRateHistory(exchangeSymbol, 100)
      } else if (exchange === 'BYBIT') {
        history = await getBybitFundingRateHistory(exchangeSymbol, 100)
      }

      historicalRates = history.map((h) => h.fundingRate)
    } catch {
      // Proceed with empty history — statistical model handles it
      historicalRates = []
    }

    const prediction = await predictFundingRate(symbol, exchange, historicalRates, currentRate)

    return NextResponse.json({
      data: prediction,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message, timestamp: new Date().toISOString() }, { status: 500 })
  }
}
