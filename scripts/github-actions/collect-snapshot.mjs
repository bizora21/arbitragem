#!/usr/bin/env node
/**
 * Standalone snapshot collector — GitHub Actions / VPS / cron
 * Sem dependências de Next.js, TypeScript ou Prisma.
 * Usa apenas: @supabase/supabase-js (já em node_modules) + fetch nativo (Node 18+)
 */

import { createClient } from '@supabase/supabase-js'

// ─── Validação de ambiente ─────────────────────────────────────────────────
const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Faltam variáveis de ambiente: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── Constantes ───────────────────────────────────────────────────────────
const PERP_MAKER_FEES = { OKX: 0.0002, BINANCE: 0.0002, BYBIT: 0.0001 }
const EXCHANGE_PAIRS  = [['OKX', 'BINANCE'], ['OKX', 'BYBIT'], ['BINANCE', 'BYBIT']]
const MAX_TRACKED     = 50

function estimateSlippage(volumeUSD) {
  if (volumeUSD > 10_000_000) return 0.0001
  if (volumeUSD >  1_000_000) return 0.0003
  return 0.0005
}

function estimateFees(exA, exB) {
  const entry = PERP_MAKER_FEES[exA] + PERP_MAKER_FEES[exB]
  const exit_ = PERP_MAKER_FEES[exA] + PERP_MAKER_FEES[exB]
  return entry + exit_
}

function normalizeSymbol(symbol, exchange) {
  if (exchange === 'OKX') return symbol.replace('-SWAP', '').replace('-', '')
  return symbol.toUpperCase()
}

