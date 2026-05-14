import { getFundingSnapshot } from './funding-monitor'
import { getDepegStatus } from './depeg-monitor'
import { getYieldRates } from './yield-monitor'
import { getCexDexSpreads } from './spread-monitor'
import { updatePaperTrades, closeExpiredTrades, createPaperTrade } from './paper-trading'
import { updateAllScores } from './confidence-scorer'
import { generatePredictiveAlerts } from './predictive-engine'
import { scanAirdropCandidates } from './airdrop-tracker'
import { scanLPPools } from './lp-scanner'
import { scanFlashLoanOpportunities } from './flash-loan-scanner'

let running = false
const handles: ReturnType<typeof setInterval>[] = []

async function flashLoanCycle() {
  await scanFlashLoanOpportunities()
}

async function fundingCycle() {
  const snapshot = await getFundingSnapshot()
  // Auto-create paper trades for top opportunities (netEdge > 0, not already tracked)
  const topRows = snapshot.rows
    .filter((r) => r.netEdge !== null && r.netEdge > 0)
    .slice(0, 3)

  for (const row of topRows) {
    const exchanges = (['OKX', 'BINANCE', 'BYBIT'] as const)
      .filter((ex) => row[ex] !== null)
      .sort((a, b) => (row[b] ?? 0) - (row[a] ?? 0))

    if (exchanges.length < 2) continue

    await createPaperTrade({
      strategy: 'FUNDING',
      symbol: row.symbol,
      longExchange: exchanges[exchanges.length - 1],
      shortExchange: exchanges[0],
      entryRate: row.bestDiff,
    }).catch(() => {})
  }
}

async function runSafely(name: string, fn: () => Promise<unknown>) {
  const start = Date.now()
  try {
    await fn()
    console.log(`[scheduler:${name}] ok (${Date.now() - start}ms)`)
  } catch (err) {
    console.error(`[scheduler:${name}] error:`, err instanceof Error ? err.message : String(err))
  }
}

export function startScheduler() {
  if (running) return
  running = true

  // Flash Loan: every 60 seconds — oportunidades são efémeras
  runSafely('flash-loan', () => flashLoanCycle())
  handles.push(setInterval(() => runSafely('flash-loan', () => flashLoanCycle()), 60_000))

  // Funding: every 5 minutes — auto-creates paper trades for top opportunities
  runSafely('funding', () => fundingCycle())
  handles.push(setInterval(() => runSafely('funding', () => fundingCycle()), 5 * 60_000))

  // Depeg: every 30 seconds — stablecoin depegs can be fast-moving
  runSafely('depeg', getDepegStatus)
  handles.push(setInterval(() => runSafely('depeg', getDepegStatus), 30_000))

  // Yield: every 60 minutes — APYs change over hours/days
  runSafely('yield', getYieldRates)
  handles.push(setInterval(() => runSafely('yield', getYieldRates), 60 * 60_000))

  // CEX-DEX Spread: every 2 minutes — price gaps can close quickly
  runSafely('spread', getCexDexSpreads)
  handles.push(setInterval(() => runSafely('spread', getCexDexSpreads), 2 * 60_000))

  // Paper trades: update PnL + close expired every 10 minutes
  handles.push(setInterval(() => runSafely('paper', async () => {
    await updatePaperTrades()
    await closeExpiredTrades()
    await updateAllScores()
  }), 10 * 60_000))

  // Predictive alerts: run after every depeg + spread cycle
  handles.push(setInterval(() => runSafely('predictive', generatePredictiveAlerts), 5 * 60_000))

  // Airdrop candidates: every 2 hours — protocols change slowly
  runSafely('airdrops', scanAirdropCandidates)
  handles.push(setInterval(() => runSafely('airdrops', scanAirdropCandidates), 2 * 60 * 60_000))

  // LP pools: every 2 hours — APYs update over hours
  runSafely('lp-pools', scanLPPools)
  handles.push(setInterval(() => runSafely('lp-pools', scanLPPools), 2 * 60 * 60_000))

  console.log('[scheduler] started — flash-loan(60s) funding(5m) depeg(30s) yield(60m) spread(2m) airdrops(2h) lp(2h)')
}

export function stopScheduler() {
  for (const h of handles) clearInterval(h)
  handles.length = 0
  running = false
  console.log('[scheduler] stopped')
}

export function isRunning() {
  return running
}
