import { NextResponse } from 'next/server'
import { getFundingSnapshot } from '@/lib/strategies/funding-monitor'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const STALE_AFTER_MS = 5 * 60_000 // 5 minutes — matches scheduler interval

export async function GET() {
  try {
    // Check if DB snapshot is fresh
    const { data: latest } = await supabaseAdmin
      .from('FundingRateSnapshot')
      .select('createdAt')
      .order('createdAt', { ascending: false })
      .limit(1)
      .single()

    const lastUpdate = latest ? new Date(latest.createdAt).getTime() : 0
    const isStale = Date.now() - lastUpdate > STALE_AFTER_MS

    if (isStale) {
      // Re-fetch from exchanges (slow, runs every 5 min via scheduler)
      const snapshot = await getFundingSnapshot()
      return NextResponse.json({
        data: snapshot.rows,
        opportunities: snapshot.opportunities,
        errors: snapshot.errors,
        timestamp: snapshot.timestamp,
        count: snapshot.rows.length,
      })
    }

    // Serve from DB (fast)
    const { data: rows, error } = await supabaseAdmin
      .from('FundingRateSnapshot')
      .select('symbol, exchange, fundingRate, markPrice, nextFundingTime, createdAt')
      .order('createdAt', { ascending: false })
      .limit(1500)

    if (error || !rows || rows.length === 0) {
      const snapshot = await getFundingSnapshot()
      return NextResponse.json({
        data: snapshot.rows, opportunities: snapshot.opportunities,
        errors: snapshot.errors, timestamp: snapshot.timestamp, count: snapshot.rows.length,
      })
    }

    // Group into FundingRateRow format
    const grouped: Record<string, Record<string, number>> = {}
    const nextFundingMap: Record<string, string | null> = {}

    for (const row of rows) {
      if (!grouped[row.symbol]) grouped[row.symbol] = {}
      grouped[row.symbol][row.exchange] = row.fundingRate
      if (!nextFundingMap[row.symbol] && row.nextFundingTime) {
        nextFundingMap[row.symbol] = row.nextFundingTime
      }
    }

    const { calculateFeeBreakdown, calculateNetEdge, minimumCapitalRequired } = await import('@/lib/strategies/fee-engine')
    const { calculateFundingReturnSync } = await import('@/lib/strategies/return-calculator')

    const data = Object.entries(grouped)
      .map(([symbol, exchanges]) => {
        const vals = Object.values(exchanges)
        const maxRate = Math.max(...vals)
        const minRate = Math.min(...vals)
        const bestDiff = maxRate - minRate
        const exList = Object.keys(exchanges)
        const returnEst = calculateFundingReturnSync(bestDiff)
        const grossEdge = 1000 * bestDiff
        const fees = calculateFeeBreakdown({ strategy: 'FUNDING', capital: 1000, exchanges: exList })
        const netEdge = calculateNetEdge(grossEdge, fees)
        const capitalMin = minimumCapitalRequired(bestDiff * 100, 'FUNDING', exList)
        return {
          symbol,
          OKX: exchanges['OKX'] ?? null,
          BINANCE: exchanges['BINANCE'] ?? null,
          BYBIT: exchanges['BYBIT'] ?? null,
          bestDiff,
          annualizedReturn: returnEst.grossReturn,
          adjustedReturn: returnEst.adjustedReturn,
          grossReturn: returnEst.grossReturn,
          netEdge,
          grossEdge,
          capitalMin: capitalMin === Infinity ? null : capitalMin,
          decayFactor: returnEst.decayFactor,
          nextFundingTime: nextFundingMap[symbol] ?? null,
        }
      })
      .filter((r) => r.bestDiff > 0)
      .sort((a, b) => b.bestDiff - a.bestDiff)

    return NextResponse.json({
      data,
      opportunities: [],
      errors: {},
      timestamp: latest?.createdAt ?? new Date().toISOString(),
      count: data.length,
      fromCache: true,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message, timestamp: new Date().toISOString() }, { status: 500 })
  }
}
