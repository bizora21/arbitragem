import { supabaseAdmin } from '@/lib/supabase'
import { EdgeDecayAnalysis, PairRanking, GoNoGoReport, GoNoGoVerdict } from '@/types'
import { mean } from '@/lib/analysis/stats'
import { linearRegression } from '@/lib/analysis/stats'

// Thresholds GO/NO-GO
const GO_THRESHOLDS = {
  persistence1m:  50,   // %
  avgEdgeNet:     0.0003,
  paperWinRate:   55,   // %
  paperSharpe:    1.0,
}

const NOGO_THRESHOLDS = {
  persistence1m:  25,
  avgEdgeNet:     0.0001,
  paperWinRate:   40,
  paperSharpe:    0.3,
}

export async function analyzeEdgeDecay(days: number): Promise<EdgeDecayAnalysis> {
  const since = new Date(Date.now() - days * 86400_000).toISOString()

  const { data } = await supabaseAdmin
    .from('ValidationMetrics')
    .select('avgEdgeReal, date')
    .gte('date', since)
    .order('date', { ascending: true })

  const records = data ?? []
  if (records.length < 2) {
    return { trend: 'stable', slope: 0, r2: 0, daysAnalyzed: records.length }
  }

  const values = records.map((r) => r.avgEdgeReal as number)
  const { slope, r2 } = linearRegression(values)

  // Determina tendência baseado no slope relativo
  const avgValue = mean(values)
  const relSlope = avgValue !== 0 ? slope / Math.abs(avgValue) : 0

  let trend: EdgeDecayAnalysis['trend'] = 'stable'
  if (relSlope > 0.05)       trend = 'growing'
  else if (relSlope < -0.05) trend = 'decaying'

  return { trend, slope, r2, daysAnalyzed: records.length }
}

export async function identifyBestPairs(days: number): Promise<PairRanking[]> {
  const since = new Date(Date.now() - days * 86400_000).toISOString()

  const { data: snapshots } = await supabaseAdmin
    .from('EdgeSnapshot')
    .select('symbol, edgeNet')
    .gte('timestamp', since)

  const { data: lives } = await supabaseAdmin
    .from('OpportunityLife')
    .select('symbol, alive1m')
    .eq('resolved', true)
    .gte('detectedAt', since)

  const { data: trades } = await supabaseAdmin
    .from('PaperTrade')
    .select('symbol, pnlNet, status')
    .neq('status', 'open')
    .gte('openedAt', since)

  const snapshotMap: Record<string, number[]> = {}
  for (const s of snapshots ?? []) {
    if (!snapshotMap[s.symbol]) snapshotMap[s.symbol] = []
    snapshotMap[s.symbol].push(s.edgeNet as number)
  }

  const lifeMap: Record<string, { total: number; alive: number }> = {}
  for (const l of lives ?? []) {
    if (!lifeMap[l.symbol]) lifeMap[l.symbol] = { total: 0, alive: 0 }
    lifeMap[l.symbol].total++
    if (l.alive1m) lifeMap[l.symbol].alive++
  }

  const tradeMap: Record<string, { wins: number; total: number }> = {}
  for (const t of trades ?? []) {
    if (!tradeMap[t.symbol]) tradeMap[t.symbol] = { wins: 0, total: 0 }
    tradeMap[t.symbol].total++
    if ((t.pnlNet as number) > 0) tradeMap[t.symbol].wins++
  }

  const symbols = Object.keys(snapshotMap)

  const ranked = symbols
    .map((symbol) => {
      const avgEdge      = mean(snapshotMap[symbol])
      const lifeData     = lifeMap[symbol]
      const persistence  = lifeData && lifeData.total > 0
        ? Math.round((lifeData.alive / lifeData.total) * 100)
        : 0
      const tradeData    = tradeMap[symbol]
      const wr           = tradeData && tradeData.total > 0
        ? Math.round((tradeData.wins / tradeData.total) * 100)
        : 0

      // Score composto: edge × persistence × winRate (normalizado)
      const score = avgEdge * (persistence / 100) * (wr > 0 ? wr / 100 : 0.5)

      return { symbol, avgEdge, persistence1m: persistence, winRate: wr, score }
    })
    .filter((p) => p.avgEdge > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((p, i) => ({ ...p, rank: i + 1 }))

  return ranked
}

export async function generateGoNoGoReport(
  persistence: { percentages: { at1m: number } },
  avgEdgeNet: number,
  paperWinRate: number,
  paperSharpe: number | null,
  edgeTrend: EdgeDecayAnalysis['trend'],
  daysCollected: number
): Promise<GoNoGoReport> {
  const DAYS_REQUIRED = 7

  const criteria = [
    {
      name:      'Persistence 1m',
      threshold: `> ${GO_THRESHOLDS.persistence1m}%`,
      actual:    `${persistence.percentages.at1m}%`,
      passed:    persistence.percentages.at1m >= GO_THRESHOLDS.persistence1m,
    },
    {
      name:      'Edge líquido médio',
      threshold: `> ${(GO_THRESHOLDS.avgEdgeNet * 100).toFixed(2)}%`,
      actual:    `${(avgEdgeNet * 100).toFixed(4)}%`,
      passed:    avgEdgeNet >= GO_THRESHOLDS.avgEdgeNet,
    },
    {
      name:      'Paper win rate',
      threshold: `> ${GO_THRESHOLDS.paperWinRate}%`,
      actual:    `${paperWinRate}%`,
      passed:    paperWinRate >= GO_THRESHOLDS.paperWinRate,
    },
    {
      name:      'Sharpe ratio',
      threshold: `> ${GO_THRESHOLDS.paperSharpe}`,
      actual:    paperSharpe !== null ? paperSharpe.toFixed(2) : 'N/A (<10 trades)',
      passed:    paperSharpe !== null && paperSharpe >= GO_THRESHOLDS.paperSharpe,
    },
    {
      name:      'Tendência do edge',
      threshold: '≠ decaying',
      actual:    edgeTrend,
      passed:    edgeTrend !== 'decaying',
    },
    {
      name:      'Dias de dados',
      threshold: `>= ${DAYS_REQUIRED}`,
      actual:    `${daysCollected}`,
      passed:    daysCollected >= DAYS_REQUIRED,
    },
  ]

  let verdict: GoNoGoVerdict
  let recommendation: string

  if (daysCollected < DAYS_REQUIRED) {
    verdict = 'COLLECTING'
    recommendation = `A recolher dados. Faltam ${DAYS_REQUIRED - daysCollected} dia(s) para veredicto completo.`
  } else {
    const passed = criteria.filter((c) => c.passed).length
    const nogoFails = [
      persistence.percentages.at1m < NOGO_THRESHOLDS.persistence1m,
      avgEdgeNet   < NOGO_THRESHOLDS.avgEdgeNet,
      paperWinRate < NOGO_THRESHOLDS.paperWinRate,
      paperSharpe !== null && paperSharpe < NOGO_THRESHOLDS.paperSharpe,
    ].filter(Boolean).length

    if (nogoFails >= 2) {
      verdict = 'NO_GO'
      recommendation = 'Edge insuficiente para justificar capital real. Continuar a observar.'
    } else if (passed >= 5) {
      verdict = 'GO'
      recommendation = 'Métricas positivas. Edge real detectado. Começar com capital mínimo e monitorizar.'
    } else {
      verdict = 'CAUTION'
      recommendation = 'Resultados mistos. Aguardar mais dados antes de alocar capital.'
    }
  }

  return { verdict, daysCollected, daysRequired: DAYS_REQUIRED, criteria, recommendation }
}
