import { NextRequest, NextResponse } from 'next/server'
import { getLPPools, scanLPPools } from '@/lib/strategies/lp-scanner'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const STALE_AFTER_MS = 2 * 60 * 60_000 // 2 hours

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const chain   = searchParams.get('chain') ?? undefined
    const refresh = searchParams.get('refresh') === 'true'

    // Check freshness
    const { data: latest } = await supabaseAdmin
      .from('LPPool')
      .select('updatedAt')
      .order('updatedAt', { ascending: false })
      .limit(1)
      .single()

    const lastUpdate = latest ? new Date(latest.updatedAt).getTime() : 0
    const isStale = Date.now() - lastUpdate > STALE_AFTER_MS

    if (isStale || refresh) {
      const { pools, errors } = await scanLPPools()
      return NextResponse.json({
        data: pools,
        errors,
        timestamp: new Date().toISOString(),
        count: pools.length,
        fromCache: false,
      })
    }

    const pools = await getLPPools(chain)
    return NextResponse.json({
      data: pools,
      errors: {},
      timestamp: latest?.updatedAt ?? new Date().toISOString(),
      count: pools.length,
      fromCache: true,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message, timestamp: new Date().toISOString() }, { status: 500 })
  }
}
