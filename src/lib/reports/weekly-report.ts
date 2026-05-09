import { supabaseAdmin } from '@/lib/supabase'
import { getPersistenceStats } from '@/lib/edge-tracker/persistence-tracker'
import { getAccuracyStats } from '@/lib/edge-tracker/realization-tracker'
import { getPerformanceStats } from '@/lib/paper-trading/simulator'
import { analyzeEdgeDecay, identifyBestPairs, generateGoNoGoReport } from '@/lib/analysis/edge-analyzer'
import { mean } from '@/lib/analysis/stats'

export interface WeeklyReport {
  weekStart:       string
  weekEnd:         string
  totalOpportunities: number
  persistenceRate: number
  avgEdgeTheory:   number
  avgEdgeReal:     number
  reductionFactor: number
  paperPnl:        number
  paperSharpe:     number | null
  paperWinRate:    number
  fundingAccuracy: number
  top3Pairs:       { symbol: string; avgEdge: number; winRate: number }[]
  pairsToAvoid:    string[]
  verdict:         string
  recommendation:  string
  comparedToLastWeek: {
    pnlDelta:  number | null
    edgeDelta: number | null
  } | null
}

export async function generateWeeklyReport(): Promise<WeeklyReport> {
  const weekEnd   = new Date()
  const weekStart = new Date(weekEnd.getTime() - 7 * 86400_000)

  const [persistence, accuracy, paperStats, edgeDecay, topPairs] = await Promise.all([
    getPersistenceStats(7),
    getAccuracyStats(7),
    getPerformanceStats(7),
    analyzeEdgeDecay(7),
    identifyBestPairs(7),
  ])

  // Edge médio da semana
  const since = weekStart.toISOString()
  const { data: snaps } = await supabaseAdmin
    .from('EdgeSnapshot')
    .select('spreadRaw, edgeNet')
    .gte('timestamp', since)

  const records      = snaps ?? []
  const avgEdgeTheory = records.length > 0 ? mean(records.map((s) => s.spreadRaw as number)) : 0
  const avgEdgeReal   = records.length > 0 ? mean(records.map((s) => s.edgeNet   as number)) : 0
  const reductionFactor = avgEdgeReal > 0 ? avgEdgeTheory / avgEdgeReal : 0

  // Pares a evitar: edge negativo ou persistência < 20%
  const pairsToAvoid = topPairs
    .filter((p) => p.avgEdge < 0.0001 || p.persistence1m < 20)
    .map((p) => p.symbol)

  // Dias de dados
  const { data: firstSnap } = await supabaseAdmin
    .from('EdgeSnapshot')
    .select('timestamp')
    .order('timestamp', { ascending: true })
    .limit(1)

  const daysCollected = firstSnap && firstSnap.length > 0
    ? Math.floor((Date.now() - new Date(firstSnap[0].timestamp).getTime()) / 86400_000)
    : 0

  const report = await generateGoNoGoReport(
    persistence,
    avgEdgeReal,
    paperStats.winRate,
    paperStats.sharpeRatio,
    edgeDecay.trend,
    daysCollected
  )

  // Comparação com semana anterior
  const prevWeekSince = new Date(weekStart.getTime() - 7 * 86400_000).toISOString()
  const { data: prevMetrics } = await supabaseAdmin
    .from('ValidationMetrics')
    .select('avgEdgeReal, paperPnl')
    .gte('date', prevWeekSince)
    .lt('date', since)

  let comparedToLastWeek = null
  if (prevMetrics && prevMetrics.length > 0) {
    const prevEdge = mean(prevMetrics.map((m) => m.avgEdgeReal as number))
    const prevPnl  = (prevMetrics as { paperPnl: number }[]).reduce((s, m) => s + m.paperPnl, 0)
    comparedToLastWeek = {
      pnlDelta:  paperStats.totalPnl - prevPnl,
      edgeDelta: avgEdgeReal - prevEdge,
    }
  }

  return {
    weekStart:         weekStart.toISOString().slice(0, 10),
    weekEnd:           weekEnd.toISOString().slice(0, 10),
    totalOpportunities: persistence.totalDetected,
    persistenceRate:   persistence.percentages.at1m,
    avgEdgeTheory,
    avgEdgeReal,
    reductionFactor,
    paperPnl:          paperStats.totalPnl,
    paperSharpe:       paperStats.sharpeRatio,
    paperWinRate:      paperStats.winRate,
    fundingAccuracy:   accuracy.withinThreshold,
    top3Pairs:         topPairs.slice(0, 3).map((p) => ({
      symbol:  p.symbol,
      avgEdge: p.avgEdge,
      winRate: p.winRate,
    })),
    pairsToAvoid,
    verdict:        report.verdict,
    recommendation: report.recommendation,
    comparedToLastWeek,
  }
}
