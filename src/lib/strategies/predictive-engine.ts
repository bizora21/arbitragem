import { supabaseAdmin } from '@/lib/supabase'

// ── Math helpers ─────────────────────────────────────────────────────────────

export function calculateMovingAverage(data: number[], windowSize: number): number {
  if (data.length === 0) return 0
  const window = data.slice(-windowSize)
  return window.reduce((s, v) => s + v, 0) / window.length
}

export function detectAnomalies(
  currentValue: number,
  history: number[],
  threshold = 2.0
): { isAnomaly: boolean; zScore: number; direction: 'up' | 'down' } {
  if (history.length < 3) return { isAnomaly: false, zScore: 0, direction: 'up' }
  const mean = history.reduce((s, v) => s + v, 0) / history.length
  const std = Math.sqrt(history.reduce((s, v) => s + (v - mean) ** 2, 0) / history.length)
  const zScore = std > 0 ? (currentValue - mean) / std : 0
  return {
    isAnomaly: Math.abs(zScore) >= threshold,
    zScore,
    direction: zScore > 0 ? 'up' : 'down',
  }
}

export function calculateSlope(values: number[]): number {
  if (values.length < 2) return 0
  const n = values.length
  const xMean = (n - 1) / 2
  const yMean = values.reduce((s, v) => s + v, 0) / n
  const num = values.reduce((s, v, i) => s + (i - xMean) * (v - yMean), 0)
  const den = values.reduce((s, _, i) => s + (i - xMean) ** 2, 0)
  return den === 0 ? 0 : num / den
}

interface StrategyAlertData {
  strategy: string
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW'
  title: string
  detail: string
  value?: string
  isPredictive: boolean
}

// ── Pattern detectors ────────────────────────────────────────────────────────

async function checkFundingPatterns(): Promise<StrategyAlertData[]> {
  const alerts: StrategyAlertData[] = []

  const { data: history } = await supabaseAdmin
    .from('FundingRateSnapshot')
    .select('symbol, exchange, fundingRate, createdAt')
    .order('createdAt', { ascending: false })
    .limit(300)

  if (!history || history.length < 10) return alerts

  // Group by symbol+exchange
  const grouped: Record<string, { rate: number; ts: string }[]> = {}
  for (const row of history) {
    const key = `${row.symbol}_${row.exchange}`
    if (!grouped[key]) grouped[key] = []
    grouped[key].push({ rate: row.fundingRate, ts: row.createdAt })
  }

  for (const [key, entries] of Object.entries(grouped)) {
    if (entries.length < 3) continue
    const rates = entries.slice(0, 6).map((e) => e.rate).reverse()
    const slope = calculateSlope(rates)
    const current = rates[rates.length - 1]

    // Pattern 1: Rising funding rate 3+ consecutive periods → reversion imminent
    const last3 = rates.slice(-3)
    const allRising = last3.every((v, i) => i === 0 || v > last3[i - 1])
    if (allRising && Math.abs(current) > 0.0003) {
      alerts.push({
        strategy: 'FUNDING',
        priority: 'HIGH',
        title: `Funding a subir: ${key.split('_')[0]}`,
        detail: `Taxa crescente há 3+ períodos (${(current * 100).toFixed(4)}%). Reversão esperada.`,
        value: `slope=${slope.toFixed(6)}`,
        isPredictive: true,
      })
    }

    // Pattern 2: Spread narrowing between exchanges (opportunity closing)
    const anomaly = detectAnomalies(current, rates.slice(0, -1))
    if (anomaly.isAnomaly && anomaly.direction === 'down' && current < 0.0001) {
      alerts.push({
        strategy: 'FUNDING',
        priority: 'MEDIUM',
        title: `Spread a fechar: ${key.split('_')[0]}`,
        detail: `Diferencial a convergir (z=${anomaly.zScore.toFixed(2)}). Oportunidade pode estar a expirar.`,
        isPredictive: true,
      })
    }
  }

  return alerts
}

async function checkDepegPatterns(): Promise<StrategyAlertData[]> {
  const alerts: StrategyAlertData[] = []

  const since15m = new Date(Date.now() - 15 * 60_000).toISOString()
  const { data: recent } = await supabaseAdmin
    .from('DepegEvent')
    .select('stablecoin, price, deviationPct, detectedAt')
    .gte('detectedAt', since15m)
    .order('detectedAt', { ascending: true })

  if (!recent || recent.length < 3) return alerts

  // Group by stablecoin
  const byStable: Record<string, number[]> = {}
  for (const row of recent) {
    if (!byStable[row.stablecoin]) byStable[row.stablecoin] = []
    byStable[row.stablecoin].push(Math.abs(row.deviationPct))
  }

  for (const [stable, devs] of Object.entries(byStable)) {
    if (devs.length < 3) continue
    const slope = calculateSlope(devs)
    const current = devs[devs.length - 1]

    // Pattern: Growing deviation over 15min → depeg developing
    if (slope > 0.001 && current > 0.2) {
      alerts.push({
        strategy: 'DEPEG',
        priority: current > 0.5 ? 'URGENT' : 'HIGH',
        title: `Depeg em desenvolvimento: ${stable}`,
        detail: `Desvio crescendo há 15min+ (atual ${current.toFixed(3)}%, slope=${slope.toFixed(4)}).`,
        value: `${current.toFixed(3)}%`,
        isPredictive: true,
      })
    }
  }

  return alerts
}

