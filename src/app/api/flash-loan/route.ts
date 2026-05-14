import { NextResponse } from 'next/server'
import { scanFlashLoanOpportunities } from '@/lib/strategies/flash-loan-scanner'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const result = await scanFlashLoanOpportunities()
    return NextResponse.json({
      opportunities: result.opportunities,
      scannedAt: result.scannedAt,
      totalScanned: result.totalScanned,
      profitableCount: result.profitableCount,
      bestEdgeBp: result.bestEdgeBp,
    })
  } catch (error: any) {
    console.error('Flash loan scan error:', error)
    return NextResponse.json({
      opportunities: [],
      scannedAt: new Date().toISOString(),
      totalScanned: 0,
      profitableCount: 0,
      bestEdgeBp: 0,
      error: error?.message || 'Erro ao escanear oportunidades',
    })
  }
}

export async function POST() {
  try {
    const result = await scanFlashLoanOpportunities()
    return NextResponse.json({
      opportunities: result.opportunities,
      scannedAt: result.scannedAt,
      totalScanned: result.totalScanned,
      profitableCount: result.profitableCount,
      bestEdgeBp: result.bestEdgeBp,
    })
  } catch (error: any) {
    console.error('Flash loan scan error:', error)
    return NextResponse.json({
      opportunities: [],
      scannedAt: new Date().toISOString(),
      totalScanned: 0,
      profitableCount: 0,
      bestEdgeBp: 0,
      error: error?.message || 'Erro ao escanear oportunidades',
    })
  }
}
