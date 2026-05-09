import { RiskAnalysisParams, RiskAnalysisResult } from '@/types'
import { stdDev, mean } from '@/lib/utils'

export function analyzeRisk(params: RiskAnalysisParams): RiskAnalysisResult {
  const {
    currentFundingRate,
    historicalRates,
    positionSizeUSD,
    volume24h,
    spreadPercent = 0.05,
    leverage = 1,
  } = params

  const warnings: string[] = []
  let riskPoints = 0

  // 1. Funding Rate Volatility (std dev of last 30 rates)
  const recentRates = historicalRates.slice(-30)
  const fundingRateVolatility = stdDev(recentRates)

  // High volatility → higher risk
  if (fundingRateVolatility > 0.001) {
    riskPoints += 3
    warnings.push('Alta volatilidade do funding rate')
  } else if (fundingRateVolatility > 0.0005) {
    riskPoints += 2
  } else {
    riskPoints += 1
  }

  // 2. Flip Probability (% of historical rates that are negative)
  const negativeCount = recentRates.filter((r) => r < 0).length
  const flipProbability = recentRates.length > 0 ? negativeCount / recentRates.length : 0.5

  if (flipProbability > 0.3) {
    riskPoints += 3
    warnings.push(`${(flipProbability * 100).toFixed(0)}% de chance de funding virar negativo`)
  } else if (flipProbability > 0.15) {
    riskPoints += 2
  } else {
    riskPoints += 0.5
  }

  // 3. Liquidation Distance (% move to liquidation at given leverage)
  // For delta-neutral at leverage=1, effectively no liquidation risk on perp side
  // Risk comes from margin requirements on the perp leg
  const liquidationDistance = leverage > 1 ? (1 / leverage) * 100 : 100
  if (liquidationDistance < 10) {
    riskPoints += 3
    warnings.push(`Distância de liquidação baixa: ${liquidationDistance.toFixed(1)}%`)
  } else if (liquidationDistance < 20) {
    riskPoints += 1
  }

  // 4. Spread Trend analysis
  let spreadTrend: 'WIDENING' | 'STABLE' | 'NARROWING' = 'STABLE'
  if (spreadPercent > 0.1) {
    spreadTrend = 'WIDENING'
    riskPoints += 2
    warnings.push('Spread spot-perp alto')
  } else if (spreadPercent < 0.02) {
    spreadTrend = 'NARROWING'
  }

  // 5. Volume check (volume must be >10x position size for easy entry/exit)
  let volumeAdequate = true
  if (volume24h !== undefined) {
    const requiredVolume = positionSizeUSD * 10
    if (volume24h < requiredVolume) {
      volumeAdequate = false
      riskPoints += 2
      warnings.push('Volume insuficiente para o tamanho da posição')
    }
  }

  // 6. Current rate sanity check
  const avgRate = mean(recentRates)
  if (Math.abs(currentFundingRate - avgRate) > fundingRateVolatility * 3) {
    riskPoints += 1
    warnings.push('Funding rate atual é um outlier histórico')
  }

  // Normalize risk score to 1-10
  const overallRiskScore = Math.min(10, Math.max(1, Math.round(riskPoints)))

  return {
    fundingRateVolatility,
    flipProbability,
    liquidationDistance,
    spreadTrend,
    volumeAdequate,
    overallRiskScore,
    warnings,
  }
}
