import { FundingRate, FundingRateHistoryPoint } from '@/types'
import { safeFetch, normalizeSymbol } from '@/lib/utils'

const BASE_URL = 'https://www.okx.com/api/v5'

interface OKXFundingRateItem {
  instId: string
  instType: string
  fundingRate: string
  fundingTime: string
  nextFundingTime: string
  realizedRate?: string
}

interface OKXTickerItem {
  instId: string
  volCcy24h: string  // volume em moeda cotada (USDT para pares USDT)
}

interface OKXMarkPriceItem {
  instId: string
  markPx: string
  idxPx: string
  ts: string
}

interface OKXHistoryItem {
  instId: string
  fundingRate: string
  realizedRate: string
  fundingTime: string
}

interface OKXResponse<T> {
  code: string
  msg: string
  data: T[]
}

interface OKXTickerSwap {
  instId:       string
  fundingRate:  string
  nextFundingTime: string
  volCcy24h:    string  // volume em USDT para pares USDT-SWAP
}

export async function getOKXFundingRates(): Promise<FundingRate[]> {
  // /market/tickers?instType=SWAP devolve fundingRate + volume numa única chamada
  const res = await safeFetch(`${BASE_URL}/market/tickers?instType=SWAP`)
  if (!res.ok) throw new Error(`OKX API error: ${res.status} ${res.statusText}`)

  const json: OKXResponse<OKXTickerSwap> = await res.json()
  if (json.code !== '0') throw new Error(`OKX API error: ${json.msg}`)

  return json.data
    .filter((item) => item.instId.endsWith('-USDT-SWAP') && item.fundingRate !== '')
    .map((item) => ({
      symbol:           item.instId,
      exchange:         'OKX' as const,
      fundingRate:      parseFloat(item.fundingRate) || 0,
      markPrice:        null,
      indexPrice:       null,
      nextFundingTime:  item.nextFundingTime ? new Date(parseInt(item.nextFundingTime)) : null,
      timestamp:        new Date(),
      normalizedSymbol: normalizeSymbol(item.instId, 'OKX'),
      volume24hUSD:     parseFloat(item.volCcy24h) || 0,
    }))
}

export async function getOKXMarkPrice(instId: string): Promise<number | null> {
  const url = `${BASE_URL}/public/mark-price?instId=${instId}&instType=SWAP`

  try {
    const response = await safeFetch(url)
    if (!response.ok) return null

    const json: OKXResponse<OKXMarkPriceItem> = await response.json()
    if (json.code !== '0' || !json.data[0]) return null

    return parseFloat(json.data[0].markPx)
  } catch {
    return null
  }
}

export async function getOKXFundingRateHistory(
  instId: string,
  limit = 100
): Promise<FundingRateHistoryPoint[]> {
  const url = `${BASE_URL}/public/funding-rate-history?instId=${instId}&limit=${limit}`

  const response = await safeFetch(url)
  if (!response.ok) {
    throw new Error(`OKX history API error: ${response.status}`)
  }

  const json: OKXResponse<OKXHistoryItem> = await response.json()
  if (json.code !== '0') {
    throw new Error(`OKX history API error: ${json.msg}`)
  }

  return json.data.map((item) => ({
    symbol: item.instId,
    exchange: 'OKX' as const,
    fundingRate: parseFloat(item.fundingRate),
    timestamp: new Date(parseInt(item.fundingTime)),
  }))
}
