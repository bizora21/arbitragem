import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Último snapshot de cada chain+dex+par
    const since = new Date(Date.now() - 5 * 60_000).toISOString() // últimos 5 min

    const { data, error } = await supabaseAdmin
      .from('DEXPriceSnapshot')
      .select('*')
      .gte('timestamp', since)
      .order('timestamp', { ascending: false })

    if (error) throw new Error(error.message)

    // Deduplicar: manter apenas o mais recente por chain+dex+par
    const seen = new Set<string>()
    const latest = (data ?? []).filter(row => {
      const key = `${row.chain}|${row.dexName}|${row.tokenA}-${row.tokenB}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return NextResponse.json({ data: latest, timestamp: new Date().toISOString() })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
