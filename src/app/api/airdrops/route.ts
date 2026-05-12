import { NextRequest, NextResponse } from 'next/server'
import { getAirdropCandidates, scanAirdropCandidates } from '@/lib/strategies/airdrop-tracker'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const STALE_AFTER_MS = 2 * 60 * 60_000 // 2 hours

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tier     = searchParams.get('tier') ?? undefined
    const refresh  = searchParams.get('refresh') === 'true'

    // Check freshness
    const { data: latest } = await supabaseAdmin
      .from('AirdropCandidate')
      .select('updatedAt')
      .order('updatedAt', { ascending: false })
      .limit(1)
      .single()

    const lastUpdate = latest ? new Date(latest.updatedAt).getTime() : 0
    const isStale = Date.now() - lastUpdate > STALE_AFTER_MS

    if (isStale || refresh) {
      const { candidates, errors } = await scanAirdropCandidates()
      return NextResponse.json({
        data: candidates,
        errors,
        timestamp: new Date().toISOString(),
        count: candidates.length,
        fromCache: false,
      })
    }

    const candidates = await getAirdropCandidates(tier)
    return NextResponse.json({
      data: candidates,
      errors: {},
      timestamp: latest?.updatedAt ?? new Date().toISOString(),
      count: candidates.length,
      fromCache: true,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message, timestamp: new Date().toISOString() }, { status: 500 })
  }
}
