import { Exchange, EXCHANGE_FEES, FundingRate } from '@/types'
import { collectAllFundingRates, groupRatesBySymbol } from '@/lib/analyzer/opportunity-finder'
import { supabaseAdmin } from '@/lib/supabase'

// Slippage estimado pelo volume USDT 24h do par mais fraco (lado constrangedor)
function estimateSlippage(volumeUSD: number): number {
  if (volumeUSD > 10_000_000) return 0.0001  // 0.01% — >$10M/dia (BTC, ETH, SOL...)
  if (volumeUSD > 1_000_000)  return 0.0003  // 0.03% — >$1M/dia
  return 0.0005                               // 0.05% — <$1M/dia (pares ilíquidos)
}

// Fees de round-trip (entrada + saída) em ambas as exchanges
function estimateFees(exA: Exchange, exB: Exchange): number {
  const feesA = EXCHANGE_FEES[exA]
  const feesB = EXCHANGE_FEES[exB]
  const entryFees = feesA.perpMaker + feesB.perpMaker
  const exitFees  = feesA.perpMaker + feesB.perpMaker
  return entryFees + exitFees
}

export interface SnapshotRow {
  id?: string
  symbol: string
  exchangeA: Exchange
  exchangeB: Exchange
  fundingRateA: number
  fundingRateB: number
  spreadRaw: number
  feesEstimated: number
  slippageEst: number
  edgeNet: number
  volumeA24h: number
  volumeB24h: number
  timestamp: Date
}

export async function takeSnapshot(): Promise<SnapshotRow[]> {
  const { rates } = await collectAllFundingRates()
  if (rates.length === 0) return []

  const grouped = groupRatesBySymbol(rates)

  // Mapa rápido symbol+exchange → volume para lookup O(1)
  const volumeMap = new Map<string, number>()
  for (const rate of rates) {
    volumeMap.set(`${rate.symbol}|${rate.exchange}`, rate.volume24hUSD ?? 0)
  }

  const snapshots: SnapshotRow[] = []

  const pairs: [Exchange, Exchange][] = [
    ['OKX', 'BINANCE'],
    ['OKX', 'BYBIT'],
    ['BINANCE', 'BYBIT'],
  ]

  for (const [normalizedSymbol, exchangeRates] of Object.entries(grouped)) {
    for (const [exA, exB] of pairs) {
      const rateA = exchangeRates[exA] as FundingRate | undefined
      const rateB = exchangeRates[exB] as FundingRate | undefined
      if (!rateA || !rateB) continue

      const volumeA = rateA.volume24hUSD ?? 0
      const volumeB = rateB.volume24hUSD ?? 0
      // Slippage limitado pelo lado menos líquido
      const constrainingVolume = Math.min(volumeA, volumeB)

      const spreadRaw     = Math.abs(rateA.fundingRate - rateB.fundingRate)
      const feesEstimated = estimateFees(exA, exB)
      const slippageEst   = estimateSlippage(constrainingVolume)
      const edgeNet       = spreadRaw - feesEstimated - slippageEst

      snapshots.push({
        symbol:        normalizedSymbol,
        exchangeA:     exA,
        exchangeB:     exB,
        fundingRateA:  rateA.fundingRate,
        fundingRateB:  rateB.fundingRate,
        spreadRaw,
        feesEstimated,
        slippageEst,
        edgeNet,
        volumeA24h:    volumeA,
        volumeB24h:    volumeB,
        timestamp:     new Date(),
      })
    }
  }

  if (snapshots.length > 0) {
    const rows = snapshots.map((s) => ({
      symbol:        s.symbol,
      exchangeA:     s.exchangeA,
      exchangeB:     s.exchangeB,
      fundingRateA:  s.fundingRateA,
      fundingRateB:  s.fundingRateB,
      spreadRaw:     s.spreadRaw,
      feesEstimated: s.feesEstimated,
      slippageEst:   s.slippageEst,
      edgeNet:       s.edgeNet,
      volumeA24h:    s.volumeA24h,
      volumeB24h:    s.volumeB24h,
      timestamp:     s.timestamp.toISOString(),
    }))

    const { error } = await supabaseAdmin.from('EdgeSnapshot').insert(rows)
    if (error) console.error('[snapshot-engine] insert error:', error.message)
  }

  return snapshots
}

export async function getSnapshotHistory(
  symbol: string,
  hours = 24
): Promise<SnapshotRow[]> {
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString()

  const { data, error } = await supabaseAdmin
    .from('EdgeSnapshot')
    .select('*')
    .eq('symbol', symbol)
    .gte('timestamp', since)
    .order('timestamp', { ascending: true })

  if (error) {
    console.error('[snapshot-engine] history error:', error.message)
    return []
  }

  return (data ?? []).map((r) => ({
    ...r,
    exchangeA: r.exchangeA as Exchange,
    exchangeB: r.exchangeB as Exchange,
    timestamp: new Date(r.timestamp),
  }))
}

export async function getSnapshotsToday(): Promise<number> {
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)

  const { count } = await supabaseAdmin
    .from('EdgeSnapshot')
    .select('*', { count: 'exact', head: true })
    .gte('timestamp', startOfDay.toISOString())

  return count ?? 0
}
