import { safeFetch } from '@/lib/utils'
import { supabaseAdmin } from '@/lib/supabase'

interface DefiLlamaPool {
  chain: string
  project: string
  symbol: string
  tvlUsd: number
  apyBase: number | null
  apyReward: number | null
  apy: number
  rewardTokens: string[] | null
  pool: string
  volumeUsd1d: number | null
}

export interface LPPool {
  id?: string
  protocol: string
  chain: string
  pair: string
  tvlUsd: number
  feeAPY: number
  emissionAPY: number
  realAPY: number
  volume24h: number
  rewardToken: string | null
  poolId: string
  updatedAt?: string
}

const TARGET_PROTOCOLS = [
  'aerodrome-finance',
  'aerodrome',
  'velodrome-finance',
  'velodrome',
  'curve-dex',
  'curve',
  'uniswap-v3',
  'gmx',
  'aave-v3',
  'compound-v3',
]

const PRIORITY_CHAINS = ['Base', 'Optimism', 'Arbitrum', 'Ethereum', 'Polygon']

const STABLECOINS = ['USDC', 'USDT', 'DAI', 'FRAX', 'LUSD', 'USDE', 'CRVUSD', 'SUSD', 'MIM']

function isStablePair(symbol: string): boolean {
  const up = symbol.toUpperCase()
  return STABLECOINS.some((s) => up.includes(s))
}

function matchesTarget(project: string): boolean {
  const p = project.toLowerCase()
  return TARGET_PROTOCOLS.some((t) => p === t || p.startsWith(t))
}

// Emission tokens lose value — apply conservative decay to reward APY
function adjustedRealAPY(apyBase: number, apyReward: number, project: string): number {
  // Established protocols: 80% of reward APY is realizable
  // New/smaller ones: 60%
  const capture = ['aerodrome', 'velodrome', 'curve'].some((t) => project.toLowerCase().includes(t))
    ? 0.8
    : 0.6
  return apyBase + apyReward * capture
}

export async function scanLPPools(): Promise<{ pools: LPPool[]; errors: Record<string, string> }> {
  const errors: Record<string, string> = {}

  const res = await safeFetch('https://yields.llama.fi/pools', undefined, 20000).catch(() => null)
  if (!res?.ok) {
    errors['defillama'] = 'Failed to fetch pools'
    return { pools: [], errors }
  }

  const json: { data: DefiLlamaPool[] } = await res.json().catch(() => ({ data: [] }))

  const pools: LPPool[] = json.data
    .filter(
      (p) =>
        matchesTarget(p.project) &&
        PRIORITY_CHAINS.includes(p.chain) &&
        p.tvlUsd > 100_000 &&
        (p.apy ?? 0) > 0.5 &&
        (isStablePair(p.symbol) || p.tvlUsd > 500_000)
    )
    .slice(0, 120)
    .map((p) => {
      const base = p.apyBase ?? 0
      const reward = p.apyReward ?? 0
      return {
        protocol: p.project,
        chain: p.chain,
        pair: p.symbol,
        tvlUsd: p.tvlUsd,
        feeAPY: base,
        emissionAPY: reward,
        realAPY: adjustedRealAPY(base, reward, p.project),
        volume24h: p.volumeUsd1d ?? 0,
        rewardToken: p.rewardTokens?.[0] ?? null,
        poolId: p.pool,
      }
    })
    .sort((a, b) => b.realAPY - a.realAPY)

  if (pools.length > 0) {
    const rows = pools.map((p) => ({ ...p, updatedAt: new Date().toISOString() }))
    const { error: upsertErr } = await supabaseAdmin
      .from('LPPool')
      .upsert(rows, { onConflict: 'protocol,chain,pair' })
    if (upsertErr) errors['upsert'] = upsertErr.message
  }

  return { pools, errors }
}

export async function getLPPools(chain?: string): Promise<LPPool[]> {
  let q = supabaseAdmin
    .from('LPPool')
    .select('*')
    .order('realAPY', { ascending: false })
    .limit(80)

  if (chain) q = q.eq('chain', chain)

  const { data } = await q
  return (data ?? []) as LPPool[]
}
