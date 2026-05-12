import { supabaseAdmin } from '@/lib/supabase'

export interface ReturnEstimate {
  grossReturn: number
  adjustedReturn: number
  expectedPeriods: number
  decayFactor: number
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW'
}

// Funding: each period is 8h. Default: assume spread persists 2 periods before reverting.
const DEFAULT_EXPECTED_PERIODS = 2
const DEFAULT_DECAY_FACTOR = 0.65

// Annualized gas cost ratio — gas / capital — used to adjust yield returns
function annualizedGasRatio(gasCostUsd: number, capital: number, rotationsPerYear = 12): number {
  if (capital <= 0) return 0
  return (gasCostUsd * rotationsPerYear) / capital
}

function confidenceFromDecay(decay: number, sampleSize: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (sampleSize < 5) return 'LOW'
  if (decay >= 0.75 && sampleSize >= 20) return 'HIGH'
  if (decay >= 0.5) return 'MEDIUM'
  return 'LOW'
}

export async function calculateDecayFactor(
  symbol: string,
  exchange1: string,
  exchange2: string
): Promise<number> {
  try {
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
    const { data } = await supabaseAdmin
      .from('FundingRateHistory')
      .select('fundingRate, timestamp')
      .in('exchange', [exchange1, exchange2])
      .eq('symbol', symbol)
      .gte('timestamp', since)
      .order('timestamp', { ascending: true })
      .limit(200)

    if (!data || data.length < 10) return DEFAULT_DECAY_FACTOR

    // Compute how often the spread actually persists for 2+ periods
    // Proxy: variance ratio (low variance = spread is stable = high decay factor would be incorrect;
    // high variance = mean-reverting faster = lower decay)
    const rates = data.map((r: { fundingRate: number }) => r.fundingRate)
    const mean = rates.reduce((s: number, v: number) => s + v, 0) / rates.length
    const variance = rates.reduce((s: number, v: number) => s + (v - mean) ** 2, 0) / rates.length
    const cv = Math.sqrt(variance) / (Math.abs(mean) + 1e-9)

    // High CV (volatile) → fast reversion → lower decay
    const decay = Math.max(0.3, Math.min(0.9, 1 - cv * 0.5))
    return decay
  } catch {
    return DEFAULT_DECAY_FACTOR
  }
}

export async function calculateExpectedDuration(
  symbol: string,
  exchange1: string,
  exchange2: string
): Promise<number> {
  try {
    const { data } = await supabaseAdmin
      .from('OpportunityLife')
      .select('alive1m, alive5m, alive30m')
      .eq('symbol', symbol)
      .in('exchangeA', [exchange1, exchange2])
      .limit(50)

    if (!data || data.length < 5) return DEFAULT_EXPECTED_PERIODS

    const alive30m = data.filter((r: { alive30m: boolean | null }) => r.alive30m).length / data.length
    // alive30m ~ alive for at least 30min ≈ ~2+ 8h periods is too long; use as proxy for persistence
    // Map: if 70%+ alive at 30m → 3 periods; 40-70% → 2; <40% → 1
    if (alive30m >= 0.7) return 3
    if (alive30m >= 0.4) return 2
    return 1
  } catch {
    return DEFAULT_EXPECTED_PERIODS
  }
}

// ── Funding Arbitrage ────────────────────────────────────────────────────────

export async function calculateFundingReturn(
  bestDiff: number,
  symbol: string,
  longExchange: string,
  shortExchange: string
): Promise<ReturnEstimate> {
  const [decay, expectedPeriods] = await Promise.all([
    calculateDecayFactor(symbol, longExchange, shortExchange),
    calculateExpectedDuration(symbol, longExchange, shortExchange),
  ])

  const periods = Math.min(expectedPeriods, 3)
  // grossReturn: old inflated formula (annualized %)
  const grossReturn = bestDiff * 3 * 365 * 100
  // adjustedReturn: realistic — only count expected periods, apply decay
  const adjustedReturn = bestDiff * periods * 100 * decay

  return {
    grossReturn,
    adjustedReturn,
    expectedPeriods,
    decayFactor: decay,
    confidenceLevel: confidenceFromDecay(decay, expectedPeriods * 10),
  }
}

// Sync version for use in non-async contexts (uses defaults)
export function calculateFundingReturnSync(bestDiff: number): ReturnEstimate {
  const grossReturn = bestDiff * 3 * 365 * 100
  const adjustedReturn = bestDiff * DEFAULT_EXPECTED_PERIODS * 100 * DEFAULT_DECAY_FACTOR
  return {
    grossReturn,
    adjustedReturn,
    expectedPeriods: DEFAULT_EXPECTED_PERIODS,
    decayFactor: DEFAULT_DECAY_FACTOR,
    confidenceLevel: 'LOW',
  }
}

// ── Yield Rotation ───────────────────────────────────────────────────────────

export function calculateYieldReturn(
  currentAPY: number,
  targetAPY: number,
  capital: number,
  fromChain: string,
  toChain: string
): ReturnEstimate {
  const GAS: Record<string, number> = {
    Ethereum: 20, Base: 0.05, Arbitrum: 0.20, Optimism: 0.05, Polygon: 0.02,
  }
  const gas1 = GAS[fromChain] ?? 5
  const gas2 = GAS[toChain] ?? 5
  const totalGas = gas1 + gas2

  const grossReturn = targetAPY - currentAPY
  const isCrossChain = fromChain !== toChain
  // Annualize gas cost assuming ~12 rotations/year
  const gasAnnualized = annualizedGasRatio(totalGas + (isCrossChain ? 2.5 : 0), capital) * 100
  const adjustedReturn = Math.max(0, grossReturn - gasAnnualized)

  const confidence: 'HIGH' | 'MEDIUM' | 'LOW' =
    capital >= 5000 ? 'HIGH' : capital >= 500 ? 'MEDIUM' : 'LOW'

  return {
    grossReturn,
    adjustedReturn,
    expectedPeriods: 365, // continuous
    decayFactor: 1.0,     // APY is not time-decaying in the same way
    confidenceLevel: confidence,
  }
}

// ── Depeg Trading ────────────────────────────────────────────────────────────

export function calculateDepegReturn(
  deviationPct: number,
  _stablecoin: string
): ReturnEstimate {
  const abs = Math.abs(deviationPct)
  const grossReturn = abs
  // Realistic capture: 60% of deviation actually captured (slippage, timing)
  const adjustedReturn = abs * 0.6

  const confidence: 'HIGH' | 'MEDIUM' | 'LOW' =
    abs > 1 ? 'HIGH' : abs > 0.5 ? 'MEDIUM' : 'LOW'

  return {
    grossReturn,
    adjustedReturn,
    expectedPeriods: 1,
    decayFactor: 0.6,
    confidenceLevel: confidence,
  }
}

// ── CEX-DEX Spread ───────────────────────────────────────────────────────────

export function calculateSpreadReturn(
  spreadPct: number,
  _pair: string
): ReturnEstimate {
  const abs = Math.abs(spreadPct)
  const grossReturn = abs
  // Single execution — not annualized. Realistic: 70% capture after fees & slippage
  const adjustedReturn = abs * 0.7

  const confidence: 'HIGH' | 'MEDIUM' | 'LOW' =
    abs > 1 ? 'HIGH' : abs > 0.5 ? 'MEDIUM' : 'LOW'

  return {
    grossReturn,
    adjustedReturn,
    expectedPeriods: 1,
    decayFactor: 0.7,
    confidenceLevel: confidence,
  }
}
