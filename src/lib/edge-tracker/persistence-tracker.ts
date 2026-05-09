// Abordagem database-driven: evita timers em memória frágeis em hot-reload.
// O scheduler chama checkPendingOpportunities() a cada 10s.

import { supabaseAdmin } from '@/lib/supabase'
import { collectAllFundingRates, groupRatesBySymbol } from '@/lib/analyzer/opportunity-finder'
import { PersistenceStats } from '@/types'

const MAX_TRACKED = 50  // máximo de oportunidades rastreadas em simultâneo

// Regista uma nova oportunidade para tracking de persistência
export async function trackOpportunity(
  symbol: string,
  exchangeA: string,
  exchangeB: string,
  initialSpread: number,
  edgeNetInitial: number
): Promise<void> {
  // Limita a MAX_TRACKED oportunidades não resolvidas
  const { count } = await supabaseAdmin
    .from('OpportunityLife')
    .select('*', { count: 'exact', head: true })
    .eq('resolved', false)

  if ((count ?? 0) >= MAX_TRACKED) return

  await supabaseAdmin.from('OpportunityLife').insert({
    symbol,
    exchangeA,
    exchangeB,
    initialSpread,
    edgeNetInitial,
    resolved: false,
  })
}

// Chamado pelo scheduler a cada 10s — verifica oportunidades pendentes
export async function checkPendingOpportunities(): Promise<void> {
  const now = Date.now()

  // Busca todas não resolvidas
  const { data: pending } = await supabaseAdmin
    .from('OpportunityLife')
    .select('*')
    .eq('resolved', false)
    .limit(MAX_TRACKED)

  if (!pending || pending.length === 0) return

  // Busca rates actuais uma vez para todos
  const { rates } = await collectAllFundingRates().catch(() => ({ rates: [] }))
  if (rates.length === 0) return

  const grouped = groupRatesBySymbol(rates)

  for (const opp of pending) {
    const detectedMs = new Date(opp.detectedAt).getTime()
    const elapsedMs  = now - detectedMs

    // Calcula spread actual para este par
    const exchangeRates = grouped[opp.symbol]
    const rateA = exchangeRates?.[opp.exchangeA as keyof typeof exchangeRates]
    const rateB = exchangeRates?.[opp.exchangeB as keyof typeof exchangeRates]
    const currentSpread = rateA && rateB
      ? Math.abs((rateA as { fundingRate: number }).fundingRate - (rateB as { fundingRate: number }).fundingRate)
      : null

    const updates: Record<string, unknown> = {}
    const threshold = opp.initialSpread * 0.5  // 50% do spread inicial = alive

    // 30 segundos
    if (elapsedMs >= 30_000 && opp.spreadAt30s === null && currentSpread !== null) {
      updates.spreadAt30s = currentSpread
      updates.alive30s    = currentSpread >= threshold
    }

    // 1 minuto
    if (elapsedMs >= 60_000 && opp.spreadAt1m === null && currentSpread !== null) {
      updates.spreadAt1m = currentSpread
      updates.alive1m    = currentSpread >= threshold
    }

    // 5 minutos
    if (elapsedMs >= 300_000 && opp.spreadAt5m === null && currentSpread !== null) {
      updates.spreadAt5m  = currentSpread
      updates.alive5m     = currentSpread >= threshold
      updates.edgeNetAt5m = opp.edgeNetInitial * (currentSpread / Math.max(opp.initialSpread, 0.00001))
    }

    // 30 minutos — último check, marcar como resolvido
    if (elapsedMs >= 1_800_000) {
      if (opp.spreadAt30m === null && currentSpread !== null) {
        updates.spreadAt30m = currentSpread
        updates.alive30m    = currentSpread >= threshold
      }
      updates.resolved = true
    }

    if (Object.keys(updates).length > 0) {
      await supabaseAdmin
        .from('OpportunityLife')
        .update(updates)
        .eq('id', opp.id)
    }
  }
}

// Retorna estatísticas de persistência dos últimos N dias
export async function getPersistenceStats(days = 7): Promise<PersistenceStats> {
  const since = new Date(Date.now() - days * 86400_000).toISOString()

  const { data } = await supabaseAdmin
    .from('OpportunityLife')
    .select('alive30s, alive1m, alive5m, alive30m')
    .eq('resolved', true)
    .gte('detectedAt', since)

  const records = data ?? []
  const total   = records.length

  const count = (field: 'alive30s' | 'alive1m' | 'alive5m' | 'alive30m') =>
    records.filter((r) => r[field] === true).length

  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0

  const a30s = count('alive30s')
  const a1m  = count('alive1m')
  const a5m  = count('alive5m')
  const a30m = count('alive30m')

  return {
    totalDetected: total,
    alive30s: a30s,
    alive1m:  a1m,
    alive5m:  a5m,
    alive30m: a30m,
    percentages: {
      at30s: pct(a30s),
      at1m:  pct(a1m),
      at5m:  pct(a5m),
      at30m: pct(a30m),
    },
  }
}
