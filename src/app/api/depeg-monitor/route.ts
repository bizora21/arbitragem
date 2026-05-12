import { NextResponse } from 'next/server'
import { getDepegStatus } from '@/lib/strategies/depeg-monitor'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const result = await getDepegStatus()
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: message, timestamp: new Date().toISOString() },
      { status: 500 }
    )
  }
}
