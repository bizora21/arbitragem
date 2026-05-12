import { NextRequest, NextResponse } from 'next/server'
import { analyzeOpportunity, verifyAirdrop } from '@/lib/strategies/ai-advisor'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { protocol, tvl, chain, id } = await request.json()
    if (!protocol || !chain) {
      return NextResponse.json({ error: 'protocol and chain required' }, { status: 400 })
    }

    const [analysis, verification] = await Promise.all([
      analyzeOpportunity({ protocol, chain, apy: 0, tvl: tvl ?? 0, type: 'AIRDROP' }),
      verifyAirdrop(protocol, tvl ?? 0, chain),
    ])

    const aiAnalysis = JSON.stringify({
      recommendation: analysis.recommendation,
      reasoning: analysis.reasoning,
      risks: analysis.risks,
      isLegit: verification.isLegit,
      verifyAnalysis: verification.analysis,
      score: analysis.score,
    })

    const confidenceScore = Math.round((verification.confidenceScore + analysis.score) / 2)

    // Persist back to DB if we have an id
    if (id) {
      await supabaseAdmin
        .from('AirdropCandidate')
        .update({ aiAnalysis, confidenceScore, updatedAt: new Date().toISOString() })
        .eq('id', id)
    }

    return NextResponse.json({ analysis, verification, aiAnalysis, confidenceScore })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
