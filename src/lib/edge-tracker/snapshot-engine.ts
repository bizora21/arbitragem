import { Exchange, EXCHANGE_FEES, FundingRate } from '@/types'
import { collectAllFundingRates, groupRatesBySymbol } from '@/lib/analyzer/opportunity-finder'
import { supabaseAdmin } from '@/lib/supabase'

// Slippage estimado por nível de volume (conservador, sem dados reais de volume)
function estimateSlippage(_volumeUSD: number): number {
  if (_volumeUSD > 10_000_000) return 0.0001  // 0.01%
  if (_volumeUSD > 1_000_000)  return 0.0003  // 0.03%
  return 0.0005                                // 0.05%
}

// Calcula fees de round-trip para um par de exchanges
function estimateFees(exA: Exchange, exB: Exchange): number {
  const feesA = EXCHANGE_FEES[exA]
  const feesB = EXCHANGE_FEES[exB]
  // Entrada: maker perp em A + maker perp em B
  // Saída: mesma estrutura
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

// Gera um snapshot de edge para todos os pares disponíveis
export async function takeSnapshot(): Promise<SnapshotRow[]> {
  const { rates } = await collectAllFundingRates()
  if (rates.length === 0) return []

  const grouped = groupRatesBySymbol(rates)
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

      const spreadRaw    = Math.abs(rateA.fundingRate - rateB.fundingRate)
      const feesEstimated = estimateFees(exA, exB)
      const slippageEst  = estimateSlippage(0) // sem dados de volume reais
      const edgeNet      = spreadRaw - feesEstimated - slippageEst

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
        volumeA24h:    0,
        volumeB24h:    0,
        timestamp:     new Date(),
      })
    }
  }

  // Persiste em batch no Supabase
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

// Busca histórico de snapshots das últimas N horas para um símbolo
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
    exchangeA:  r.exchangeA  as Exchange,
    exchangeB:  r.exchangeB  as Exchange,
    timestamp:  new Date(r.timestamp),
  }))
}

// Retorna o count de snapshots hoje
export async function getSnapshotsToday(): Promise<number> {
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)

  const { count } = await supabaseAdmin
    .from('EdgeSnapshot')
    .select('*', { count: 'exact', head: true })
    .gte('timestamp', startOfDay.toISOString())

  return count ?? 0
}
