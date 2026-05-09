import { supabaseAdmin } from '@/lib/supabase'
import { SnapshotRow } from '@/lib/edge-tracker/snapshot-engine'
import { collectAllFundingRates, groupRatesBySymbol } from '@/lib/analyzer/opportunity-finder'
import { PaperTradingStats } from '@/types'
import { mean, sharpeRatio, maxDrawdown, winRate, profitFactor } from '@/lib/analysis/stats'

const MIN_EDGE_NET      = 0.0003   // 0.03% mínimo para entrar
const POSITION_SIZE     = 100      // USDT fixo por paper trade
const MAX_OPEN          = 5        // máximo de posições abertas
const MAX_HOLD_MS       = 24 * 3600 * 1000  // timeout 24h
const FUNDING_INTERVAL  = 8 * 3600 * 1000  // 8h por período

// Avalia se deve abrir um paper trade para este snapshot
export async function evaluateEntry(snapshot: SnapshotRow): Promise<boolean> {
  if (snapshot.edgeNet < MIN_EDGE_NET) return false

  // Verifica posições abertas no mesmo par
  const { count: existingPair } = await supabaseAdmin
    .from('PaperTrade')
    .select('*', { count: 'exact', head: true })
    .eq('symbol', snapshot.symbol)
    .eq('status', 'open')

  if ((existingPair ?? 0) > 0) return false

  // Verifica limite global
  const { count: total } = await supabaseAdmin
    .from('PaperTrade')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'open')

  if ((total ?? 0) >= MAX_OPEN) return false

  // A exchange com rate mais alto = short, a mais baixa = long
  const longExchange  = snapshot.fundingRateA <= snapshot.fundingRateB ? snapshot.exchangeA : snapshot.exchangeB
  const shortExchange = snapshot.fundingRateA >  snapshot.fundingRateB ? snapshot.exchangeA : snapshot.exchangeB

  await supabaseAdmin.from('PaperTrade').insert({
    symbol:        snapshot.symbol,
    exchangeLong:  longExchange,
    exchangeShort: shortExchange,
    spreadAtEntry: snapshot.spreadRaw,
    edgeNetEntry:  snapshot.edgeNet,
    positionSize:  POSITION_SIZE,
    status:        'open',
  })

  return true
}

// Avalia saídas — chamado a cada minuto pelo scheduler
export async function evaluateExits(): Promise<void> {
  const { data: openTrades } = await supabaseAdmin
    .from('PaperTrade')
    .select('*')
    .eq('status', 'open')

  if (!openTrades || openTrades.length === 0) return

  // Busca rates actuais para comparar spreads
  const { rates } = await collectAllFundingRates().catch(() => ({ rates: [] }))
  const grouped   = rates.length > 0 ? groupRatesBySymbol(rates) : {}

  const now = Date.now()

  for (const trade of openTrades) {
    const openedMs  = new Date(trade.openedAt).getTime()
    const holdingMs = now - openedMs

    // Rate actual para este par
    const exchangeRates = grouped[trade.symbol]
    const rateA = exchangeRates?.[trade.exchangeLong  as keyof typeof exchangeRates]
    const rateB = exchangeRates?.[trade.exchangeShort as keyof typeof exchangeRates]
    const currentSpread = rateA && rateB
      ? Math.abs(
          (rateA as { fundingRate: number }).fundingRate -
          (rateB as { fundingRate: number }).fundingRate
        )
      : trade.spreadAtEntry

    // Funding acumulado: (holdingMs / FUNDING_INTERVAL) × spreadAtEntry × positionSize
    const fundingPeriods  = holdingMs / FUNDING_INTERVAL
    const fundingCollected = fundingPeriods * trade.spreadAtEntry * trade.positionSize
    const feesTotal        = trade.edgeNetEntry * trade.positionSize * 0.1  // aprox 10% do edge

    let closeReason: string | null  = null
    let newStatus   = 'open'

    if (holdingMs >= MAX_HOLD_MS) {
      closeReason = 'timeout'
      newStatus   = currentSpread > 0 ? 'closed_profit' : 'closed_loss'
    } else if (currentSpread <= 0) {
      closeReason = 'spread_closed'
      newStatus   = 'closed_loss'
    }

    if (closeReason) {
      const pnlGross = fundingCollected
      const pnlNet   = pnlGross - feesTotal

      await supabaseAdmin
        .from('PaperTrade')
        .update({
          closedAt:        new Date().toISOString(),
          spreadAtExit:    currentSpread,
          fundingCollected,
          feesTotal,
          pnlGross,
          pnlNet,
          status:          pnlNet >= 0 ? 'closed_profit' : 'closed_loss',
          closeReason,
        })
        .eq('id', trade.id)
    }
  }
}

// Calcula métricas de performance dos últimos N dias
export async function getPerformanceStats(days = 7): Promise<PaperTradingStats> {
  const since = new Date(Date.now() - days * 86400_000).toISOString()

  const { data: all } = await supabaseAdmin
    .from('PaperTrade')
    .select('*')
    .gte('openedAt', since)
    .order('openedAt', { ascending: true })

  const trades   = all ?? []
  const closed   = trades.filter((t) => t.status !== 'open' && t.pnlNet !== null)
  const open     = trades.filter((t) => t.status === 'open')

  if (closed.length === 0) {
    return {
      totalTrades: trades.length,
      openTrades:  open.length,
      closedTrades: 0,
      winRate:      0,
      avgWin:       0,
      avgLoss:      0,
      totalPnl:     0,
      sharpeRatio:  null,
      maxDrawdown:  0,
      profitFactor: 0,
      equityCurve:  [],
    }
  }

  const pnls    = closed.map((t) => t.pnlNet as number)
  const wins    = closed.filter((t) => (t.pnlNet as number) > 0)
  const losses  = closed.filter((t) => (t.pnlNet as number) <= 0)
  const totalPnl = pnls.reduce((s, p) => s + p, 0)

  // Equity curve acumulada
  let equity = 0
  const equityCurve = closed.map((t) => {
    equity += t.pnlNet as number
    return {
      date:   new Date(t.closedAt ?? t.openedAt).toISOString().slice(0, 10),
      equity: Math.round(equity * 100) / 100,
    }
  })

  const equityValues = equityCurve.map((p) => p.equity)

  return {
    totalTrades:  trades.length,
    openTrades:   open.length,
    closedTrades: closed.length,
    winRate:      Math.round(winRate(closed.map((t) => ({ pnl: t.pnlNet as number }))) * 100),
    avgWin:       wins.length   > 0 ? mean(wins.map((t) => t.pnlNet as number))   : 0,
    avgLoss:      losses.length > 0 ? mean(losses.map((t) => t.pnlNet as number)) : 0,
    totalPnl,
    sharpeRatio:  closed.length >= 10 ? sharpeRatio(pnls) : null,
    maxDrawdown:  maxDrawdown(equityValues),
    profitFactor: profitFactor(closed.map((t) => ({ pnl: t.pnlNet as number }))),
    equityCurve,
  }
}
