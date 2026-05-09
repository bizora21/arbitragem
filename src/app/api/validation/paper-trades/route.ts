import { NextRequest, NextResponse } from 'next/server'
import { evaluateExits, getPerformanceStats } from '@/lib/paper-trading/simulator'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const days  = parseInt(searchParams.get('days') ?? '7')
    const stats = await getPerformanceStats(days)

    const since = new Date(Date.now() - days * 86400_000).toISOString()
    const { data: trades } = await supabaseAdmin
      .from('PaperTrade')
      .select('*')
      .gte('openedAt', since)
      .order('openedAt', { ascending: false })
      .limit(50)

    return NextResponse.json({
      data:      { stats, trades: trades ?? [] },
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message, timestamp: new Date().toISOString() }, { status: 500 })
  }
}

export async function POST() {
  try {
    await evaluateExits()
    return NextResponse.json({ success: true, timestamp: new Date().toISOString() })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message, timestamp: new Date().toISOString() }, { status: 500 })
  }
}
