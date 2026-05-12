import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const hours = parseInt(searchParams.get('hours') ?? '24')
    const since = new Date(Date.now() - hours * 3600_000).toISOString()

    const { data, error } = await supabaseAdmin
      .from('DEXArbitrageOpportunity')
      .select('*')
      .gte('createdAt', since)
      .order('edgeNet', { ascending: false })
      .limit(100)

    if (error) throw new Error(error.message)

    return NextResponse.json({ data: data ?? [], timestamp: new Date().toISOString() })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