async function checkYieldPatterns(): Promise<StrategyAlertData[]> {
  const alerts: StrategyAlertData[] = []

  const since24h = new Date(Date.now() - 24 * 3600_000).toISOString()
  const { data: rates } = await supabaseAdmin
    .from('YieldRate')
    .select('protocol, chain, asset, apy, tvl, createdAt')
    .gte('createdAt', since24h)
    .order('createdAt', { ascending: true })

  if (!rates || rates.length < 4) return alerts

  // Group by protocol+chain+asset
  const grouped: Record<string, { apy: number; tvl: number | null }[]> = {}
  for (const row of rates) {
    const key = `${row.protocol}_${row.chain}_${row.asset}`
    if (!grouped[key]) grouped[key] = []
    grouped[key].push({ apy: row.apy, tvl: row.tvl })
  }

  for (const [key, entries] of Object.entries(grouped)) {
    if (entries.length < 2) continue
    const apys = entries.map((e) => e.apy)
    const first = apys[0]
    const last = apys[apys.length - 1]
    const dropPct = first > 0 ? ((first - last) / first) * 100 : 0

    // Pattern: APY dropped >20% in 24h
    if (dropPct > 20 && last > 0.5) {
      const [protocol, chain, asset] = key.split('_')
      alerts.push({
        strategy: 'YIELD',
        priority: dropPct > 40 ? 'HIGH' : 'MEDIUM',
        title: `APY a cair: ${protocol} ${asset} (${chain})`,
        detail: `APY caiu ${dropPct.toFixed(0)}% em 24h (${first.toFixed(2)}% → ${last.toFixed(2)}%). Considerar rotação.`,
        value: `-${dropPct.toFixed(0)}%`,
        isPredictive: true,
      })
    }

    // Pattern: TVL dropping rapidly
    const tvls = entries.map((e) => e.tvl ?? 0).filter((v) => v > 0)
    if (tvls.length >= 2) {
      const tvlDrop = ((tvls[0] - tvls[tvls.length - 1]) / tvls[0]) * 100
      if (tvlDrop > 15 && tvls[tvls.length - 1] < 2_000_000) {
        const [protocol, chain, asset] = key.split('_')
        alerts.push({
          strategy: 'YIELD',
          priority: 'URGENT',
          title: `TVL a cair: ${protocol} ${asset} (${chain})`,
          detail: `TVL caiu ${tvlDrop.toFixed(0)}% — possível risk event ou saída em massa.`,
          value: `-${tvlDrop.toFixed(0)}% TVL`,
          isPredictive: true,
        })
      }
    }
  }

  return alerts
}

async function checkSpreadPatterns(): Promise<StrategyAlertData[]> {
  const alerts: StrategyAlertData[] = []

  const since30m = new Date(Date.now() - 30 * 60_000).toISOString()
  const { data: spreads } = await supabaseAdmin
    .from('CexDexSpread')
    .select('symbol, cexName, spreadPct, createdAt')
    .gte('createdAt', since30m)
    .order('createdAt', { ascending: true })

  if (!spreads || spreads.length < 4) return alerts

  const grouped: Record<string, number[]> = {}
  for (const row of spreads) {
    const key = `${row.symbol}_${row.cexName}`
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(Math.abs(row.spreadPct))
  }

  for (const [key, values] of Object.entries(grouped)) {
    if (values.length < 3) continue
    const slope = calculateSlope(values)
    const current = values[values.length - 1]

    // Pattern: Spread progressively widening → liquidity stress
    if (slope > 0.005 && current > 0.3) {
      const [symbol, cex] = key.split('_')
      alerts.push({
        strategy: 'SPREAD',
        priority: current > 1 ? 'HIGH' : 'MEDIUM',
        title: `Spread alargando: ${symbol} (${cex})`,
        detail: `Spread crescendo progressivamente (atual ${current.toFixed(2)}%). Possível stress de liquidez.`,
        value: `${current.toFixed(2)}%`,
        isPredictive: true,
      })
    }
  }

  return alerts
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generatePredictiveAlerts(): Promise<void> {
  const [fundingAlerts, depegAlerts, yieldAlerts, spreadAlerts] = await Promise.allSettled([
    checkFundingPatterns(),
    checkDepegPatterns(),
    checkYieldPatterns(),
    checkSpreadPatterns(),
  ])

  const allAlerts: StrategyAlertData[] = [
    ...(fundingAlerts.status === 'fulfilled' ? fundingAlerts.value : []),
    ...(depegAlerts.status  === 'fulfilled' ? depegAlerts.value  : []),
    ...(yieldAlerts.status  === 'fulfilled' ? yieldAlerts.value  : []),
    ...(spreadAlerts.status === 'fulfilled' ? spreadAlerts.value : []),
  ]

  if (allAlerts.length === 0) return

  const rows = allAlerts.map((a) => ({
    strategy: a.strategy,
    priority: a.priority,
    title: `[Preditivo] ${a.title}`,
    detail: a.detail,
    value: a.value ?? null,
    isActive: true,
  }))

  const { error } = await supabaseAdmin.from('StrategyAlert').insert(rows)
  if (error) console.error('[predictive-engine] insert error:', error.message)
}
