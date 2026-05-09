import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const days  = parseInt(searchParams.get('days') ?? '30')
    const since = new Date(Date.now() - days * 86400_000).toISOString()

    const { data, error } = await supabaseAdmin
      .from('ValidationMetrics')
      .select('*')
      .gte('date', since)
      .order('date', { ascending: true })

    if (error) throw new Error(error.message)

    return NextResponse.json({ data: data ?? [], timestamp: new Date().toISOString() })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message, timestamp: new Date().toISOString() }, { status: 500 })
  }
}
