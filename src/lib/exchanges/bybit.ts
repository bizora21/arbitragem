import { FundingRate, FundingRateHistoryPoint } from '@/types'
import { safeFetch } from '@/lib/utils'

const BASE_URL = 'https://api.bybit.com/v5'

interface BybitTickerItem {
  symbol: string
  lastPrice: string
  markPrice: string
  indexPrice: string
  fundingRate: string
  nextFundingTime: string
  volume24h: string
  turnover24h: string
}

interface BybitTickersResponse {
  retCode: number
  retMsg: string
  result: {
    category: string
    list: BybitTickerItem[]
  }
}

interface BybitFundingHistoryItem {
  symbol: string
  fundingRate: string
  fundingRateTimestamp: string
}

interface BybitFundingHistoryResponse {
  retCode: number
  retMsg: string
  result: {
    category: string
    list: BybitFundingHistoryItem[]
  }
}

export async function getBybitFundingRates(): Promise<FundingRate[]> {
  const url = `${BASE_URL}/market/tickers?category=linear`

  const response = await safeFetch(url)
  if (!response.ok) {
    throw new Error(`Bybit API error: ${response.status} ${response.statusText}`)
  }

  const json: BybitTickersResponse = await response.json()

  if (json.retCode !== 0) {
    throw new Error(`Bybit API error: ${json.retMsg}`)
  }

  return json.result.list
    .filter((item) => item.symbol.endsWith('USDT') && item.fundingRate !== '')
    .map((item) => ({
      symbol: item.symbol,
      exchange: 'BYBIT' as const,
      fundingRate: parseFloat(item.fundingRate),
      markPrice: parseFloat(item.markPrice) || null,
      indexPrice: parseFloat(item.indexPrice) || null,
      nextFundingTime: item.nextFundingTime
        ? new Date(parseInt(item.nextFundingTime))
        : null,
      timestamp: new Date(),
      normalizedSymbol: item.symbol,
      volume24hUSD: parseFloat(item.turnover24h) || 0,
    }))
}

export async function getBybitFundingRateHistory(
  symbol: string,
  limit = 100
): Promise<FundingRateHistoryPoint[]> {
  const url = `${BASE_URL}/market/funding/history?category=linear&symbol=${symbol}&limit=${limit}`

  const response = await safeFetch(url)
  if (!response.ok) {
    throw new Error(`Bybit history API error: ${response.status}`)
  }

  const json: BybitFundingHistoryResponse = await response.json()

  if (json.retCode !== 0) {
    throw new Error(`Bybit history API error: ${json.retMsg}`)
  }

  return json.result.list.map((item) => ({
    symbol: item.symbol,
    exchange: 'BYBIT' as const,
    fundingRate: parseFloat(item.fundingRate),
    timestamp: new Date(parseInt(item.fundingRateTimestamp)),
  }))
}
