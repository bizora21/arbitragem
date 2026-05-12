import { supabaseAdmin } from '@/lib/supabase'
import { calculateFeeBreakdown } from './fee-engine'

const DEFAULT_POSITION_SIZE = 1000
const MAX_PERIODS = 6          // Close after 6 funding periods (48h)
const SPREAD_CLOSE_THRESHOLD = 0.0002  // Close when diff < 0.02%

interface OpenTrade {
  id: string
  symbol: string
  exchangeLong: string
  exchangeShort: string
  spreadAtEntry: number
  edgeNetEntry: number
  positionSize: number
  openedAt: string
}

export async function createPaperTrade(opportunity: {
  strategy: string
  symbol: string
  longExchange: string
  shortExchange: string
  entryRate: number
  size?: number
}): Promise<void> {
  const size = opportunity.size ?? DEFAULT_POSITION_SIZE
  const fees = calculateFeeBreakdown({
    strategy: 'FUNDING',
    capital: size,
    exchanges: [opportunity.longExchange, opportunity.shortExchange],
  })

  const { error } = await supabaseAdmin.from('PaperTrade').insert({
    symbol: opportunity.symbol,
    exchangeLong: opportunity.longExchange,
    exchangeShort: opportunity.shortExchange,
    spreadAtEntry: opportunity.entryRate,
    edgeNetEntry: opportunity.entryRate - fees.totalFees / size,
    positionSize: size,
    feesTotal: fees.totalFees,
    status: 'open',
  })

  if (error) console.error('[paper-trading] create error:', error.message)
}

export async function updatePaperTrades(): Promise<void> {
  // Fetch current funding rates snapshot
  const { data: snapshot } = await supabaseAdmin
    .from('FundingRateSnapshot')
    .select('symbol, exchange, fundingRate')
    .order('createdAt', { ascending: false })
    .limit(500)

  if (!snapshot || snapshot.length === 0) return

  // Build rate map: symbol → exchange → rate
  const rateMap: Record<string, Record<string, number>> = {}
  for (const row of snapshot) {
    if (!rateMap[row.symbol]) rateMap[row.symbol] = {}
    rateMap[row.symbol][row.exchange] = row.fundingRate
  }

  // Fetch open paper trades
  const { data: openTrades } = await supabaseAdmin
    .from('PaperTrade')
    .select('id, symbol, exchangeLong, exchangeShort, spreadAtEntry, edgeNetEntry, positionSize, openedAt')
    .eq('status', 'open')

  if (!openTrades || openTrades.length === 0) return

  const now = new Date()

  for (const trade of openTrades as OpenTrade[]) {
    const symbolRates = rateMap[trade.symbol]
    if (!symbolRates) continue

    const longRate = symbolRates[trade.exchangeLong] ?? null
    const shortRate = symbolRates[trade.exchangeShort] ?? null

    if (longRate === null || shortRate === null) continue

    const currentDiff = Math.abs(longRate - shortRate)
    const openedAt = new Date(trade.openedAt)
    const periodsElapsed = (now.getTime() - openedAt.getTime()) / (8 * 3600_000)

    const pnl = calculatePaperPnL(trade, currentDiff, periodsElapsed)

    // Close conditions
    const shouldClose =
      currentDiff < SPREAD_CLOSE_THRESHOLD ||
      periodsElapsed >= MAX_PERIODS

    if (shouldClose) {
      const fees = calculateFeeBreakdown({
        strategy: 'FUNDING',
        capital: trade.positionSize,
        exchanges: [trade.exchangeLong, trade.exchangeShort],
      })
      await supabaseAdmin
        .from('PaperTrade')
        .update({
          status: 'closed',
          closedAt: now.toISOString(),
          spreadAtExit: currentDiff,
          pnlGross: pnl.gross,
          pnlNet: pnl.gross - fees.totalFees,
          feesTotal: fees.totalFees,
          closeReason: periodsElapsed >= MAX_PERIODS ? 'max_periods' : 'spread_closed',
        })
        .eq('id', trade.id)
    }
  }
}

function calculatePaperPnL(
  trade: OpenTrade,
  currentRate: number,
  periodsElapsed: number
): { gross: number } {
  // Funding collected = entry spread × periods × position size
  const periodsCollected = Math.min(periodsElapsed, MAX_PERIODS)
  const gross = trade.spreadAtEntry * periodsCollected * trade.positionSize
  return { gross }
}

export async function closeExpiredTrades(maxPeriods = MAX_PERIODS): Promise<void> {
  const cutoff = new Date(Date.now() - maxPeriods * 8 * 3600_000).toISOString()

  const { data: expired } = await supabaseAdmin
    .from('PaperTrade')
    .select('id, spreadAtEntry, positionSize, openedAt')
    .eq('status', 'open')
    .lt('openedAt', cutoff)

  if (!expired || expired.length === 0) return

  for (const trade of expired as (OpenTrade & { openedAt: string })[]) {
    const fees = calculateFeeBreakdown({
      strategy: 'FUNDING',
      capital: trade.positionSize,
    })
    const gross = trade.spreadAtEntry * maxPeriods * trade.positionSize
    await supabaseAdmin
      .from('PaperTrade')
      .update({
        status: 'closed',
        closedAt: new Date().toISOString(),
        pnlGross: gross,
        pnlNet: gross - fees.totalFees,
        feesTotal: fees.totalFees,
        closeReason: 'max_periods',
      })
      .eq('id', trade.id)
  }
}
