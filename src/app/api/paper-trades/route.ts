import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status   = searchParams.get('status')    // 'open' | 'closed' | null (all)
    const strategy = searchParams.get('strategy')  // optional filter
    const limit    = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)

    let query = supabaseAdmin
      .from('PaperTrade')
      .select('*')
      .order('openedAt', { ascending: false })
      .limit(limit)

    if (status)   query = query.eq('status', status)
    if (strategy) query = query.eq('strategy', strategy)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    const trades = data ?? []

    // Aggregate stats
    const closed = trades.filter((t) => t.status === 'closed')
    const profitable = closed.filter((t) => (t.pnlNet ?? 0) > 0)
    const totalPnL = closed.reduce((s, t) => s + (t.pnlNet ?? 0), 0)
    const winRate = closed.length > 0 ? (profitable.length / closed.length) * 100 : 0

    return NextResponse.json({
      trades,
      stats: {
        open:      trades.filter((t) => t.status === 'open').length,
        closed:    closed.length,
        winRate:   Math.round(winRate * 10) / 10,
        totalPnL:  Math.round(totalPnL * 100) / 100,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message, timestamp: new Date().toISOString() }, { status: 500 })
  }
}
