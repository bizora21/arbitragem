import { NextResponse } from 'next/server'
import { fetchAllDEXPrices } from '@/lib/dex/price-monitor'
import { detectOpportunities } from '@/lib/dex/arbitrage-detector'
import { startDEXScheduler } from '@/lib/dex/dex-scheduler'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    // Garante que o scheduler está a correr
    startDEXScheduler()

    // Executa ciclo imediatamente (dados reais on-chain)
    const start = Date.now()
    const prices = await fetchAllDEXPrices()
    const opps   = await detectOpportunities(prices)
    const elapsed = Date.now() - start

    return NextResponse.json({
      success: true,
      prices:  prices.length,
      opps:    opps.length,
      elapsed,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
