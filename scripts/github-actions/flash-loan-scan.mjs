#!/usr/bin/env node
/**
 * Flash Loan Arbitrage Scanner — GitHub Actions / cron
 *
 * Estratégia 1: $0 capital, $0 risco
 * Scana oportunidades de flash loan arbitrage na Base chain via DexScreener.
 * Persiste resultados no Supabase.
 *
 * Sem dependências de Next.js ou TypeScript — usa apenas:
 *   - @supabase/supabase-js
 *   - fetch nativo (Node 18+)
 */

import { createClient } from '@supabase/supabase-js'

// ─── Validação de ambiente ─────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Faltam variáveis de ambiente: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── Constantes ───────────────────────────────────────────────────────────

const AAVE_FLASH_LOAN_FEE_PCT = 0.05  // 0.05%
const FLASH_LOAN_GAS_USD = 0.08       // Gas em Base para flash loan completo
const MIN_EDGE_PCT = 0.15             // Edge mínimo após taxas
const MIN_PROFIT_USD = 0.05           // Lucro mínimo para valer a pena

// Tokens na Base
const BASE_TOKENS = {
  WETH:   { address: '0x4200000000000000000000000000000000000006', decimals: 18, symbol: 'WETH'   },
  USDC:   { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6,  symbol: 'USDC'   },
  USDT:   { address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', decimals: 6,  symbol: 'USDT'   },
  DAI:    { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', decimals: 18, symbol: 'DAI'    },
  cbETH:  { address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22', decimals: 18, symbol: 'cbETH'  },
  weETH:  { address: '0x04C0599Ae5A44757c0af6F9eC3b93da8976c150A', decimals: 18, symbol: 'weETH'  },
  rETH:   { address: '0xB6fe221Fe9EeF5aBa221c348bA20A1Bf5e73624c', decimals: 18, symbol: 'rETH'   },
  AERO:   { address: '0x940181a94A35A4569E4529A3DF544B55D777367F', decimals: 18, symbol: 'AERO'   },
}

// Pares prioritários para flash loan
const FLASH_LOAN_PAIRS = [
  { borrow: 'USDC', intermediate: 'DAI',   label: 'USDC→DAI',   loanUSD: 20000 },
  { borrow: 'USDC', intermediate: 'USDT',  label: 'USDC→USDT',  loanUSD: 20000 },
  { borrow: 'USDT', intermediate: 'DAI',   label: 'USDT→DAI',   loanUSD: 20000 },
  { borrow: 'WETH', intermediate: 'cbETH', label: 'WETH→cbETH', loanUSD: 10000 },
  { borrow: 'WETH', intermediate: 'weETH', label: 'WETH→weETH', loanUSD: 8000  },
  { borrow: 'WETH', intermediate: 'rETH',  label: 'WETH→rETH',  loanUSD: 8000  },
  { borrow: 'cbETH', intermediate: 'weETH', label: 'cbETH→weETH', loanUSD: 8000 },
  { borrow: 'cbETH', intermediate: 'rETH',  label: 'cbETH→rETH',  loanUSD: 8000 },
  { borrow: 'WETH', intermediate: 'AERO',  label: 'WETH→AERO',  loanUSD: 3000  },
  { borrow: 'USDC', intermediate: 'AERO',  label: 'USDC→AERO',  loanUSD: 3000  },
  { borrow: 'USDC', intermediate: 'WETH',  label: 'USDC→WETH',  loanUSD: 10000 },
]

// DEXes aceites na Base
const ACCEPTED_DEX_IDS = new Set([
  'aerodrome', 'aerodrome-v2', 'aerodrome-cl',
  'uniswap', 'uniswap-v3',
  'sushiswap', 'sushiswap-v3',
  'baseswap',
])

// ─── DexScreener ───────────────────────────────────────────────────────────

async function safeFetch(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res
}

async function fetchBasePairs(tokenA, tokenB) {
  const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenA},${tokenB}`
  const res = await safeFetch(url)
  const json = await res.json()
  const pairs = json.pairs ?? []

  const addrALow = tokenA.toLowerCase()
  const addrBLow = tokenB.toLowerCase()

  return pairs.filter(p => {
    if (p.chainId !== 'base') return false
    if (!ACCEPTED_DEX_IDS.has(p.dexId)) return false
    if ((p.liquidity?.usd ?? 0) < 5000) return false
    const base = p.baseToken.address.toLowerCase()
    const quote = p.quoteToken.address.toLowerCase()
    return (base === addrALow && quote === addrBLow) || (base === addrBLow && quote === addrALow)
  })
}

// ─── Cálculos ──────────────────────────────────────────────────────────────

function estimateSlippage(liquidityUSD, tradeSizeUSD) {
  const impactRatio = tradeSizeUSD / Math.max(liquidityUSD, 1000)
  return Math.min(impactRatio * 100 * 2, 5.0)
}

function deduplicateByDex(pairs) {
  const byDex = new Map()
  for (const p of pairs) {
    const existing = byDex.get(p.dexId)
    if (!existing || (p.liquidity?.usd ?? 0) > (existing.liquidity?.usd ?? 0)) {
      byDex.set(p.dexId, p)
    }
  }
  return byDex
}

// ─── Scanner ───────────────────────────────────────────────────────────────

async function scanFlashLoanOpportunities() {
  const opportunities = []
  let totalPairs = 0
  let dexCalls = 0

  for (const pair of FLASH_LOAN_PAIRS) {
    const tokenA = BASE_TOKENS[pair.borrow]
    const tokenB = BASE_TOKENS[pair.intermediate]
    if (!tokenA || !tokenB) continue

    let dexPairs
    try {
      dexPairs = await fetchBasePairs(tokenA.address, tokenB.address)
      dexCalls++
    } catch (err) {
      console.warn(`  ⚠️  ${pair.label}: ${err.message}`)
      continue
    }

    totalPairs += dexPairs.length
    const byDex = deduplicateByDex(dexPairs)

    if (byDex.size < 2) continue

    const loanAmountUSD = pair.loanUSD
    const entries = Array.from(byDex.entries())

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const [dexIdA, dexPairA] = entries[i]
        const [dexIdB, dexPairB] = entries[j]

        const baseIsBorrowA = dexPairA.baseToken.address.toLowerCase() === tokenA.address.toLowerCase()
        const baseIsBorrowB = dexPairB.baseToken.address.toLowerCase() === tokenA.address.toLowerCase()

        const pNA = parseFloat(dexPairA.priceNative)
        const pNB = parseFloat(dexPairB.priceNative)
        if (!isFinite(pNA) || !isFinite(pNB) || pNA <= 0 || pNB <= 0) continue

        const priceA = baseIsBorrowA ? (1 / pNA) : pNA
        const priceB = baseIsBorrowB ? (1 / pNB) : pNB
        if (!isFinite(priceA) || !isFinite(priceB) || priceA <= 0 || priceB <= 0) continue

        const [dexBuy, dexSell, priceBuy, priceSell] = priceA < priceB
          ? [dexIdA, dexIdB, priceA, priceB]
          : [dexIdB, dexIdA, priceB, priceA]

        const spreadPct = ((priceSell - priceBuy) / priceBuy) * 100
        if (spreadPct <= 0) continue

        const aaveFeeUSD = loanAmountUSD * (AAVE_FLASH_LOAN_FEE_PCT / 100)
        const minLiquidity = Math.min(dexPairA.liquidity?.usd ?? 0, dexPairB.liquidity?.usd ?? 0)
        const slippagePct = estimateSlippage(minLiquidity, loanAmountUSD)

        // DEX fees: 0.05% buy + 0.05% sell
        const totalDexFeePct = 0.10
        const totalCostsPct = AAVE_FLASH_LOAN_FEE_PCT + slippagePct + totalDexFeePct
        const netEdgePct = spreadPct - totalCostsPct
        const netProfitUSD = (netEdgePct / 100) * loanAmountUSD - FLASH_LOAN_GAS_USD

        if (netEdgePct < MIN_EDGE_PCT || netProfitUSD < MIN_PROFIT_USD) continue

        const confidence = minLiquidity > 100000 && spreadPct > 0.5 ? 'HIGH'
          : minLiquidity > 30000 && spreadPct > 0.3 ? 'MEDIUM' : 'LOW'

        opportunities.push({
          borrowToken: pair.borrow,
          intermediateToken: pair.intermediate,
          dexBuy,
          dexSell,
          spreadPct: +spreadPct.toFixed(4),
          loanAmountUSD,
          aaveFeeUSD: +aaveFeeUSD.toFixed(2),
          gasCostUSD: FLASH_LOAN_GAS_USD,
          slippageEstPct: +slippagePct.toFixed(3),
          netEdgePct: +netEdgePct.toFixed(4),
          netProfitUSD: +netProfitUSD.toFixed(4),
          confidence,
          status: 'DETECTED',
        })
      }
    }
  }

  opportunities.sort((a, b) => b.netProfitUSD - a.netProfitUSD)
  return { opportunities, totalPairs, dexCalls }
}

// ─── Paper Trading ─────────────────────────────────────────────────────────

async function createPaperTrades(opportunities) {
  if (!opportunities || opportunities.length === 0) return 0

  const mevDiscount = 0.7
  const rows = opportunities.slice(0, 10).map(o => ({
    ...o,
    netProfitUSD: o.netProfitUSD,
    simulatedProfitUSD: +(o.netProfitUSD * mevDiscount).toFixed(4),
    status: 'detected',
  }))

  const { error } = await supabase.from('FlashLoanPaperTrade').insert(rows)
  if (error) {
    console.warn(`  ⚠️  Paper trade insert falhou (${error.code}): ${error.message}`)
    return 0
  }
  return rows.length
}

async function expireOldTrades() {
  const cutoff = new Date(Date.now() - 5 * 60_000).toISOString()
  const { data, error } = await supabase
    .from('FlashLoanPaperTrade')
    .update({ status: 'expired', expiredAt: new Date().toISOString() })
    .eq('status', 'detected')
    .lt('detectedAt', cutoff)

  if (error) console.warn(`  ⚠️  Expire trades error: ${error.message}`)
  return data?.length ?? 0
}

// ─── Métricas ──────────────────────────────────────────────────────────────

async function updateDailyMetrics(opportunities) {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const profitable = opportunities.filter(o => o.netProfitUSD > MIN_PROFIT_USD)
  const avgEdge = opportunities.length > 0
    ? opportunities.reduce((s, o) => s + o.netEdgePct, 0) / opportunities.length
    : 0
  const avgProfit = opportunities.length > 0
    ? opportunities.reduce((s, o) => s + o.netProfitUSD, 0) / opportunities.length
    : 0
  const bestProfit = opportunities.length > 0 ? opportunities[0].netProfitUSD : 0

  const pairCount = {}
  for (const o of opportunities) {
    const key = `${o.borrowToken}→${o.intermediateToken}`
    pairCount[key] = (pairCount[key] ?? 0) + 1
  }
  const topPair = Object.entries(pairCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  const dexComboCount = {}
  for (const o of opportunities) {
    const key = `${o.dexBuy}→${o.dexSell}`
    dexComboCount[key] = (dexComboCount[key] ?? 0) + 1
  }
  const topDexCombo = Object.entries(dexComboCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  const { error } = await supabase.from('FlashLoanDailyMetrics').upsert({
    date: today.toISOString(),
    opportunitiesDetected: opportunities.length,
    profitableDetected: profitable.length,
    avgNetEdgePct: +avgEdge.toFixed(4),
    avgProfitUSD: +avgProfit.toFixed(4),
    bestProfitUSD: +bestProfit.toFixed(4),
    topPair,
    topDexCombo,
  }, { onConflict: 'date' })

  if (error) console.warn(`  ⚠️  Metrics upsert error: ${error.message}`)
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const start = Date.now()
  console.log(`\n[${new Date().toISOString()}] ━━━ Flash Loan Scanner — Base Chain ━━━`)
  console.log(`  Estratégia: $0 capital | $0 risco | Gas ≈ $0.08`)

  try {
    // 1. Scan oportunidades
    console.log('  📡 Buscando preços em DexScreener (Base)...')
    const { opportunities, totalPairs, dexCalls } = await scanFlashLoanOpportunities()
    const profitable = opportunities.filter(o => o.netProfitUSD > MIN_PROFIT_USD)

    console.log(`  ✅ ${opportunities.length} oportunidades | ${profitable.length} lucrativas | ${totalPairs} pares | ${dexCalls} chamadas`)

    if (profitable.length > 0) {
      console.log('  💰 Top oportunidades:')
      profitable.slice(0, 5).forEach(o => console.log(
        `    ${o.borrowToken}→${o.intermediateToken} ${o.dexBuy}→${o.dexSell} ` +
        `spread=${o.spreadPct.toFixed(2)}% edge=${o.netEdgePct.toFixed(2)}% ` +
        `profit=$${o.netProfitUSD.toFixed(2)} loan=$${o.loanAmountUSD}`
      ))
    }

    // 2. Persistir no Supabase
    if (opportunities.length > 0) {
      const rows = opportunities.map(o => ({
        borrowToken: o.borrowToken,
        intermediateToken: o.intermediateToken,
        dexBuy: o.dexBuy,
        dexSell: o.dexSell,
        spreadPct: o.spreadPct,
        loanAmountUSD: o.loanAmountUSD,
        aaveFeeUSD: o.aaveFeeUSD,
        gasCostUSD: o.gasCostUSD,
        slippageEstPct: o.slippageEstPct,
        netEdgePct: o.netEdgePct,
        netProfitUSD: o.netProfitUSD,
        confidence: o.confidence,
        status: o.status,
      }))

      const { error } = await supabase.from('FlashLoanOpportunity').insert(rows)
      if (error) {
        if (error.code === '42P01') {
          console.warn('  ⚠️  Tabela FlashLoanOpportunity não encontrada!')
          console.warn('     Solução: Supabase Dashboard → SQL Editor → flash_loan_tables.sql')
        } else {
          console.warn(`  ⚠️  Insert falhou (${error.code}): ${error.message}`)
        }
      } else {
        console.log(`  💾 ${rows.length} oportunidades persistidas`)
      }
    }

    // 3. Paper trades
    if (profitable.length > 0) {
      const tradesCreated = await createPaperTrades(profitable)
      if (tradesCreated > 0) console.log(`  📝 ${tradesCreated} paper trades criados`)
    }

    // 4. Expirar trades antigos
    const expired = await expireOldTrades()
    if (expired > 0) console.log(`  ⏰ ${expired} paper trades expirados`)

    // 5. Métricas diárias
    await updateDailyMetrics(opportunities)

    const elapsed = Date.now() - start
    console.log(`\n  ✅ Concluído em ${elapsed}ms`)
    console.log(`  [${new Date().toISOString()}] ━━━ Fim ━━━\n`)
    process.exit(0)

  } catch (err) {
    console.error(`\n  ❌ Erro fatal:`, err.message)
    console.error(err.stack)
    process.exit(1)
  }
}

main()
