import { safeFetch } from '@/lib/utils'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAirdrop, analyzeOpportunity } from './ai-advisor'

interface DefiLlamaProtocol {
  name: string
  slug: string
  symbol: string | null
  chain: string
  chains: string[]
  tvl: number
  category: string
  url: string
  twitter: string
}

export interface AirdropCandidate {
  id?: string
  protocol: string
  chain: string
  tvlUsd: number
  hasToken: boolean
  tier: string
  confidenceScore: number
  estimatedValueMin: number
  estimatedValueMax: number
  probability: number
  category: string
  website: string
  twitter: string
  aiAnalysis?: string
  updatedAt?: string
}

const PRIORITY_CHAINS = ['Base', 'Arbitrum', 'Optimism', 'Ethereum', 'Polygon']
const MIN_TVL = 1_000_000

// Tier value ranges USD (min, max)
const TIER_VALUES: Record<string, [number, number, number]> = {
  S: [1000, 50000, 0.3],
  A: [200,  5000,  0.6],
  B: [50,   500,   0.5],
  C: [10,   100,   0.3],
  D: [0,    0,     0],
}

function getTier(tvl: number): string {
  if (tvl >= 1_000_000_000) return 'S'
  if (tvl >= 100_000_000)   return 'A'
  if (tvl >= 10_000_000)    return 'B'
  if (tvl >= MIN_TVL)       return 'C'
  return 'D'
}

function hasNoToken(symbol: string | null): boolean {
  if (!symbol) return true
  const s = symbol.trim()
  return s === '' || s === '-' || s === '—' || s.toLowerCase() === 'null'
}

function getBestChain(protocol: DefiLlamaProtocol): string {
  const all = Array.isArray(protocol.chains) ? protocol.chains : [protocol.chain]
  return PRIORITY_CHAINS.find((c) => all.includes(c)) ?? protocol.chain ?? 'Ethereum'
}

export async function scanAirdropCandidates(): Promise<{
  candidates: AirdropCandidate[]
  errors: Record<string, string>
}> {
  const errors: Record<string, string> = {}

  const res = await safeFetch('https://api.llama.fi/protocols').catch(() => null)
  if (!res?.ok) {
    errors['defillama'] = 'Failed to fetch protocols'
    return { candidates: [], errors }
  }

  const protocols: DefiLlamaProtocol[] = await res.json().catch(() => [])

  const candidates: AirdropCandidate[] = protocols
    .filter((p) =>
      hasNoToken(p.symbol) &&
      p.tvl >= MIN_TVL &&
      (Array.isArray(p.chains) ? p.chains : [p.chain]).some((c) => PRIORITY_CHAINS.includes(c))
    )
    .slice(0, 150)
    .map((p) => {
      const tier = getTier(p.tvl)
      const [min, max, prob] = TIER_VALUES[tier] ?? [0, 0, 0]
      return {
        protocol: p.name,
        chain: getBestChain(p),
        tvlUsd: p.tvl,
        hasToken: false,
        tier,
        confidenceScore: tier === 'A' ? 70 : tier === 'B' ? 55 : tier === 'S' ? 60 : 40,
        estimatedValueMin: min,
        estimatedValueMax: max,
        probability: prob,
        category: p.category ?? 'Unknown',
        website: p.url ?? '',
        twitter: p.twitter ? `https://twitter.com/${p.twitter}` : '',
      }
    })
    .filter((c) => c.tier !== 'D')

  // Run AI analysis on top Tier S/A candidates (max 8 to limit API cost)
  const toAnalyze = candidates.filter((c) => c.tier === 'S' || c.tier === 'A').slice(0, 8)
  if (toAnalyze.length > 0) {
    const aiResults = await Promise.allSettled(
      toAnalyze.map(async (c) => {
        const [verify, analysis] = await Promise.all([
          verifyAirdrop(c.protocol, c.tvlUsd, c.chain),
          analyzeOpportunity({ protocol: c.protocol, chain: c.chain, apy: 0, tvl: c.tvlUsd, type: 'AIRDROP' }),
        ])
        return { protocol: c.protocol, chain: c.chain, verify, analysis }
      })
    )

    for (const result of aiResults) {
      if (result.status !== 'fulfilled') continue
      const { protocol, chain, verify, analysis } = result.value
      const idx = candidates.findIndex((c) => c.protocol === protocol && c.chain === chain)
      if (idx === -1) continue
      candidates[idx].confidenceScore = Math.round((verify.confidenceScore + analysis.score) / 2)
      candidates[idx].aiAnalysis = JSON.stringify({
        recommendation: analysis.recommendation,
        reasoning: analysis.reasoning,
        risks: analysis.risks,
        isLegit: verify.isLegit,
        verifyAnalysis: verify.analysis,
        score: analysis.score,
      })
    }
  }

  if (candidates.length > 0) {
    const rows = candidates.map((c) => ({ ...c, updatedAt: new Date().toISOString() }))
    const { error: upsertErr } = await supabaseAdmin
      .from('AirdropCandidate')
      .upsert(rows, { onConflict: 'protocol,chain' })
    if (upsertErr) errors['upsert'] = upsertErr.message
  }

  return { candidates, errors }
}

export async function getAirdropCandidates(tier?: string): Promise<AirdropCandidate[]> {
  let q = supabaseAdmin
    .from('AirdropCandidate')
    .select('*')
    .order('tvlUsd', { ascending: false })
    .limit(80)

  if (tier) q = q.eq('tier', tier)

  const { data } = await q
  return (data ?? []) as AirdropCandidate[]
}
