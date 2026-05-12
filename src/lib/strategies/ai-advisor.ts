// AI Advisor — uses OpenAI GPT-4o-mini via raw fetch.
// Falls back to heuristic scoring when OPENAI_API_KEY is not set.
// Cost: ~$0.001 per analysis (gpt-4o-mini)

export interface AIAnalysis {
  score: number          // 0–100
  recommendation: 'ENTER' | 'WATCH' | 'SKIP'
  reasoning: string
  risks: string[]
  estimatedAPY: number | null
}

export interface AirdropVerification {
  isLegit: boolean
  confidenceScore: number
  analysis: string
}

async function callOpenAI(
  prompt: string,
  model: 'gpt-4o-mini' | 'gpt-4o' = 'gpt-4o-mini'
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.1,
      }),
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.choices?.[0]?.message?.content ?? null
  } catch {
    return null
  }
}

function parseJSON<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0]) as T
  } catch { /* ignore */ }
  return fallback
}

// Heuristic score when OpenAI is unavailable
function heuristicScore(tvl: number, apy: number): number {
  let score = 50
  if (tvl > 500_000_000) score += 25
  else if (tvl > 50_000_000) score += 15
  else if (tvl > 5_000_000) score += 5
  if (apy > 50) score -= 20  // Suspicious APY
  else if (apy > 20) score -= 5
  else if (apy > 5) score += 10
  return Math.min(100, Math.max(0, score))
}

export async function analyzeOpportunity(params: {
  protocol: string
  chain: string
  apy: number
  tvl: number
  type: 'YIELD' | 'LP' | 'AIRDROP' | 'FUNDING' | 'DEPEG'
}): Promise<AIAnalysis> {
  const prompt = `You are a DeFi risk analyst. Analyze this opportunity and respond with JSON only.
Protocol: ${params.protocol}
Chain: ${params.chain}
APY: ${params.apy.toFixed(1)}%
TVL: $${(params.tvl / 1e6).toFixed(1)}M
Type: ${params.type}
Respond ONLY with JSON (no markdown): {"score":0-100,"recommendation":"ENTER"|"WATCH"|"SKIP","reasoning":"one sentence max 100 chars","risks":["risk1","risk2"],"estimatedAPY":number_or_null}`

  const raw = await callOpenAI(prompt)
  const parsed = parseJSON<Partial<AIAnalysis>>(raw, {})

  if (parsed.score !== undefined) {
    return {
      score: parsed.score ?? 50,
      recommendation: parsed.recommendation ?? 'WATCH',
      reasoning: parsed.reasoning ?? '',
      risks: parsed.risks ?? [],
      estimatedAPY: parsed.estimatedAPY ?? null,
    }
  }

  // Heuristic fallback
  const score = heuristicScore(params.tvl, params.apy)
  return {
    score,
    recommendation: score >= 70 ? 'ENTER' : score >= 50 ? 'WATCH' : 'SKIP',
    reasoning: 'Heuristic analysis (set OPENAI_API_KEY for AI scoring)',
    risks: params.apy > 30 ? ['High APY may be unsustainable'] : [],
    estimatedAPY: params.apy * 0.7,
  }
}

export async function verifyAirdrop(
  protocol: string,
  tvl: number,
  chain: string
): Promise<AirdropVerification> {
  const prompt = `DeFi protocol: "${protocol}" on ${chain}, TVL $${(tvl / 1e6).toFixed(1)}M, no token yet. Is this a legitimate airdrop farming candidate? Respond ONLY with JSON: {"isLegit":bool,"confidenceScore":0-100,"analysis":"one sentence max 80 chars"}`

  const raw = await callOpenAI(prompt)
  const parsed = parseJSON<Partial<AirdropVerification>>(raw, {})

  if (parsed.confidenceScore !== undefined) {
    return {
      isLegit: parsed.isLegit ?? true,
      confidenceScore: parsed.confidenceScore,
      analysis: parsed.analysis ?? '',
    }
  }

  // Heuristic fallback
  const isLegit = tvl > 5_000_000
  return {
    isLegit,
    confidenceScore: isLegit ? (tvl > 50e6 ? 70 : 55) : 25,
    analysis: 'Heuristic: based on TVL only (set OPENAI_API_KEY for AI scoring)',
  }
}

export async function generateRiskReport(
  protocol: string,
  chain: string,
  capital: number,
  apy: number
): Promise<{ report: string; overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' }> {
  const prompt = `DeFi risk report for: ${protocol} on ${chain}. Capital: $${capital}. APY: ${apy}%. Give a 2-sentence risk assessment and overall risk level. Respond ONLY with JSON: {"report":"2 sentences","overallRisk":"LOW"|"MEDIUM"|"HIGH"}`

  const raw = await callOpenAI(prompt, capital >= 200 ? 'gpt-4o' : 'gpt-4o-mini')
  const parsed = parseJSON<{ report?: string; overallRisk?: string }>(raw, {})

  return {
    report: parsed.report ?? `${protocol} on ${chain}: standard DeFi protocol risks apply.`,
    overallRisk: (parsed.overallRisk as 'LOW' | 'MEDIUM' | 'HIGH') ?? 'MEDIUM',
  }
}
