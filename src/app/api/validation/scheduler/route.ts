import { NextResponse } from 'next/server'
import { startScheduler, stopScheduler, getStatus } from '@/lib/edge-tracker/scheduler'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ data: getStatus(), timestamp: new Date().toISOString() })
}

export async function POST(request: Request) {
  try {
    const { action } = await request.json()
    if (action === 'start') {
      startScheduler()
      return NextResponse.json({ success: true, status: getStatus(), timestamp: new Date().toISOString() })
    }
    if (action === 'stop') {
      stopScheduler()
      return NextResponse.json({ success: true, status: getStatus(), timestamp: new Date().toISOString() })
    }
    return NextResponse.json({ error: 'Acção inválida. Use "start" ou "stop".' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message, timestamp: new Date().toISOString() }, { status: 500 })
  }
}
