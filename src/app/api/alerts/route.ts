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
      .from('Alert')
      .select('*')
      .eq('userId', user.id)
      .order('createdAt', { ascending: false })
      .limit(50)

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
    const { type, symbol, exchange, message, threshold } = body

    if (!type || !symbol || !exchange || !message) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: type, symbol, exchange, message' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('Alert')
      .insert({
        userId: user.id,
        type,
        symbol,
        exchange,
        message,
        threshold: threshold ?? null,
        triggered: false,
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

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Parâmetro id obrigatório' }, { status: 400 })
    }

    // Verifica que o alerta pertence ao utilizador antes de apagar
    const { error } = await supabaseAdmin
      .from('Alert')
      .delete()
      .eq('id', id)
      .eq('userId', user.id)

    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true, timestamp: new Date().toISOString() })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message, timestamp: new Date().toISOString() }, { status: 500 })
  }
}
