import { ProfitCalculatorParams, ProfitCalculationResult, FUNDING_PERIODS_PER_DAY } from '@/types'

export function calculateArbitrageProfit(params: ProfitCalculatorParams): ProfitCalculationResult {
  const {
    fundingRate,
    positionSizeUSD,
    spotMakerFee,
    perpMakerFee,
    spreadPercent,
    leverage,
  } = params

  // Effective position size considering leverage
  const effectiveSize = positionSizeUSD * leverage

  // Gross funding earned per 8h period
  // In delta-neutral: long spot + short perp
  // If fundingRate > 0: shorts pay longs, so we earn funding on short perp
  const fundingPerPeriod = Math.abs(fundingRate) * effectiveSize

  // Entry costs:
  // 1. Spot buy fee (maker)
  const spotFee = effectiveSize * spotMakerFee
  // 2. Perp short open fee (maker)
  const perpFee = effectiveSize * perpMakerFee
  // 3. Spread cost (entering at slightly worse price)
  const spreadCost = effectiveSize * (spreadPercent / 100)

  const entryCost = spotFee + perpFee + spreadCost

  // Exit costs (same as entry costs — we'll close both positions eventually)
  const exitCost = spotFee + perpFee + spreadCost

  // Total round-trip cost
  const totalCost = entryCost + exitCost

  // Net profit per period after fees (amortized — assume we hold long enough)
  // For per-period net, we subtract a small portion of total cost amortized
  // Simplified: netProfitPerPeriod = fundingPerPeriod - (totalCost / estimatedPeriods)
  // We'll use 30 periods (10 days) as default amortization baseline for net calc
  const amortizationPeriods = 30
  const netProfitPerPeriod = fundingPerPeriod - totalCost / amortizationPeriods

  // Break-even: how many periods until total cost is recovered
  const breakEvenPeriods = fundingPerPeriod > 0 ? totalCost / fundingPerPeriod : Infinity
  const breakEvenDays = breakEvenPeriods / FUNDING_PERIODS_PER_DAY

  // Returns
  const periodsPerMonth = FUNDING_PERIODS_PER_DAY * 30
  const grossMonthlyProfit = fundingPerPeriod * periodsPerMonth
  const netMonthlyProfit = grossMonthlyProfit - totalCost
  const monthlyReturn = (netMonthlyProfit / positionSizeUSD) * 100

  const periodsPerYear = FUNDING_PERIODS_PER_DAY * 365
  const grossAnnualProfit = fundingPerPeriod * periodsPerYear
  const netAnnualProfit = grossAnnualProfit - totalCost
  const annualizedReturn = (netAnnualProfit / positionSizeUSD) * 100

  const monthlyProfitUSD = netMonthlyProfit

  return {
    fundingPerPeriod,
    netProfitPerPeriod,
    entryCost,
    breakEvenPeriods,
    breakEvenDays,
    monthlyReturn,
    annualizedReturn,
    monthlyProfitUSD,
  }
}

// Quick annualized return estimate (used in opportunity ranking)
export function quickAnnualizedReturn(fundingRateDiff: number, positionSizeUSD: number): number {
  const params: ProfitCalculatorParams = {
    fundingRate: fundingRateDiff,
    positionSizeUSD,
    spotMakerFee: 0.001,   // conservative average
    perpMakerFee: 0.0002,
    spreadPercent: 0.05,
    leverage: 1,
  }
  return calculateArbitrageProfit(params).annualizedReturn
}
