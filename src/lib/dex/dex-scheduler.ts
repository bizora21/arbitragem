import { fetchAllDEXPrices } from './price-monitor'
import { detectOpportunities, updateDailyMetrics } from './arbitrage-detector'

declare const globalThis: {
  __dexSchedulerRunning?: boolean
} & typeof global

export function startDEXScheduler() {
  if (globalThis.__dexSchedulerRunning) return
  globalThis.__dexSchedulerRunning = true

  console.log('[dex-scheduler] Iniciado — monitorando DEX prices every 60s')

  // Primeira execução imediata
  runCycle().catch(err => console.error('[dex-scheduler] erro na primeira execução:', err))

  // A cada 60 segundos: fetch preços + detectar oportunidades
  // (60s porque chamadas RPC on-chain são lentas — ~5-30s por chain)
  setInterval(async () => {
    await runCycle().catch(err => console.error('[dex-scheduler] erro no ciclo:', err))
  }, 60_000)

  // A cada hora: actualizar métricas diárias
  setInterval(async () => {
    await updateDailyMetrics().catch(err => console.error('[dex-scheduler] erro em métricas:', err))
  }, 3_600_000)
}

async function runCycle() {
  const start = Date.now()

  const prices = await fetchAllDEXPrices()
  if (prices.length === 0) {
    console.warn('[dex-scheduler] Sem preços — DexScreener pode estar indisponível ou liquidez insuficiente')
    return
  }

  const opps = await detectOpportunities(prices)

  const elapsed = Date.now() - start
  const positive = opps.filter(o => o.edgeNet > 0.5)

  console.log(
    `[dex-scheduler] ${prices.length} preços | ${opps.length} oportunidades` +
    (positive.length > 0 ? ` | 🔔 ${positive.length} com edge > 0.5%` : '') +
    ` | ${elapsed}ms`
  )

  if (positive.length > 0) {
    positive.forEach(o => console.log(
      `  🟢 ${o.tokenPair} ${o.chain} ${o.dexA}→${o.dexB}` +
      ` spread=${o.spreadPct.toFixed(3)}%` +
      ` edge=${o.edgeNet.toFixed(3)}%` +
      ` profit≈$${o.profitUSD100.toFixed(2)}/100USD`
    ))
  }
}

export function stopDEXScheduler() {
  globalThis.__dexSchedulerRunning = false
}

export function getDEXSchedulerStatus() {
  return { running: globalThis.__dexSchedulerRunning ?? false }
}
