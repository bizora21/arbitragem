import { NextRequest, NextResponse } from 'next/server'
import { takeSnapshot, getSnapshotHistory } from '@/lib/edge-tracker/snapshot-engine'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get('symbol') ?? undefined
    const hours  = parseInt(searchParams.get('hours') ?? '24')
    const limit  = parseInt(searchParams.get('limit') ?? '100')

    if (symbol) {
      const history = await getSnapshotHistory(symbol, hours)
      return NextResponse.json({ data: history.slice(-limit), timestamp: new Date().toISOString() })
    }

    // Últimos N snapshots globais
    const { data, error } = await supabaseAdmin
      .from('EdgeSnapshot')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit)

    if (error) throw new Error(error.message)
    return NextResponse.json({ data: data ?? [], timestamp: new Date().toISOString() })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message, timestamp: new Date().toISOString() }, { status: 500 })
  }
}

export async function POST() {
  try {
    const snapshots = await takeSnapshot()
    return NextResponse.json({
      data:      snapshots,
      count:     snapshots.length,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message, timestamp: new Date().toISOString() }, { status: 500 })
  }
}
