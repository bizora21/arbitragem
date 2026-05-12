import { NextResponse } from 'next/server'
import { getYieldRates } from '@/lib/strategies/yield-monitor'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const STALE_AFTER_MS = 60 * 60_000 // 60 minutes — matches scheduler interval

export async function GET() {
  try {
    // Check if DB data is fresh enough
    const { data: latest } = await supabaseAdmin
      .from('YieldRate')
      .select('createdAt')
      .order('createdAt', { ascending: false })
      .limit(1)
      .single()

    const lastUpdate = latest ? new Date(latest.createdAt).getTime() : 0
    const isStale = Date.now() - lastUpdate > STALE_AFTER_MS

    if (isStale) {
      // Re-fetch from DefiLlama (slow, but infrequent)
      const result = await getYieldRates()
      return NextResponse.json(result)
    }

    // Serve from DB (fast)
    const { data: rows, error } = await supabaseAdmin
      .from('YieldRate')
      .select('*')
      .order('apy', { ascending: false })
      .limit(80)

    if (error || !rows || rows.length === 0) {
      // Fallback to live fetch if DB is empty
      const result = await getYieldRates()
      return NextResponse.json(result)
    }

    // Reconstruct YieldPool array from DB rows
    const pools = rows.map((r) => ({
      protocol: r.protocol,
      chain: r.chain,
      asset: r.asset,
      poolSymbol: r.asset,
      apy: r.apy,
      apyBase: r.apy,
      apyReward: 0,
      tvlUsd: r.tvl ?? 0,
      gasCostEstimate: r.gasCostEstimate ?? 0,
      netAPY: r.netAPY ?? r.apy,
      capitalMin: r.capitalMin ?? 1,
    }))

    // Compute bestPerAsset
    const bestPerAsset: Record<string, typeof pools[0]> = {}
    for (const pool of pools) {
      if (!bestPerAsset[pool.asset] || pool.netAPY > bestPerAsset[pool.asset].netAPY) {
        bestPerAsset[pool.asset] = pool
      }
    }

    // Compute rotation opportunities from DB pools
    const TRACKED_ASSETS = ['USDC', 'USDT', 'DAI']
    const opportunities = []
    for (const asset of TRACKED_ASSETS) {
      const assetPools = pools.filter((p) => p.asset === asset).sort((a, b) => b.apy - a.apy)
      for (let i = 0; i < assetPools.length; i++) {
        for (let j = i + 1; j < assetPools.length; j++) {
          const high = assetPools[i]
          const low = assetPools[j]
          const gainPct = high.apy - low.apy
          if (gainPct > 1.0 && high.protocol !== low.protocol) {
            opportunities.push({
              fromProtocol: low.protocol, toProtocol: high.protocol,
              fromChain: low.chain, toChain: high.chain,
              asset, currentApy: low.apy, targetApy: high.apy,
              gainPct, adjustedGainPct: gainPct * 0.8,
            })
          }
        }
      }
    }

    return NextResponse.json({
      pools,
      opportunities,
      bestPerAsset,
      timestamp: latest ? latest.createdAt : new Date().toISOString(),
      fromCache: true,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message, timestamp: new Date().toISOString() }, { status: 500 })
  }
}
