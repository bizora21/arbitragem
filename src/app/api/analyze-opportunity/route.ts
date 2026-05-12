import { NextRequest, NextResponse } from 'next/server'
import { analyzeOpportunity } from '@/lib/strategies/ai-advisor'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { protocol, chain, apy, tvl, type } = await request.json()
    if (!protocol || !chain || !type) {
      return NextResponse.json({ error: 'protocol, chain and type required' }, { status: 400 })
    }
    const analysis = await analyzeOpportunity({ protocol, chain, apy: apy ?? 0, tvl: tvl ?? 0, type })
    return NextResponse.json({ analysis })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
