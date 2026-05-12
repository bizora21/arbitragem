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

interface BinanceTicker24h {
  symbol: string
  quoteVolume: string  // volume em USDT
}

interface BinanceFundingRateItem {
  symbol: string
  fundingRate: string
  fundingTime: number
  markPrice: string
}

export async function getBinanceFundingRates(): Promise<FundingRate[]> {
  const [premiumRes, tickerRes] = await Promise.allSettled([
    safeFetch(`${BASE_URL}/premiumIndex`),
    safeFetch(`${BASE_URL}/ticker/24hr`),
  ])

  if (premiumRes.status === 'rejected' || !premiumRes.value.ok) {
    throw new Error(`Binance API error: ${premiumRes.status === 'rejected' ? premiumRes.reason : premiumRes.value.statusText}`)
  }

  const premiumData: BinancePremiumIndex[] = await premiumRes.value.json()

  // Mapa symbol → quoteVolume (USDT)
  const volumeMap: Record<string, number> = {}
  if (tickerRes.status === 'fulfilled' && tickerRes.value.ok) {
    const tickerData: BinanceTicker24h[] = await tickerRes.value.json()
    for (const t of tickerData) {
      volumeMap[t.symbol] = parseFloat(t.quoteVolume) || 0
    }
  }

  return premiumData
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
      volume24hUSD: volumeMap[item.symbol] ?? 0,
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
