import { supabaseAdmin } from '@/lib/supabase'
import { FundingRate, FundingAccuracyStats } from '@/types'
import { collectAllFundingRates } from '@/lib/analyzer/opportunity-finder'
import { mean } from '@/lib/analysis/stats'

const FUNDING_INTERVAL_MS = 8 * 3600 * 1000  // 8 horas

// Regista rates actuais como previsões — chamado periodicamente pelo scheduler
export async function recordPredictions(rates: FundingRate[]): Promise<void> {
  if (rates.length === 0) return

  const rows = rates.map((r) => ({
    symbol:         r.symbol,
    exchange:       r.exchange,
    predictedRate:  r.fundingRate,
    predictionTime: new Date().toISOString(),
    resolved:       false,
  }))

  // Insere em lotes de 50 para não sobrecarregar a API
  for (let i = 0; i < rows.length; i += 50) {
    const { error } = await supabaseAdmin
      .from('FundingRealization')
      .insert(rows.slice(i, i + 50))
    if (error) console.error('[realization-tracker] insert error:', error.message)
  }
}

// Verifica realizações pendentes — chamado a cada 5 minutos pelo scheduler
export async function checkPendingRealizations(): Promise<void> {
  const cutoff = new Date(Date.now() - FUNDING_INTERVAL_MS).toISOString()

  // Busca previsões registadas há >8h que ainda não foram resolvidas
  const { data: pending } = await supabaseAdmin
    .from('FundingRealization')
    .select('*')
    .eq('resolved', false)
    .lt('predictionTime', cutoff)
    .limit(100)

  if (!pending || pending.length === 0) return

  // Busca rates actuais para comparar
  const { rates: currentRates } = await collectAllFundingRates().catch(() => ({ rates: [] }))
  if (currentRates.length === 0) return

  // Mapeia por symbol+exchange para lookup rápido
  const rateMap = new Map<string, number>()
  for (const r of currentRates) {
    rateMap.set(`${r.symbol}::${r.exchange}`, r.fundingRate)
  }

  for (const pred of pending) {
    const key          = `${pred.symbol}::${pred.exchange}`
    const realizedRate = rateMap.get(key)

    if (realizedRate === undefined) continue

    const error = Math.abs(pred.predictedRate - realizedRate)

    await supabaseAdmin
      .from('FundingRealization')
      .update({
        realizedRate,
        realizationTime: new Date().toISOString(),
        error,
        resolved: true,
      })
      .eq('id', pred.id)
  }
}

// Retorna estatísticas de accuracy dos últimos N dias
export async function getAccuracyStats(days = 7): Promise<FundingAccuracyStats> {
  const since = new Date(Date.now() - days * 86400_000).toISOString()

  const { data } = await supabaseAdmin
    .from('FundingRealization')
    .select('symbol, exchange, error')
    .eq('resolved', true)
    .gte('predictionTime', since)

  const records = data ?? []
  if (records.length === 0) {
    return {
      totalPredictions:  0,
      meanAbsoluteError: 0,
      withinThreshold:   0,
      bestPairs:         [],
      worstPairs:        [],
    }
  }

  const errors  = records.map((r) => r.error ?? 0)
  const mae     = mean(errors)
  const thresh  = 0.0001  // ±0.01%
  const within  = records.filter((r) => (r.error ?? 0) <= thresh).length

  // Agrupa por símbolo para ranking
  const bySymbol: Record<string, number[]> = {}
  for (const r of records) {
    const key = `${r.symbol}`
    if (!bySymbol[key]) bySymbol[key] = []
    bySymbol[key].push(r.error ?? 0)
  }

  const pairMae = Object.entries(bySymbol)
    .map(([symbol, errs]) => ({ symbol, mae: mean(errs) }))
    .sort((a, b) => a.mae - b.mae)

  return {
    totalPredictions:  records.length,
    meanAbsoluteError: mae,
    withinThreshold:   records.length > 0 ? Math.round((within / records.length) * 100) : 0,
    bestPairs:  pairMae.slice(0, 3),
    worstPairs: pairMae.slice(-3).reverse(),
  }
}
