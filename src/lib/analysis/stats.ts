// Funções estatísticas puras — sem dependências externas.
// mean() e stdDev() já existem em utils.ts; importar daqui se possível.
import { mean, stdDev } from '@/lib/utils'

export { mean, stdDev }

export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  return lower === upper
    ? sorted[lower]
    : sorted[lower] + (index - lower) * (sorted[upper] - sorted[lower])
}

export function sharpeRatio(returns: number[], riskFreeRate = 0): number {
  if (returns.length < 2) return 0
  const avg = mean(returns)
  const sd = stdDev(returns)
  if (sd === 0) return 0
  return (avg - riskFreeRate) / sd
}

export function maxDrawdown(equityCurve: number[]): number {
  if (equityCurve.length === 0) return 0
  let peak = equityCurve[0]
  let maxDd = 0
  for (const val of equityCurve) {
    if (val > peak) peak = val
    const dd = peak - val
    if (dd > maxDd) maxDd = dd
  }
  return maxDd
}

export function winRate(trades: { pnl: number }[]): number {
  if (trades.length === 0) return 0
  const wins = trades.filter((t) => t.pnl > 0).length
  return wins / trades.length
}

export function profitFactor(trades: { pnl: number }[]): number {
  const grossProfit = trades.filter((t) => t.pnl > 0).reduce((s, t) => s + t.pnl, 0)
  const grossLoss   = Math.abs(trades.filter((t) => t.pnl < 0).reduce((s, t) => s + t.pnl, 0))
  if (grossLoss === 0) return grossProfit > 0 ? 999 : 0
  return grossProfit / grossLoss
}

export function zScore(value: number, avg: number, std: number): number {
  if (std === 0) return 0
  return (value - avg) / std
}

export function correlation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  if (n < 2) return 0
  const meanA = mean(a.slice(0, n))
  const meanB = mean(b.slice(0, n))
  let num = 0, denomA = 0, denomB = 0
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA
    const db = b[i] - meanB
    num    += da * db
    denomA += da * da
    denomB += db * db
  }
  const denom = Math.sqrt(denomA * denomB)
  return denom === 0 ? 0 : num / denom
}

// Regressão linear simples — retorna { slope, intercept, r2 }
export function linearRegression(y: number[]): { slope: number; intercept: number; r2: number } {
  const n = y.length
  if (n < 2) return { slope: 0, intercept: 0, r2: 0 }
  const x = Array.from({ length: n }, (_, i) => i)
  const meanX = mean(x)
  const meanY = mean(y)
  let ssXY = 0, ssXX = 0, ssYY = 0
  for (let i = 0; i < n; i++) {
    ssXY += (x[i] - meanX) * (y[i] - meanY)
    ssXX += (x[i] - meanX) ** 2
    ssYY += (y[i] - meanY) ** 2
  }
  const slope     = ssXX === 0 ? 0 : ssXY / ssXX
  const intercept = meanY - slope * meanX
  const r2        = ssYY === 0 ? 0 : (ssXY ** 2) / (ssXX * ssYY)
  return { slope, intercept, r2 }
}
