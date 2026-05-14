/**
 * Flash Loan Arbitrage Scanner - Base Chain
 */

const BASE_TOKENS: Record<string, { address: string; symbol: string; type: 'stable' | 'lst' | 'volatile' }> = {
  USDC:  { address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', symbol: 'USDC',  type: 'stable' },
  USDbC: { address: '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca', symbol: 'USDbC', type: 'stable' },
  USDT:  { address: '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2', symbol: 'USDT',  type: 'stable' },
  DAI:   { address: '0x50c5725949a6f0c72e6c4a641f24049a917db0cb', symbol: 'DAI',   type: 'stable' },
  WETH:  { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH',  type: 'volatile' },
  cbETH: { address: '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22', symbol: 'cbETH', type: 'lst' },
  weETH: { address: '0x04c0599a5a08c8af1f776801855a2c0f6f2586c2', symbol: 'weETH', type: 'lst' },
  rETH:  { address: '0xb6fe221fe9eec5f639e95a61e9d44e0b35771910', symbol: 'rETH',  type: 'lst' },
  AERO:  { address: '0x940181a94a35a4569e4529a3cdfb74bc389882d0', symbol: 'AERO',  type: 'volatile' },
  cbBTC: { address: '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf', symbol: 'cbBTC', type: 'volatile' },
}

const BASE_DEXES: Record<string, { name: string; feeBp: number }> = {
  'aerodrome':    { name: 'Aerodrome',     feeBp: 1   },
  'aerodromev2':  { name: 'Aerodrome V2',  feeBp: 1   },
  'baseswap':     { name: 'BaseSwap',       feeBp: 3   },
  'uniswap':      { name: 'Uniswap V3',     feeBp: 3   },
  'uniswapv4':    { name: 'Uniswap V4',     feeBp: 3   },
  'sushiswap':    { name: 'SushiSwap',      feeBp: 3   },
  'pancakeswap':  { name: 'PancakeSwap',    feeBp: 2   },
  'pancakeswapv3':{ name: 'PancakeSwap V3', feeBp: 2   },
  'quickswap':    { name: 'QuickSwap',      feeBp: 3   },
  'alien-base':   { name: 'Alien Base',     feeBp: 3   },
  'shark-swap':   { name: 'SharkSwap',      feeBp: 5   },
  'solidlycom':   { name: 'Solidly',        feeBp: 3   },
  'iziswap':      { name: 'iZiSwap',        feeBp: 3   },
  'swapbased':    { name: 'SwapBased',      feeBp: 5   },
  'curve':        { name: 'Curve',          feeBp: 0.5 },
  'balancer':     { name: 'Balancer',       feeBp: 1   },
  'velocimeter':  { name: 'Velocimeter',    feeBp: 3   },
  'equalizer':    { name: 'Equalizer',      feeBp: 3   },
  'dackieswap':   { name: 'DackieSwap',     feeBp: 5   },
}

function getDexInfo(dexId: string): { name: string; feeBp: number } | null {
  const d = BASE_DEXES[dexId.toLowerCase()]
  if (d) return d
  if (dexId.startsWith('0x')) return { name: `DEX ${dexId.slice(0, 8)}...`, feeBp: 5 }
  return null
}

const AAVE_FEE_BP = 5
const BASE_GAS_USD = 0.05
const MIN_LIQUIDITY_USD = 5000
const MAX_SPREAD_BP = 200
const FLASH_LOAN_CAPITAL = 10000

interface DexPair {
  chainId: string
  dexId: string
  url: string
  pairAddress: string
  baseToken: { address: string; name: string; symbol: string }
  quoteToken: { address: string; name: string; symbol: string }
  priceNative: string
  priceUsd: string | null
  liquidity?: { usd: number; base: number; quote: number }
}

interface DexResponse { pairs?: DexPair[] }

export interface FlashLoanOpportunity {
  id: string; pair: string; buyDex: string; sellDex: string
  grossSpreadBp: number; aaveFeeBp: number; gasCostUsd: number
  slippageBp: number; dexFeesBp: number; netEdgeBp: number
  capital: number; estimatedProfitUsd: number; chain: string; timestamp: string
}

export interface FlashLoanScanResult {
  opportunities: FlashLoanOpportunity[]
  scannedAt: string; totalScanned: number
  profitableCount: number; bestEdgeBp: number
}

function low(addr: string): string { return addr.toLowerCase() }

function pairKey(addrA: string, addrB: string): string {
  const a = low(addrA); const b = low(addrB)
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

function estimateSlippageBp(type: 'stable' | 'lst' | 'volatile', liq: number): number {
  const base = type === 'stable' ? 1 : type === 'lst' ? 3 : 5
  if (liq > 500_000) return base * 0.5
  if (liq > 100_000) return base
  if (liq > 50_000) return base * 1.5
  if (liq > 10_000) return base * 2.5
  return base * 4
}

function getPairType(a: 'stable' | 'lst' | 'volatile', b: 'stable' | 'lst' | 'volatile'): 'stable' | 'lst' | 'volatile' {
  if (a === 'stable' && b === 'stable') return 'stable'
  if (a === 'lst' || b === 'lst') return 'lst'
  return 'volatile'
}

function tokenMeta(addr: string) {
  const a = low(addr)
  for (const t of Object.values(BASE_TOKENS)) {
    if (low(t.address) === a) return t
  }
  return null
}

export async function scanFlashLoanOpportunities(): Promise<FlashLoanScanResult> {
  const timestamp = new Date().toISOString()
  const allPairs: DexPair[] = []
  const tokenAddresses = Object.values(BASE_TOKENS).map(t => t.address)

  for (let i = 0; i < tokenAddresses.length; i += 2) {
    const batch = tokenAddresses.slice(i, i + 2)
    const url = `https://api.dexscreener.com/latest/dex/tokens/${batch.join(',')}`
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store' as RequestCache,
      })
      if (!res.ok) { console.warn(`DexScreener ${res.status} for ${batch.join(',')}`); continue }
      const data: DexResponse = await res.json()
      allPairs.push(...(data.pairs ?? []).filter(p => p.chainId === 'base'))
      if (i + 2 < tokenAddresses.length) await new Promise(r => setTimeout(r, 350))
    } catch (err) { console.warn(`DexScreener fetch failed:`, err) }
  }

  const grouped = new Map<string, DexPair[]>()
  for (const p of allPairs) {
    const liq = p.liquidity?.usd ?? 0
    if (liq < MIN_LIQUIDITY_USD) continue
    if (!getDexInfo(p.dexId)) continue
    const key = pairKey(p.baseToken.address, p.quoteToken.address)
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(p)
  }

  const opportunities: FlashLoanOpportunity[] = []

  for (const [key, pairs] of Array.from(grouped.entries())) {
    if (pairs.length < 2) continue
    const [addrA, addrB] = key.split('-')
    const metaA = tokenMeta(addrA); const metaB = tokenMeta(addrB)
    const pairType = getPairType(metaA?.type ?? 'volatile', metaB?.type ?? 'volatile')
    const pairLabel = `${metaA?.symbol ?? addrA.slice(0, 6)}/${metaB?.symbol ?? addrB.slice(0, 6)}`

    const priced: { dex: string; dexName: string; normalizedPrice: number; liquidity: number; feeBp: number }[] = []
    for (const p of pairs) {
      const baseAddr = low(p.baseToken.address); const quoteAddr = low(p.quoteToken.address)
      const pn = parseFloat(p.priceNative)
      if (isNaN(pn) || pn <= 0) continue
      let np = baseAddr < quoteAddr ? pn : 1 / pn
      if (isNaN(np) || np <= 0) continue
      const dexInfo = getDexInfo(p.dexId)
      if (!dexInfo) continue
      priced.push({ dex: low(p.dexId), dexName: dexInfo.name, normalizedPrice: np, liquidity: p.liquidity?.usd ?? 0, feeBp: dexInfo.feeBp })
    }
    if (priced.length < 2) continue

    for (let i = 0; i < priced.length; i++) {
      for (let j = i + 1; j < priced.length; j++) {
        const a = priced[i]; const b = priced[j]
        const [buyP, sellP] = a.normalizedPrice < b.normalizedPrice ? [a, b] : [b, a]
        const spreadBp = ((sellP.normalizedPrice - buyP.normalizedPrice) / buyP.normalizedPrice) * 10000
        if (spreadBp <= 0 || spreadBp > MAX_SPREAD_BP) continue
        const avgLiq = (buyP.liquidity + sellP.liquidity) / 2
        const slippage = estimateSlippageBp(pairType, avgLiq) * 2
        const dexFees = buyP.feeBp + sellP.feeBp
        const netEdgeBp = spreadBp - AAVE_FEE_BP - slippage - dexFees
        const capital = Math.min(FLASH_LOAN_CAPITAL, avgLiq * 0.1)
        const profitUsd = (netEdgeBp / 10000) * capital - BASE_GAS_USD
        opportunities.push({
          id: `${pairLabel}-${buyP.dex}-${sellP.dex}-${Date.now()}`,
          pair: pairLabel, buyDex: buyP.dexName, sellDex: sellP.dexName,
          grossSpreadBp: Math.round(spreadBp * 10) / 10, aaveFeeBp: AAVE_FEE_BP,
          gasCostUsd: BASE_GAS_USD, slippageBp: Math.round(slippage * 10) / 10,
          dexFeesBp: Math.round(dexFees * 10) / 10,
          netEdgeBp: Math.round(netEdgeBp * 10) / 10, capital: Math.round(capital),
          estimatedProfitUsd: Math.round(profitUsd * 100) / 100, chain: 'Base', timestamp,
        })
      }
    }
  }

  opportunities.sort((a, b) => b.netEdgeBp - a.netEdgeBp)
  const topOpps = opportunities.slice(0, 20)
  return {
    opportunities: topOpps, scannedAt: timestamp, totalScanned: grouped.size,
    profitableCount: topOpps.filter(o => o.netEdgeBp > 0).length,
    bestEdgeBp: topOpps.length > 0 ? topOpps[0].netEdgeBp : 0,
  }
}
