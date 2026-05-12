import { supabaseAdmin } from '@/lib/supabase'

interface TradeRow {
  symbol: string
  exchangeLong: string
  exchangeShort: string
  pnlNet: number | null
  status: string
}

interface ScoreResult {
  score: number
  level: 'HIGH' | 'MEDIUM' | 'LOW'
  sampleSize: number
}

function scoreLevel(score: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (score >= 70) return 'HIGH'
  if (score >= 40) return 'MEDIUM'
  return 'LOW'
}

export async function calculateConfidenceScore(
  pairKey: string,
  strategy: string
): Promise<ScoreResult> {
  // Parse pair key e.g. "BTCUSDT_OKX_BINANCE"
  const parts = pairKey.split('_')
  if (parts.length < 3) return { score: 0, level: 'LOW', sampleSize: 0 }

  const symbol = parts[0]
  const ex1 = parts[1]
  const ex2 = parts[2]

  const { data: trades } = await supabaseAdmin
    .from('PaperTrade')
    .select('symbol, exchangeLong, exchangeShort, pnlNet, status')
    .eq('symbol', symbol)
    .in('exchangeLong', [ex1, ex2])
    .in('exchangeShort', [ex1, ex2])
    .eq('status', 'closed')
    .limit(100)

  if (!trades || trades.length < 5) {
    return { score: 0, level: 'LOW', sampleSize: trades?.length ?? 0 }
  }

  const rows = trades as TradeRow[]
  const profitable = rows.filter((t) => (t.pnlNet ?? 0) > 0).length
  const winRate = profitable / rows.length

  // paper score (0-60): win rate component
  const paperScore = winRate * 60

  // data consistency (0-20): penalise if pnlNet variance is very high
  const pnls = rows.map((t) => t.pnlNet ?? 0)
  const mean = pnls.reduce((s, v) => s + v, 0) / pnls.length
  const variance = pnls.reduce((s, v) => s + (v - mean) ** 2, 0) / pnls.length
  const cv = mean !== 0 ? Math.sqrt(variance) / Math.abs(mean) : 1
  const consistencyScore = Math.max(0, 20 * (1 - Math.min(cv, 1)))

  // source reliability (0-20): fixed 15 for funding (real CEX data)
  const sourceScore = strategy === 'FUNDING' ? 15 : 10

  const score = Math.min(100, Math.round(paperScore + consistencyScore + sourceScore))

  return { score, level: scoreLevel(score), sampleSize: rows.length }
}

export async function updateAllScores(): Promise<void> {
  // Find all closed paper trades grouped by pair
  const { data: trades } = await supabaseAdmin
    .from('PaperTrade')
    .select('symbol, exchangeLong, exchangeShort')
    .eq('status', 'closed')

  if (!trades || trades.length === 0) return

  // Collect unique pair keys
  const pairs = new Set<string>()
  for (const t of trades as TradeRow[]) {
    pairs.add(`${t.symbol}_${t.exchangeLong}_${t.exchangeShort}`)
  }

  for (const pairKey of pairs) {
    const result = await calculateConfidenceScore(pairKey, 'FUNDING')
    if (result.sampleSize < 5) continue

    // Upsert into ConfidenceScore table
    const { error } = await supabaseAdmin
      .from('ConfidenceScore')
      .upsert(
        {
          pairKey,
          strategy: 'FUNDING',
          score: result.score,
          level: result.level,
          sampleSize: result.sampleSize,
          updatedAt: new Date().toISOString(),
        },
        { onConflict: 'pairKey,strategy' }
      )

    if (error) console.error('[confidence-scorer] upsert error:', error.message)
  }
}

export async function getScoreForPair(
  pairKey: string,
  strategy: string
): Promise<{ score: number; level: string }> {
  const { data } = await supabaseAdmin
    .from('ConfidenceScore')
    .select('score, level')
    .eq('pairKey', pairKey)
    .eq('strategy', strategy)
    .single()

  return data ?? { score: 0, level: 'LOW' }
}
