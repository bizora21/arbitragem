import { safeFetch } from '@/lib/utils'
import { supabaseAdmin } from '@/lib/supabase'
import { getDexPrices, type DexPriceSourceType } from '@/lib/dex-price'
import { calculateFeeBreakdown, calculateNetEdge } from './fee-engine'
import { calculateSpreadReturn } from './return-calculator'

export interface SpreadData {
  symbol: string
  cexName: string
  cexPrice: number
  dexName: string
  dexPrice: number | null
  spreadPct: number | null
  direction: 'CEX_HIGHER' | 'DEX_HIGHER' | 'EQUAL' | null
  dexError: string | null
  dexSource: string | null
  dexSourceType: DexPriceSourceType | null
  grossEdge: number | null
  netEdge: number | null
  adjustedReturn: number | null
}

export interface SpreadResult {
  spreads: SpreadData[]
  alerts: SpreadData[]
  dexStatus: 'OK' | 'ERROR'
  dexStatusMsg: string | null
  dexSource: string | null
  dexSourceType: DexPriceSourceType | null
  timestamp: string
}

async function fetchCexPrices(): Promise<Record<string, number>> {
  const symbols = encodeURIComponent(JSON.stringify(['ETHUSDT', 'BTCUSDT']))
  const [binanceRes, okxRes] = await Promise.allSettled([
    safeFetch(`https://api.binance.com/api/v3/ticker/price?symbols=${symbols}`, {}, 8000),
    safeFetch('https://www.okx.com/api/v5/market/tickers?instType=SPOT', {}, 8000),
  ])

  const prices: Record<string, number> = {}

  if (binanceRes.status === 'fulfilled' && binanceRes.value.ok) {
    const data: { symbol: string; price: string }[] = await binanceRes.value.json()
    for (const item of data) prices[`BINANCE:${item.symbol}`] = parseFloat(item.price)
  }

  if (okxRes.status === 'fulfilled' && okxRes.value.ok) {
    const json = await okxRes.value.json()
    if (json.code === '0') {
      const targets = new Set(['ETH-USDT', 'BTC-USDT'])
      for (const item of json.data as { instId: string; last: string }[]) {
        if (targets.has(item.instId)) {
          prices[`OKX:${item.instId.replace(/-/g, '')}`] = parseFloat(item.last)
        }
      }
    }
  }

  return prices
}

export async function getCexDexSpreads(): Promise<SpreadResult> {
  const now = new Date().toISOString()

  const [cexResult, dexResult] = await Promise.allSettled([
    fetchCexPrices(),
    getDexPrices(),
  ])

  if (cexResult.status === 'rejected') {
    throw new Error(`CEX price fetch failed: ${cexResult.reason}`)
  }

  const priceMap = cexResult.value
  const dexOk = dexResult.status === 'fulfilled'
  const dexData = dexOk ? dexResult.value : null
  const dexErrorMsg = !dexOk ? String((dexResult as PromiseRejectedResult).reason) : null

  const assets = [
    { symbol: 'ETH', cexKey: 'ETHUSDT', dexPrice: dexData?.eth ?? null },
    { symbol: 'BTC', cexKey: 'BTCUSDT', dexPrice: dexData?.btc ?? null },
  ]

  const spreads: SpreadData[] = []

  for (const cex of ['BINANCE', 'OKX'] as const) {
    for (const asset of assets) {
      const cexPrice = priceMap[`${cex}:${asset.cexKey}`]
      if (!cexPrice) continue

      let spreadPct: number | null = null
      let direction: SpreadData['direction'] = null
      let grossEdge: number | null = null
      let netEdge: number | null = null
      let adjustedReturn: number | null = null

      if (asset.dexPrice != null) {
        spreadPct = ((cexPrice - asset.dexPrice) / asset.dexPrice) * 100
        if (Math.abs(spreadPct) < 0.001) direction = 'EQUAL'
        else direction = spreadPct > 0 ? 'CEX_HIGHER' : 'DEX_HIGHER'

        const capital = 1000
        grossEdge = capital * (Math.abs(spreadPct) / 100)
        const fees = calculateFeeBreakdown({ strategy: 'SPREAD', capital, exchanges: [cex] })
        netEdge = calculateNetEdge(grossEdge, fees)
        adjustedReturn = calculateSpreadReturn(spreadPct, asset.symbol).adjustedReturn
      }

      spreads.push({
        symbol: asset.symbol,
        cexName: cex,
        cexPrice,
        dexName: dexData?.source ?? 'DEX',
        dexPrice: asset.dexPrice,
        spreadPct,
        direction,
        dexError: dexErrorMsg,
        dexSource: dexData?.source ?? null,
        dexSourceType: dexData?.sourceType ?? null,
        grossEdge,
        netEdge,
        adjustedReturn,
      })
    }
  }

  // Persist significant spreads
  const significant = spreads.filter((s) => s.spreadPct != null && Math.abs(s.spreadPct) > 0.1)
  if (significant.length > 0) {
    const rows = significant.map((s) => ({
      symbol: s.symbol, cexName: s.cexName, cexPrice: s.cexPrice,
      dexName: s.dexName, dexPrice: s.dexPrice!, spreadPct: s.spreadPct!, direction: s.direction!,
      grossEdge: s.grossEdge, netEdge: s.netEdge, adjustedReturn: s.adjustedReturn,
    }))
    const { error } = await supabaseAdmin.from('CexDexSpread').insert(rows)
    if (error) console.error('[spread-monitor] db insert error:', error.message)
  }

  return {
    spreads,
    alerts: spreads.filter((s) => s.spreadPct != null && Math.abs(s.spreadPct) > 0.5),
    dexStatus: dexOk ? 'OK' : 'ERROR',
    dexStatusMsg: dexErrorMsg,
    dexSource: dexData?.source ?? null,
    dexSourceType: dexData?.sourceType ?? null,
    timestamp: now,
  }
}
