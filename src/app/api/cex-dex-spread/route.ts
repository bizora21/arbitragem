import { NextResponse } from 'next/server'
import { getCexDexSpreads } from '@/lib/strategies/spread-monitor'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const result = await getCexDexSpreads()
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: message, timestamp: new Date().toISOString() },
      { status: 500 }
    )
  }
}
