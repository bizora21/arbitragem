import { supabaseAdmin } from '@/lib/supabase'
import { DEXPriceRow } from './price-monitor'

// Gas estimado por chain (USD por swap round-trip = 2 swaps)
const GAS_COST_USD: Record<string, number> = {
  polygon:  0.10,
  arbitrum: 0.30,
  ethereum: 10.0,
  bsc:      0.60,
}

export interface DEXOpportunity {
  tokenPair:    string
  chain:        string
  dexA:         string
  dexB:         string
  priceA:       number
  priceB:       number
  spreadPct:    number
  gasCostUSD:   number
  slippageEst:  number
  totalCostPct: number
  edgeNet:      number
  profitUSD100: number
}

const MIN_EDGE_PCT = 0.10  // só registar oportunidades com edge > 0.1%
const CAPITAL_USD  = 100

export async function detectOpportunities(prices: DEXPriceRow[]): Promise<DEXOpportunity[]> {
  const opportunities: DEXOpportunity[] = []

  // Agrupar por chain + par (só comparamos same-chain)
  const grouped = new Map<string, DEXPriceRow[]>()
  for (const p of prices) {
    const key = `${p.chain}|${p.tokenA}-${p.tokenB}`
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(p)
  }

  for (const [key, dexPrices] of grouped) {
    if (dexPrices.length < 2) continue

    const [chain, tokenPair] = key.split('|')
    const gasCostUSD  = GAS_COST_USD[chain] ?? 1.0
    const gasCostPct  = (gasCostUSD / CAPITAL_USD) * 100

    // Comparar todos os pares de DEX nesta chain
    for (let i = 0; i < dexPrices.length; i++) {
      for (let j = i + 1; j < dexPrices.length; j++) {
        const a = dexPrices[i]
        const b = dexPrices[j]

        // Comprar em A, vender em B
        const spreadBuyA = ((b.priceAtoB - a.priceAtoB) / a.priceAtoB) * 100
        // Comprar em B, vender em A
        const spreadBuyB = ((a.priceAtoB - b.priceAtoB) / b.priceAtoB) * 100

        for (const [spread, dexBuy, dexSell, priceIn, priceOut] of [
          [spreadBuyA, a.dexName, b.dexName, a.priceAtoB, b.priceAtoB],
          [spreadBuyB, b.dexName, a.dexName, b.priceAtoB, a.priceAtoB],
        ] as [number, string, string, number, number][]) {
          if (spread <= 0) continue

          const slippageEst  = Math.max(a.slippage1000, b.slippage1000)
          const totalCostPct = gasCostPct + slippageEst + (a.feeTier + b.feeTier) * 100
          const edgeNet      = spread - totalCostPct
          const profitUSD100 = (edgeNet / 100) * CAPITAL_USD

          if (edgeNet < MIN_EDGE_PCT) continue

          opportunities.push({
            tokenPair,
            chain,
            dexA:         dexBuy,
            dexB:         dexSell,
            priceA:       priceIn,
            priceB:       priceOut,
            spreadPct:    spread,
            gasCostUSD,
            slippageEst,
            totalCostPct,
            edgeNet,
            profitUSD100,
          })
        }
      }
    }
  }

  // Ordenar por edge decrescente
  opportunities.sort((a, b) => b.edgeNet - a.edgeNet)

  // Persistir no Supabase
  if (opportunities.length > 0) {
    const rows = opportunities.map(o => ({
      tokenPair:    o.tokenPair,
      chain:        o.chain,
      dexA:         o.dexA,
      dexB:         o.dexB,
      priceA:       o.priceA,
      priceB:       o.priceB,
      spreadPct:    o.spreadPct,
      gasCostUSD:   o.gasCostUSD,
      slippageEst:  o.slippageEst,
      totalCostPct: o.totalCostPct,
      edgeNet:      o.edgeNet,
      profitUSD100: o.profitUSD100,
      status:       'PENDING',
    }))
    const { error } = await supabaseAdmin.from('DEXArbitrageOpportunity').insert(rows)
    if (error) console.error('[arb-detector] insert error:', error.message)
  }

  return opportunities
}

// Busca oportunidades recentes para o dashboard
export async function getRecentOpportunities(hours = 24, limit = 50) {
  const since = new Date(Date.now() - hours * 3600_000).toISOString()
  const { data, error } = await supabaseAdmin
    .from('DEXArbitrageOpportunity')
    .select('*')
    .gte('createdAt', since)
    .order('edgeNet', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[arb-detector] fetch error:', error.message)
    return []
  }
  return data ?? []
}

// Actualiza métricas diárias
export async function updateDailyMetrics() {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const { data: opps } = await supabaseAdmin
    .from('DEXArbitrageOpportunity')
    .select('edgeNet, tokenPair, chain, dexA')
    .gte('createdAt', today.toISOString())

  if (!opps || opps.length === 0) return

  const avgEdge = opps.reduce((s, o) => s + o.edgeNet, 0) / opps.length

  // top pair/chain/dex por frequência
  const pairCount = opps.reduce((m, o) => { m[o.tokenPair] = (m[o.tokenPair] ?? 0) + 1; return m }, {} as Record<string,number>)
  const chainCount = opps.reduce((m, o) => { m[o.chain] = (m[o.chain] ?? 0) + 1; return m }, {} as Record<string,number>)
  const dexCount  = opps.reduce((m, o) => { m[o.dexA] = (m[o.dexA] ?? 0) + 1; return m }, {} as Record<string,number>)

  const topPair  = Object.entries(pairCount).sort((a,b) => b[1]-a[1])[0]?.[0] ?? null
  const topChain = Object.entries(chainCount).sort((a,b) => b[1]-a[1])[0]?.[0] ?? null
  const topDex   = Object.entries(dexCount).sort((a,b)  => b[1]-a[1])[0]?.[0] ?? null

  await supabaseAdmin.from('DEXDailyMetrics').upsert({
    date:                   today.toISOString(),
    opportunitiesDetected:  opps.length,
    avgEdgeReal:            avgEdge,
    topTokenPair:           topPair,
    topChain,
    topDex,
  }, { onConflict: 'date' })
}
