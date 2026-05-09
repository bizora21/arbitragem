import { ArbitrageOpportunity, Exchange, FundingRate, EXCHANGE_FEES } from '@/types'
import { quickAnnualizedReturn } from './profit-calculator'
import { analyzeRisk } from './risk-analyzer'
import { normalizeSymbol } from '@/lib/utils'
import { getOKXFundingRates } from '@/lib/exchanges/okx'
import { getBinanceFundingRates } from '@/lib/exchanges/binance'
import { getBybitFundingRates } from '@/lib/exchanges/bybit'

interface ExchangeRatesMap {
  [normalizedSymbol: string]: {
    [exchange in Exchange]?: FundingRate
  }
}

// Step 1: Collect all funding rates from all exchanges
export async function collectAllFundingRates(): Promise<{
  rates: FundingRate[]
  errors: Record<string, string>
}> {
  const results = await Promise.allSettled([
    getOKXFundingRates(),
    getBinanceFundingRates(),
    getBybitFundingRates(),
  ])

  const errors: Record<string, string> = {}
  const rates: FundingRate[] = []

  const exchanges: Exchange[] = ['OKX', 'BINANCE', 'BYBIT']
  results.forEach((result, i) => {
    const exchange = exchanges[i]
    if (result.status === 'fulfilled') {
      rates.push(...result.value)
    } else {
      errors[exchange] = result.reason?.message ?? 'Unknown error'
    }
  })

  return { rates, errors }
}

// Step 2: Normalize and group rates by symbol
export function groupRatesBySymbol(rates: FundingRate[]): ExchangeRatesMap {
  const map: ExchangeRatesMap = {}

  for (const rate of rates) {
    const normalized = normalizeSymbol(rate.symbol, rate.exchange)
    if (!map[normalized]) map[normalized] = {}
    map[normalized][rate.exchange] = { ...rate, normalizedSymbol: normalized } as FundingRate & { normalizedSymbol: string }
  }

  return map
}

// Step 3 & 4: Find and score opportunities
export async function findOpportunities(
  positionSizeUSD = 5,
  historicalRatesMap: Record<string, Record<Exchange, number[]>> = {}
): Promise<ArbitrageOpportunity[]> {
  const { rates, errors } = await collectAllFundingRates()

  if (rates.length === 0) {
    throw new Error(`All exchanges failed: ${JSON.stringify(errors)}`)
  }

  const grouped = groupRatesBySymbol(rates)
  const opportunities: ArbitrageOpportunity[] = []

  for (const [normalizedSymbol, exchangeRates] of Object.entries(grouped)) {
    const exchanges = Object.keys(exchangeRates) as Exchange[]

    // Need at least 2 exchanges to compare
    if (exchanges.length < 2) continue

    // Find best pair: highest - lowest rate
    let maxRate = -Infinity
    let minRate = Infinity
    let buyExchange: Exchange = exchanges[0]
    let sellExchange: Exchange = exchanges[0]

    for (const [exchange, rateData] of Object.entries(exchangeRates)) {
      const rate = rateData?.fundingRate ?? 0
      if (rate > maxRate) {
        maxRate = rate
        sellExchange = exchange as Exchange
      }
      if (rate < minRate) {
        minRate = rate
        buyExchange = exchange as Exchange
      }
    }

    // Skip if same exchange or no meaningful diff
    if (buyExchange === sellExchange) continue

    const fundingRateDiff = maxRate - minRate

    // Must have positive diff (short the high, long the low)
    if (fundingRateDiff <= 0) continue

    // Use average fees of both exchanges
    const buyFees = EXCHANGE_FEES[buyExchange]
    const sellFees = EXCHANGE_FEES[sellExchange]
    const avgSpotFee = (buyFees.spotMaker + sellFees.spotMaker) / 2
    const avgPerpFee = (buyFees.perpMaker + sellFees.perpMaker) / 2

    const annualizedReturn = quickAnnualizedReturn(fundingRateDiff, positionSizeUSD)

    // Step 6 filter: skip if annualized < 10%
    if (annualizedReturn < 10) continue

    // Risk analysis using historical data if available
    const historicalSell = historicalRatesMap[normalizedSymbol]?.[sellExchange] ?? []
    const riskResult = analyzeRisk({
      symbol: normalizedSymbol,
      exchange: sellExchange,
      currentFundingRate: maxRate,
      historicalRates: historicalSell,
      positionSizeUSD,
      spreadPercent: 0.05,
      leverage: 1,
    })

    // Step 6 filter: skip if risk > 7
    if (riskResult.overallRiskScore > 7) continue

    // Calculate more precise profit
    const { calculateArbitrageProfit } = await import('./profit-calculator')
    const profitResult = calculateArbitrageProfit({
      fundingRate: fundingRateDiff,
      positionSizeUSD,
      spotMakerFee: avgSpotFee,
      perpMakerFee: avgPerpFee,
      spreadPercent: 0.05,
      leverage: 1,
    })

    opportunities.push({
      id: `${normalizedSymbol}-${buyExchange}-${sellExchange}-${Date.now()}`,
      symbol: `${normalizedSymbol.replace('USDT', '')}/USDT`,
      normalizedSymbol,
      buyExchange,
      sellExchange,
      buyRate: minRate,
      sellRate: maxRate,
      fundingRateDiff,
      annualizedReturn: profitResult.annualizedReturn,
      riskScore: riskResult.overallRiskScore,
      netProfitPerPeriod: profitResult.netProfitPerPeriod,
      positionSizeUSD,
      breakEvenDays: profitResult.breakEvenDays,
      monthlyReturn: profitResult.monthlyReturn,
      monthlyProfitUSD: profitResult.monthlyProfitUSD,
      status: 'ACTIVE',
      createdAt: new Date(),
    })
  }

  // Step 5: Rank by annualized return adjusted by risk
  // Composite score: higher return + lower risk = better rank
  opportunities.sort((a, b) => {
    const scoreA = a.annualizedReturn / a.riskScore
    const scoreB = b.annualizedReturn / b.riskScore
    return scoreB - scoreA
  })

  return opportunities
}

// Get latest funding rates as flat list
export async function getLatestFundingRates(): Promise<FundingRate[]> {
  const { rates } = await collectAllFundingRates()
  return rates
}
