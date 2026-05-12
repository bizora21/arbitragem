import { safeFetch } from '@/lib/utils'
import { supabaseAdmin } from '@/lib/supabase'
import { getGasCost } from './fee-engine'
import { calculateYieldReturn } from './return-calculator'

export interface YieldPool {
  protocol: string
  chain: string
  asset: string
  poolSymbol: string
  apy: number
  apyBase: number
  apyReward: number
  tvlUsd: number
  gasCostEstimate: number
  netAPY: number
  capitalMin: number
}

export interface YieldOpportunity {
  fromProtocol: string
  toProtocol: string
  fromChain: string
  toChain: string
  asset: string
  currentApy: number
  targetApy: number
  gainPct: number
  adjustedGainPct: number
}

export interface YieldResult {
  pools: YieldPool[]
  opportunities: YieldOpportunity[]
  bestPerAsset: Record<string, YieldPool>
  timestamp: string
}

interface DefiLlamaPool {
  pool: string
  project: string
  chain: string
  symbol: string
  tvlUsd: number
  apy: number | null
  apyBase: number | null
  apyReward: number | null
}

const TRACKED_PROTOCOLS = new Set(['aave-v3', 'compound-v3', 'curve', 'yearn-finance'])
const TRACKED_ASSETS = ['USDC', 'USDT', 'DAI']
// L2-first ordering so best chain is preferred when APYs are equal
const TRACKED_CHAINS = new Set(['Base', 'Arbitrum', 'Optimism', 'Polygon', 'Ethereum'])
const CHAIN_PRIORITY: Record<string, number> = {
  Base: 1, Arbitrum: 2, Optimism: 3, Polygon: 4, Ethereum: 5,
}
const MIN_TVL = 500_000
const MAX_STABLECOIN_APY = 30
const DEFAULT_CAPITAL = 1000

const PROTOCOL_LABELS: Record<string, string> = {
  'aave-v3': 'Aave V3',
  'compound-v3': 'Compound V3',
  'curve': 'Curve',
  'yearn-finance': 'Yearn',
}

export async function getYieldRates(): Promise<YieldResult> {
  const res = await safeFetch('https://yields.llama.fi/pools', {}, 30000)
  if (!res.ok) throw new Error(`DefiLlama API error: ${res.status} ${res.statusText}`)

  const { data }: { data: DefiLlamaPool[] } = await res.json()

  const pools: YieldPool[] = data
    .filter(
      (p) =>
        TRACKED_PROTOCOLS.has(p.project) &&
        TRACKED_CHAINS.has(p.chain) &&
        TRACKED_ASSETS.some((a) => p.symbol.toUpperCase().includes(a)) &&
        (p.apy ?? 0) > 0 &&
        (p.apy ?? 0) <= MAX_STABLECOIN_APY &&
        p.tvlUsd > MIN_TVL
    )
    .map((p) => {
      const asset = TRACKED_ASSETS.find((a) => p.symbol.toUpperCase().includes(a)) ?? p.symbol
      const apy = p.apy ?? 0
      // Gas cost for 2 transactions (withdraw + deposit)
      const gasCostEstimate = getGasCost(p.chain) * 2
      // Net APY after annualizing gas over 12 rotations/year
      const annualizedGasPct = (gasCostEstimate * 12) / DEFAULT_CAPITAL * 100
      const netAPY = Math.max(0, apy - annualizedGasPct)
      // Minimum capital for gas to be <10% of annual gain
      const capitalMin = apy > 0 ? Math.ceil((gasCostEstimate * 12) / (apy / 100) * 10) : 9999

      return {
        protocol: PROTOCOL_LABELS[p.project] ?? p.project,
        chain: p.chain,
        asset,
        poolSymbol: p.symbol,
        apy,
        apyBase: p.apyBase ?? 0,
        apyReward: p.apyReward ?? 0,
        tvlUsd: p.tvlUsd,
        gasCostEstimate,
        netAPY,
        capitalMin,
      }
    })
    // Sort: L2 chains first, then by APY descending
    .sort((a, b) => {
      const chainDiff = (CHAIN_PRIORITY[a.chain] ?? 9) - (CHAIN_PRIORITY[b.chain] ?? 9)
      if (chainDiff !== 0) return chainDiff
      return b.apy - a.apy
    })
    .slice(0, 80)

  // Best per asset
  const bestPerAsset: Record<string, YieldPool> = {}
  for (const pool of pools) {
    if (!bestPerAsset[pool.asset] || pool.netAPY > bestPerAsset[pool.asset].netAPY) {
      bestPerAsset[pool.asset] = pool
    }
  }

  // Rotation opportunities: same asset, APY diff > 1%, different protocols
  const opportunities: YieldOpportunity[] = []
  for (const asset of TRACKED_ASSETS) {
    const assetPools = pools.filter((p) => p.asset === asset).sort((a, b) => b.apy - a.apy)
    for (let i = 0; i < assetPools.length; i++) {
      for (let j = i + 1; j < assetPools.length; j++) {
        const high = assetPools[i]
        const low = assetPools[j]
        const gainPct = high.apy - low.apy
        if (gainPct > 1.0 && high.protocol !== low.protocol) {
          const est = calculateYieldReturn(low.apy, high.apy, DEFAULT_CAPITAL, low.chain, high.chain)
          opportunities.push({
            fromProtocol: low.protocol,
            toProtocol: high.protocol,
            fromChain: low.chain,
            toChain: high.chain,
            asset,
            currentApy: low.apy,
            targetApy: high.apy,
            gainPct,
            adjustedGainPct: est.adjustedReturn,
          })
        }
      }
    }
  }

  // Persist top rates to DB — replaces all rows (current-state snapshot)
  if (pools.length > 0) {
    await supabaseAdmin.from('YieldRate').delete().neq('id', 'none')

    const rows = pools.slice(0, 40).map((p) => ({
      protocol: p.protocol,
      chain: p.chain,
      asset: p.asset,
      apy: p.apy,
      tvl: p.tvlUsd,
      gasCostEstimate: p.gasCostEstimate,
      netAPY: p.netAPY,
      capitalMin: p.capitalMin,
    }))
    const { error } = await supabaseAdmin.from('YieldRate').insert(rows)
    if (error) console.error('[yield-monitor] db insert error:', error.message)
  }

  return { pools, opportunities, bestPerAsset, timestamp: new Date().toISOString() }
}
