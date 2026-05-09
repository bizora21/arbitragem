import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

export async function GET(_request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data, error } = await supabaseAdmin
      .from('Position')
      .select('*')
      .eq('userId', user.id)
      .eq('status', 'OPEN')
      .order('openedAt', { ascending: false })

    if (error) throw new Error(error.message)

    return NextResponse.json({ data: data ?? [], timestamp: new Date().toISOString() })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message, timestamp: new Date().toISOString() }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { symbol, exchange, side, spotEntryPrice, perpEntryPrice, positionSize } = body

    if (!symbol || !exchange || !side || !spotEntryPrice || !perpEntryPrice || !positionSize) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: symbol, exchange, side, spotEntryPrice, perpEntryPrice, positionSize' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('Position')
      .insert({
        userId: user.id,
        symbol,
        exchange,
        side,
        spotEntryPrice,
        perpEntryPrice,
        positionSize,
        fundingEarned: 0,
        totalFeesPaid: 0,
        pnl: 0,
        status: 'OPEN',
      })
      .select()
      .single()

    if (error) throw new Error(error.message)

    return NextResponse.json({ data, timestamp: new Date().toISOString() })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message, timestamp: new Date().toISOString() }, { status: 500 })
  }
}
