import { calculateFeeBreakdown, calculateNetEdge, getGasCost } from './fee-engine'

export type ViabilityLevel = 'FULL' | 'PARTIAL' | 'INSUFFICIENT'

export interface CapitalAnalysis {
  strategy: string
  capitalMin: number
  capitalOptimal: number
  capitalUser: number
  isViable: boolean
  viabilityLevel: ViabilityLevel
  simulatedReturn: number
  gasROI: number
  recommendedChain: string
}

export interface SimulatedReturn {
  annualReturn: number
  monthlyReturn: number
  gasROI: number
}

export const YIELD_CHAIN_PRIORITY = ['Base', 'Arbitrum', 'Optimism', 'Polygon', 'Ethereum']

export const CAPITAL_MINIMUMS: Record<string, number> = {
  FUNDING: 500,
  DEPEG: 1,
  YIELD: 1,
  SPREAD: 0,
}

// Optimal capital: point of diminishing returns (fee impact < 1% of gross gain)
const CAPITAL_OPTIMAL: Record<string, number> = {
  FUNDING: 5000,
  DEPEG: 500,
  YIELD: 500,
  SPREAD: 2000,
}

export function analyzeCapital(
  strategy: string,
  userCapital: number,
  opportunity?: { grossEdgePct?: number; chains?: string[]; exchanges?: string[]; apy?: number }
): CapitalAnalysis {
  const capitalMin = CAPITAL_MINIMUMS[strategy] ?? 100
  const capitalOptimal = CAPITAL_OPTIMAL[strategy] ?? 1000
  const recommendedChain = getBestChain(strategy, userCapital)

  const isViable = userCapital >= capitalMin
  let viabilityLevel: ViabilityLevel
  if (userCapital >= capitalOptimal) viabilityLevel = 'FULL'
  else if (userCapital >= capitalMin) viabilityLevel = 'PARTIAL'
  else viabilityLevel = 'INSUFFICIENT'

  const sim = simulateReturn(
    strategy,
    userCapital,
    opportunity?.apy,
    recommendedChain
  )

  const gasCost = getGasCost(recommendedChain) * 2
  const gasROI = calculateGasROI(userCapital, opportunity?.grossEdgePct ?? getDefaultEdgePct(strategy), gasCost, recommendedChain)

  return {
    strategy,
    capitalMin,
    capitalOptimal,
    capitalUser: userCapital,
    isViable,
    viabilityLevel,
    simulatedReturn: sim.annualReturn,
    gasROI,
    recommendedChain,
  }
}

export function simulateReturn(
  strategy: string,
  capital: number,
  apy?: number,
  chain?: string
): SimulatedReturn {
  const ch = chain ?? getBestChain(strategy, capital)
  const gasCost = getGasCost(ch) * 2

  let annualReturn = 0

  switch (strategy) {
    case 'YIELD': {
      const effectiveAPY = apy ?? 4.5
      const annualizedGas = (gasCost * 12) / capital * 100
      const netAPY = Math.max(0, effectiveAPY - annualizedGas)
      annualReturn = capital * (netAPY / 100)
      break
    }
    case 'FUNDING': {
      // Conservative: 10% annualized adjusted return on capital
      const fees = calculateFeeBreakdown({ strategy: 'FUNDING', capital })
      const netEdge = calculateNetEdge(capital * 0.001, fees)
      annualReturn = Math.max(0, netEdge * 3 * 365 * 0.65)
      break
    }
    case 'DEPEG': {
      // Assume 1-2 events/month at 0.5% capture each
      const capturePerEvent = capital * 0.003
      annualReturn = capturePerEvent * 18 // ~18 events/year
      break
    }
    case 'SPREAD': {
      // Assume 2 trades/day at 0.05% net each
      const fees = calculateFeeBreakdown({ strategy: 'SPREAD', capital })
      const netPerTrade = calculateNetEdge(capital * 0.0005, fees)
      annualReturn = Math.max(0, netPerTrade * 2 * 365)
      break
    }
  }

  const monthlyReturn = annualReturn / 12
  const gasROI = calculateGasROI(capital, getDefaultEdgePct(strategy), gasCost * 12, ch)

  return { annualReturn, monthlyReturn, gasROI }
}

export function calculateGasROI(
  capital: number,
  expectedGainPct: number,
  gasCost: number,
  _chain: string
): number {
  if (gasCost <= 0) return Infinity
  const annualGain = capital * (expectedGainPct / 100)
  return (annualGain / gasCost) * 100
}

function getBestChain(strategy: string, capital: number): string {
  if (strategy === 'FUNDING') return 'CEX'
  if (strategy === 'DEPEG') return capital < 100 ? 'Base' : 'Ethereum'
  // YIELD + SPREAD: prefer L2 for gas savings
  return YIELD_CHAIN_PRIORITY[0] // Base
}

function getDefaultEdgePct(strategy: string): number {
  switch (strategy) {
    case 'FUNDING': return 0.1
    case 'YIELD':   return 4.5
    case 'DEPEG':   return 0.3
    case 'SPREAD':  return 0.05
    default:        return 0.1
  }
}
