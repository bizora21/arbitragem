import { collectAllFundingRates, findOpportunities, groupRatesBySymbol } from '@/lib/analyzer/opportunity-finder'
import { supabaseAdmin } from '@/lib/supabase'
import type { ArbitrageOpportunity, FundingRate, Exchange } from '@/types'
import { calculateFeeBreakdown, calculateNetEdge, minimumCapitalRequired } from './fee-engine'
import { calculateFundingReturnSync } from './return-calculator'

export interface FundingRateRow {
  symbol: string
  OKX: number | null
  BINANCE: number | null
  BYBIT: number | null
  bestDiff: number
  annualizedReturn: number
  adjustedReturn: number
  grossReturn: number
  netEdge: number | null
  grossEdge: number | null
  capitalMin: number | null
  decayFactor: number
  nextFundingTime: string | null
}

export interface FundingSnapshot {
  rows: FundingRateRow[]
  opportunities: ArbitrageOpportunity[]
  errors: Record<string, string>
  totalSymbols: number
  timestamp: string
}

export async function getFundingSnapshot(positionSizeUSD = 5): Promise<FundingSnapshot> {
  const { rates, errors } = await collectAllFundingRates()

  if (rates.length === 0) {
    throw new Error(`All exchanges failed: ${JSON.stringify(errors)}`)
  }

  const grouped = groupRatesBySymbol(rates)

  const DEFAULT_CAPITAL = 1000
  const rows: FundingRateRow[] = Object.entries(grouped)
    .map(([symbol, exchangeRates]) => {
      const rateValues = Object.values(exchangeRates).map((e) => (e as FundingRate).fundingRate)
      const maxRate = Math.max(...rateValues)
      const minRate = Math.min(...rateValues)
      const bestDiff = maxRate - minRate

      const exchanges = Object.entries(exchangeRates)
        .sort((a, b) => (b[1] as FundingRate).fundingRate - (a[1] as FundingRate).fundingRate)
        .map(([ex]) => ex)

      const returnEst = calculateFundingReturnSync(bestDiff)
      const grossEdge = DEFAULT_CAPITAL * bestDiff
      const fees = calculateFeeBreakdown({
        strategy: 'FUNDING',
        capital: DEFAULT_CAPITAL,
        exchanges: exchanges.slice(0, 2),
      })
      const netEdge = calculateNetEdge(grossEdge, fees)
      const capitalMin = minimumCapitalRequired(bestDiff * 100, 'FUNDING', exchanges.slice(0, 2))

      return {
        symbol,
        OKX: (exchangeRates['OKX'] as FundingRate | undefined)?.fundingRate ?? null,
        BINANCE: (exchangeRates['BINANCE'] as FundingRate | undefined)?.fundingRate ?? null,
        BYBIT: (exchangeRates['BYBIT'] as FundingRate | undefined)?.fundingRate ?? null,
        bestDiff,
        annualizedReturn: returnEst.grossReturn,
        adjustedReturn: returnEst.adjustedReturn,
        grossReturn: returnEst.grossReturn,
        netEdge,
        grossEdge,
        capitalMin: capitalMin === Infinity ? null : capitalMin,
        decayFactor: returnEst.decayFactor,
        nextFundingTime:
          ((exchangeRates['BINANCE'] as FundingRate | undefined)?.nextFundingTime ??
            (exchangeRates['OKX'] as FundingRate | undefined)?.nextFundingTime ??
            (exchangeRates['BYBIT'] as FundingRate | undefined)?.nextFundingTime ??
            null)
            ?.toISOString() ?? null,
      }
    })
    .filter((r) => r.bestDiff > 0)
    .sort((a, b) => b.bestDiff - a.bestDiff)

  const opportunities = await findOpportunities(positionSizeUSD).catch(() => [] as ArbitrageOpportunity[])

  // Persist snapshot sample to DB (top 100 by funding rate magnitude)
  const topRates = rates
    .sort((a, b) => Math.abs(b.fundingRate) - Math.abs(a.fundingRate))
    .slice(0, 100)

  if (topRates.length > 0) {
    const dbRows = topRates.map((r) => ({
      symbol: (r as FundingRate & { normalizedSymbol?: string }).normalizedSymbol ?? r.symbol,
      exchange: r.exchange as string,
      fundingRate: r.fundingRate,
      markPrice: r.markPrice,
      indexPrice: r.indexPrice,
      nextFundingTime: r.nextFundingTime?.toISOString() ?? null,
    }))

    const { error } = await supabaseAdmin.from('FundingRateSnapshot').insert(dbRows)
    if (error) console.error('[funding-monitor] db insert error:', error.message)
  }

  return {
    rows,
    opportunities,
    errors,
    totalSymbols: Object.keys(grouped).length,
    timestamp: new Date().toISOString(),
  }
}

export async function getExchangeStatuses(): Promise<{ exchange: Exchange; ok: boolean; rateCount: number }[]> {
  const { rates, errors } = await collectAllFundingRates()
  const exchanges: Exchange[] = ['OKX', 'BINANCE', 'BYBIT']
  return exchanges.map((ex) => ({
    exchange: ex,
    ok: !errors[ex],
    rateCount: rates.filter((r) => r.exchange === ex).length,
  }))
}