// ─── APIs das exchanges ────────────────────────────────────────────────────
async function safeFetch(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}`)
  return res
}

async function fetchBinanceRates() {
  const [premiumRes, tickerRes] = await Promise.allSettled([
    safeFetch('https://fapi.binance.com/fapi/v1/premiumIndex'),
    safeFetch('https://fapi.binance.com/fapi/v1/ticker/24hr'),
  ])

  if (premiumRes.status === 'rejected') throw new Error(`Binance: ${premiumRes.reason}`)
  const premium = await premiumRes.value.json()

  const volumeMap = {}
  if (tickerRes.status === 'fulfilled') {
    const tickers = await tickerRes.value.json()
    for (const t of tickers) volumeMap[t.symbol] = parseFloat(t.quoteVolume) || 0
  }

  return premium
    .filter(i => i.symbol.endsWith('USDT'))
    .map(i => ({
      symbol:       i.symbol,
      exchange:     'BINANCE',
      fundingRate:  parseFloat(i.lastFundingRate),
      volume24hUSD: volumeMap[i.symbol] ?? 0,
    }))
}

async function fetchOKXRates() {
  // /market/tickers?instType=SWAP devolve fundingRate + volume numa única chamada
  const res  = await safeFetch('https://www.okx.com/api/v5/market/tickers?instType=SWAP')
  const json = await res.json()
  if (json.code !== '0') throw new Error(`OKX: ${json.msg}`)

  return json.data
    .filter(i => i.instId.endsWith('-USDT-SWAP') && i.fundingRate !== '')
    .map(i => ({
      symbol:       i.instId,
      exchange:     'OKX',
      fundingRate:  parseFloat(i.fundingRate) || 0,
      // volCcy24h = volume em moeda cotada (USDT para pares USDT-SWAP)
      volume24hUSD: parseFloat(i.volCcy24h) || 0,
    }))
}

async function fetchBybitRates() {
  const res  = await safeFetch('https://api.bybit.com/v5/market/tickers?category=linear')
  const json = await res.json()
  if (json.retCode !== 0) throw new Error(`Bybit: ${json.retMsg}`)

  return json.result.list
    .filter(i => i.symbol.endsWith('USDT') && i.fundingRate !== '')
    .map(i => ({
      symbol:       i.symbol,
      exchange:     'BYBIT',
      fundingRate:  parseFloat(i.fundingRate),
      volume24hUSD: parseFloat(i.turnover24h) || 0,
    }))
}

// ─── Colecta de snapshots ──────────────────────────────────────────────────
async function collectSnapshots() {
  const [binance, okx, bybit] = await Promise.allSettled([
    fetchBinanceRates(),
    fetchOKXRates(),
    fetchBybitRates(),
  ])

  const allRates = []
  if (binance.status === 'fulfilled') allRates.push(...binance.value)
  else console.warn(`⚠️  Binance falhou: ${binance.reason}`)

  if (okx.status === 'fulfilled') allRates.push(...okx.value)
  else console.warn(`⚠️  OKX falhou: ${okx.reason}`)

  if (bybit.status === 'fulfilled') allRates.push(...bybit.value)
  else console.warn(`⚠️  Bybit falhou: ${bybit.reason}`)

  if (allRates.length === 0) throw new Error('Todas as exchanges falharam')

  // Agrupar por símbolo normalizado
  const grouped = {}
  for (const rate of allRates) {
    const sym = normalizeSymbol(rate.symbol, rate.exchange)
    if (!grouped[sym]) grouped[sym] = {}
    grouped[sym][rate.exchange] = rate
  }

  const snapshots = []
  const now = new Date()

  for (const [sym, byExchange] of Object.entries(grouped)) {
    for (const [exA, exB] of EXCHANGE_PAIRS) {
      const rateA = byExchange[exA]
      const rateB = byExchange[exB]
      if (!rateA || !rateB) continue

      const volumeA      = rateA.volume24hUSD
      const volumeB      = rateB.volume24hUSD
      const spreadRaw    = Math.abs(rateA.fundingRate - rateB.fundingRate)
      const feesEstimated = estimateFees(exA, exB)
      const slippageEst  = estimateSlippage(Math.min(volumeA, volumeB))
      const edgeNet      = spreadRaw - feesEstimated - slippageEst

      snapshots.push({
        symbol:        sym,
        exchangeA:     exA,
        exchangeB:     exB,
        fundingRateA:  rateA.fundingRate,
        fundingRateB:  rateB.fundingRate,
        spreadRaw,
        feesEstimated,
        slippageEst,
        edgeNet,
        volumeA24h:    volumeA,
        volumeB24h:    volumeB,
        timestamp:     now.toISOString(),
      })
    }
  }

  if (snapshots.length === 0) return { count: 0, positiveEdge: 0 }

  const { error } = await supabase.from('EdgeSnapshot').insert(snapshots)
  if (error) {
    if (error.code === '42P01') {
      console.warn('⚠️  Tabela EdgeSnapshot não encontrada — as migrations SQL ainda não foram executadas.')
      console.warn('    Solução: Supabase Dashboard → SQL Editor → colar e executar:')
      console.warn('    supabase/migrations/edge_validator_tables.sql')
    } else {
      console.warn(`⚠️  Supabase insert falhou (${error.code}): ${error.message}`)
    }
    console.warn(`    Snapshot gerado com ${snapshots.length} linhas — não persistido.`)
    const positiveEdge = snapshots.filter(s => s.edgeNet > 0).length
    console.warn(`    Resumo: ${snapshots.length} snapshots | ${positiveEdge} com edge positivo`)
    return { count: 0, positiveEdge: 0, grouped: {}, snapshots: [] }
  }

  const positiveEdge = snapshots.filter(s => s.edgeNet > 0).length
  return { count: snapshots.length, positiveEdge, grouped, snapshots }
}

// ─── Tracking de persistência ──────────────────────────────────────────────
async function trackNewOpportunities(snapshots) {
  if (!snapshots || snapshots.length === 0) return 0

  // Conta oportunidades não resolvidas
  const { count, error: countErr } = await supabase
    .from('OpportunityLife')
    .select('*', { count: 'exact', head: true })
    .eq('resolved', false)

  if (countErr) {
    console.warn(`⚠️  OpportunityLife inacessível (${countErr.code}) — tracking ignorado.`)
    return 0
  }

  let available = MAX_TRACKED - (count ?? 0)
  if (available <= 0) return 0

  // Registar oportunidades com edge positivo como novas entradas para tracking
  const positive = snapshots.filter(s => s.edgeNet > 0.0001)
  let tracked = 0

  for (const snap of positive) {
    if (available <= 0) break

    // Verificar se já existe tracking activo para este par
    const { count: existing } = await supabase
      .from('OpportunityLife')
      .select('*', { count: 'exact', head: true })
      .eq('symbol', snap.symbol)
      .eq('exchangeA', snap.exchangeA)
      .eq('exchangeB', snap.exchangeB)
      .eq('resolved', false)

    if ((existing ?? 0) > 0) continue

    await supabase.from('OpportunityLife').insert({
      symbol:         snap.symbol,
      exchangeA:      snap.exchangeA,
      exchangeB:      snap.exchangeB,
      initialSpread:  snap.spreadRaw,
      edgeNetInitial: snap.edgeNet,
      resolved:       false,
    })

    tracked++
    available--
  }

  return tracked
}

async function checkPersistence(grouped) {
  if (!grouped || Object.keys(grouped).length === 0) return 0

  const now = Date.now()

  const { data: pending, error: fetchErr } = await supabase
    .from('OpportunityLife')
    .select('*')
    .eq('resolved', false)
    .limit(MAX_TRACKED)

  if (fetchErr) {
    console.warn(`⚠️  OpportunityLife inacessível (${fetchErr.code}) — verificação de persistência ignorada.`)
    return 0
  }

  if (!pending || pending.length === 0) return 0

  let updated = 0

  for (const opp of pending) {
    const elapsedMs = now - new Date(opp.detectedAt).getTime()

    const ratesForSym = grouped[opp.symbol]
    const rateA = ratesForSym?.[opp.exchangeA]
    const rateB = ratesForSym?.[opp.exchangeB]
    const currentSpread = (rateA && rateB)
      ? Math.abs(rateA.fundingRate - rateB.fundingRate)
      : null

    const updates = {}
    const threshold = opp.initialSpread * 0.5

    if (elapsedMs >= 30_000   && opp.spreadAt30s === null && currentSpread !== null) {
      updates.spreadAt30s = currentSpread
      updates.alive30s    = currentSpread >= threshold
    }
    if (elapsedMs >= 60_000   && opp.spreadAt1m  === null && currentSpread !== null) {
      updates.spreadAt1m = currentSpread
      updates.alive1m    = currentSpread >= threshold
    }
    if (elapsedMs >= 300_000  && opp.spreadAt5m  === null && currentSpread !== null) {
      updates.spreadAt5m  = currentSpread
      updates.alive5m     = currentSpread >= threshold
      updates.edgeNetAt5m = opp.edgeNetInitial * (currentSpread / Math.max(opp.initialSpread, 0.00001))
    }
    if (elapsedMs >= 1_800_000) {
      if (opp.spreadAt30m === null && currentSpread !== null) {
        updates.spreadAt30m = currentSpread
        updates.alive30m    = currentSpread >= threshold
      }
      updates.resolved = true
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from('OpportunityLife').update(updates).eq('id', opp.id)
      updated++
    }
  }

  return updated
}

// ─── Main ─────────────────────────────────────────────────────────────────
async function main() {
  const start = Date.now()
  console.log(`\n[${new Date().toISOString()}] ━━━ Colecta de Snapshot Iniciada ━━━`)

  try {
    // 1. Snapshots
    console.log('📡 A buscar funding rates (Binance + OKX + Bybit)...')
    const { count, positiveEdge, grouped, snapshots } = await collectSnapshots()
    console.log(`✅ ${count} snapshots gravados | ${positiveEdge} com edge positivo`)

    // 2. Tracking de novas oportunidades
    console.log('🔍 A verificar novas oportunidades...')
    const tracked = await trackNewOpportunities(snapshots)
    if (tracked > 0) console.log(`✅ ${tracked} novas oportunidades em tracking`)

    // 3. Verificar persistência das oportunidades existentes
    console.log('⏱️  A verificar persistência...')
    const updated = await checkPersistence(grouped)
    if (updated > 0) console.log(`✅ ${updated} oportunidades actualizadas`)

    const elapsed = Date.now() - start
    console.log(`\n✅ Concluído em ${elapsed}ms`)
    console.log(`[${new Date().toISOString()}] ━━━ Fim ━━━\n`)
    process.exit(0)

  } catch (err) {
    console.error(`\n❌ Erro fatal:`, err.message)
    console.error(err.stack)
    process.exit(1)
  }
}

main()
