// Scheduler de background — corre no runtime Node.js.
// Iniciado uma vez via instrumentation.ts; flag global evita duplicação.

import { takeSnapshot } from './snapshot-engine'
import { checkPendingOpportunities, trackOpportunity, getPersistenceStats } from './persistence-tracker'
import { checkPendingRealizations, recordPredictions } from './realization-tracker'
import { evaluateEntry, evaluateExits, getPerformanceStats } from '@/lib/paper-trading/simulator'
import { collectAllFundingRates } from '@/lib/analyzer/opportunity-finder'
import { supabaseAdmin } from '@/lib/supabase'
import { mean } from '@/lib/analysis/stats'

// Estado global do scheduler
const g = globalThis as typeof globalThis & {
  __edgeSchedulerRunning?: boolean
  __edgeLastSnapshot?: string
  __edgeSnapshotsToday?: number
}

export function isRunning(): boolean {
  return g.__edgeSchedulerRunning === true
}

export function getStatus() {
  return {
    running:         g.__edgeSchedulerRunning ?? false,
    snapshotsToday:  g.__edgeSnapshotsToday   ?? 0,
    lastSnapshot:    g.__edgeLastSnapshot      ?? 'nunca',
  }
}

export function startScheduler(): void {
  if (g.__edgeSchedulerRunning) return

  g.__edgeSchedulerRunning = true
  g.__edgeSnapshotsToday   = 0
  g.__edgeLastSnapshot     = 'iniciando...'

  console.log('[scheduler] Edge tracker iniciado')

  // ── Job 1: Snapshot a cada 30s ──────────────────────────────
  setInterval(async () => {
    try {
      const snapshots = await takeSnapshot()
      g.__edgeLastSnapshot  = new Date().toISOString()
      g.__edgeSnapshotsToday = (g.__edgeSnapshotsToday ?? 0) + 1

      // Para cada snapshot com edge positivo, tracking de persistência
      const { rates } = await collectAllFundingRates().catch(() => ({ rates: [] }))
      await recordPredictions(rates)

      // Avaliar entradas de paper trading
      for (const snap of snapshots) {
        if (snap.edgeNet > 0) {
          await evaluateEntry(snap)
          // Rastrear persistência das melhores oportunidades
          if (snap.edgeNet >= 0.0003) {
            await trackOpportunity(
              snap.symbol,
              snap.exchangeA,
              snap.exchangeB,
              snap.spreadRaw,
              snap.edgeNet
            )
          }
        }
      }
    } catch (err) {
      console.error('[scheduler] snapshot error:', err)
    }
  }, 30_000)

  // ── Job 2: Persistence check a cada 10s ─────────────────────
  setInterval(async () => {
    try {
      await checkPendingOpportunities()
    } catch (err) {
      console.error('[scheduler] persistence error:', err)
    }
  }, 10_000)

  // ── Job 3: Paper trading evaluation a cada 1min ──────────────
  setInterval(async () => {
    try {
      await evaluateExits()
    } catch (err) {
      console.error('[scheduler] paper-trading error:', err)
    }
  }, 60_000)

  // ── Job 4: Funding realization check a cada 5min ─────────────
  setInterval(async () => {
    try {
      await checkPendingRealizations()
    } catch (err) {
      console.error('[scheduler] realization error:', err)
    }
  }, 300_000)

  // ── Job 5: Métricas diárias à meia-noite UTC ─────────────────
  scheduleDailyMetrics()
}

export function stopScheduler(): void {
  g.__edgeSchedulerRunning = false
  // Nota: clearInterval não é possível sem guardar os IDs.
  // Para parar completamente, reiniciar o servidor.
  console.log('[scheduler] Edge tracker marcado para parar (activo até restart)')
}

// Agenda execução das métricas diárias próximo da meia-noite UTC
function scheduleDailyMetrics() {
  const now      = new Date()
  const midnight = new Date(now)
  midnight.setUTCHours(24, 0, 30, 0)  // +30s de margem
  const delay = midnight.getTime() - now.getTime()

  setTimeout(async () => {
    await computeDailyMetrics()
    // Re-agendar para o dia seguinte
    setInterval(computeDailyMetrics, 86_400_000)
  }, delay)
}

async function computeDailyMetrics(): Promise<void> {
  try {
    const [persistence, paperStats] = await Promise.all([
      getPersistenceStats(1),
      getPerformanceStats(1),
    ])

    // Edge médio do dia
    const since = new Date(Date.now() - 86400_000).toISOString()
    const { data: snaps } = await supabaseAdmin
      .from('EdgeSnapshot')
      .select('spreadRaw, edgeNet')
      .gte('timestamp', since)

    const records      = snaps ?? []
    const avgEdgeTheory = records.length > 0 ? mean(records.map((s) => s.spreadRaw as number)) : 0
    const avgEdgeReal   = records.length > 0 ? mean(records.map((s) => s.edgeNet   as number)) : 0

    // Accuracy de funding do dia
    const { data: realizations } = await supabaseAdmin
      .from('FundingRealization')
      .select('error')
      .eq('resolved', true)
      .gte('predictionTime', since)

    const errors          = (realizations ?? []).map((r) => r.error as number).filter((e) => e !== null)
    const fundingAccuracy = errors.length > 0
      ? Math.round((errors.filter((e) => e <= 0.0001).length / errors.length) * 100)
      : 0

    await supabaseAdmin.from('ValidationMetrics').insert({
      totalDetected:  persistence.totalDetected,
      aliveAfter30s:  persistence.alive30s,
      aliveAfter1m:   persistence.alive1m,
      aliveAfter5m:   persistence.alive5m,
      avgEdgeTheory,
      avgEdgeReal,
      fundingAccuracy,
      paperPnl:       paperStats.totalPnl,
      paperWinRate:   paperStats.winRate,
      paperSharpe:    paperStats.sharpeRatio,
      paperDrawdown:  paperStats.maxDrawdown,
    })

    console.log('[scheduler] Métricas diárias gravadas')
  } catch (err) {
    console.error('[scheduler] daily metrics error:', err)
  }
}
