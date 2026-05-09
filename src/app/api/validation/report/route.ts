import { NextRequest, NextResponse } from 'next/server'
import { getPersistenceStats } from '@/lib/edge-tracker/persistence-tracker'
import { getPerformanceStats } from '@/lib/paper-trading/simulator'
import { analyzeEdgeDecay, generateGoNoGoReport } from '@/lib/analysis/edge-analyzer'
import { supabaseAdmin } from '@/lib/supabase'
import { mean } from '@/lib/analysis/stats'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') ?? '7')

    const [persistence, paperStats, edgeDecay] = await Promise.all([
      getPersistenceStats(days),
      getPerformanceStats(days),
      analyzeEdgeDecay(days),
    ])

    // Edge médio real dos últimos N dias
    const since = new Date(Date.now() - days * 86400_000).toISOString()
    const { data: snaps } = await supabaseAdmin
      .from('EdgeSnapshot')
      .select('edgeNet')
      .gte('timestamp', since)

    const avgEdgeNet = (snaps ?? []).length > 0
      ? mean((snaps ?? []).map((s) => s.edgeNet as number))
      : 0

    // Dias de dados disponíveis
    const { data: firstSnap } = await supabaseAdmin
      .from('EdgeSnapshot')
      .select('timestamp')
      .order('timestamp', { ascending: true })
      .limit(1)

    const daysCollected = firstSnap && firstSnap.length > 0
      ? Math.floor((Date.now() - new Date(firstSnap[0].timestamp).getTime()) / 86400_000)
      : 0

    const report = await generateGoNoGoReport(
      persistence,
      avgEdgeNet,
      paperStats.winRate,
      paperStats.sharpeRatio,
      edgeDecay.trend,
      daysCollected
    )

    return NextResponse.json({ data: report, timestamp: new Date().toISOString() })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message, timestamp: new Date().toISOString() }, { status: 500 })
  }
}
