import { FundingRate, FundingRateHistoryPoint } from '@/types'
import { safeFetch } from '@/lib/utils'

const BASE_URL = 'https://fapi.binance.com/fapi/v1'

interface BinancePremiumIndex {
  symbol: string
  markPrice: string
  indexPrice: string
  estimatedSettlePrice: string
  lastFundingRate: string
  nextFundingTime: number
  interestRate: string
  time: number
}

interface BinanceFundingRateItem {
  symbol: string
  fundingRate: string
  fundingTime: number
  markPrice: string
}

export async function getBinanceFundingRates(): Promise<FundingRate[]> {
  // premiumIndex returns all symbols with current funding rate
  const url = `${BASE_URL}/premiumIndex`

  const response = await safeFetch(url)
  if (!response.ok) {
    throw new Error(`Binance API error: ${response.status} ${response.statusText}`)
  }

  const data: BinancePremiumIndex[] = await response.json()

  return data
    .filter((item) => item.symbol.endsWith('USDT'))
    .map((item) => ({
      symbol: item.symbol,
      exchange: 'BINANCE' as const,
      fundingRate: parseFloat(item.lastFundingRate),
      markPrice: parseFloat(item.markPrice),
      indexPrice: parseFloat(item.indexPrice),
      nextFundingTime: item.nextFundingTime ? new Date(item.nextFundingTime) : null,
      timestamp: new Date(item.time),
      normalizedSymbol: item.symbol,
    }))
}

export async function getBinanceFundingRateHistory(
  symbol: string,
  limit = 100
): Promise<FundingRateHistoryPoint[]> {
  const url = `${BASE_URL}/fundingRate?symbol=${symbol}&limit=${limit}`

  const response = await safeFetch(url)
  if (!response.ok) {
    throw new Error(`Binance history API error: ${response.status}`)
  }

  const data: BinanceFundingRateItem[] = await response.json()

  return data.map((item) => ({
    symbol: item.symbol,
    exchange: 'BINANCE' as const,
    fundingRate: parseFloat(item.fundingRate),
    timestamp: new Date(item.fundingTime),
  }))
}
