import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Monitor activo = houve snapshot nos últimos 3 minutos
    const activeSince = new Date(Date.now() - 3 * 60_000).toISOString()
    const { count: recentCount } = await supabaseAdmin
      .from('DEXPriceSnapshot')
      .select('*', { count: 'exact', head: true })
      .gte('timestamp', activeSince)

    const isActive = (recentCount ?? 0) > 0

    // Stats por chain (últimas 2h)
    const since2h = new Date(Date.now() - 2 * 3600_000).toISOString()
    const { data: snaps } = await supabaseAdmin
      .from('DEXPriceSnapshot')
      .select('chain, timestamp')
      .gte('timestamp', since2h)

    const chainStats: Record<string, { count: number; lastSeen: string | null }> = {}
    for (const row of snaps ?? []) {
      if (!chainStats[row.chain]) chainStats[row.chain] = { count: 0, lastSeen: null }
      chainStats[row.chain].count++
      if (!chainStats[row.chain].lastSeen || row.timestamp > chainStats[row.chain].lastSeen!) {
        chainStats[row.chain].lastSeen = row.timestamp
      }
    }

    // Oportunidades hoje
    const startOfDay = new Date()
    startOfDay.setUTCHours(0, 0, 0, 0)
    const { count: oppsToday } = await supabaseAdmin
      .from('DEXArbitrageOpportunity')
      .select('*', { count: 'exact', head: true })
      .gte('createdAt', startOfDay.toISOString())

    // Verificar se tabelas existem
    const { error: tableErr } = await supabaseAdmin
      .from('DEXPriceSnapshot')
      .select('id', { count: 'exact', head: true })

    return NextResponse.json({
      data: {
        active: isActive,
        chains: chainStats,
        oppsToday: oppsToday ?? 0,
        tablesReady: !tableErr,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
