import { FundingRatePrediction, Exchange } from '@/types'
import { mean, stdDev } from '@/lib/utils'

interface PredictorInput {
  symbol: string
  exchange: Exchange
  historicalRates: number[]
  currentRate: number
}

function buildPrompt(input: PredictorInput): string {
  const { symbol, exchange, historicalRates, currentRate } = input
  const rates = historicalRates.slice(-30)
  const avg = mean(rates)
  const sd = stdDev(rates)

  return `Você é um especialista em funding rates de contratos perpétuos de criptomoedas.

Analise os dados de funding rate para ${symbol} na exchange ${exchange}:
- Taxa atual: ${(currentRate * 100).toFixed(6)}%
- Média histórica (30 períodos): ${(avg * 100).toFixed(6)}%
- Desvio padrão: ${(sd * 100).toFixed(6)}%
- Histórico (últimas 10 taxas): ${rates.slice(-10).map((r) => (r * 100).toFixed(4) + '%').join(', ')}

Responda APENAS com JSON válido neste formato:
{
  "predictedRate": <decimal, ex: 0.0003>,
  "confidence": <0 a 1>,
  "trend": "UP" | "DOWN" | "STABLE",
  "anomalyDetected": <boolean>,
  "recommendation": "ENTER" | "WAIT" | "EXIT",
  "analysis": "<análise em português em 2-3 frases>"
}`
}

function statisticalPredict(input: PredictorInput): FundingRatePrediction {
  const { symbol, exchange, historicalRates, currentRate } = input
  const rates = historicalRates.slice(-30)

  const avg = mean(rates)
  const sd = stdDev(rates)
  const trend30 = rates.length >= 2 ? (rates[rates.length - 1] - rates[0]) / rates.length : 0

  const predictedRate = currentRate + (avg - currentRate) * 0.3 + trend30 * 0.5
  const negCount = rates.filter((r) => r < 0).length
  const flipProb = rates.length > 0 ? negCount / rates.length : 0.3
  const confidence = Math.max(0.1, Math.min(0.9, 1 - sd / (Math.abs(avg) + 0.0001)))

  const trend: 'UP' | 'DOWN' | 'STABLE' =
    predictedRate > currentRate * 1.05 ? 'UP' : predictedRate < currentRate * 0.95 ? 'DOWN' : 'STABLE'

  const anomalyDetected = Math.abs(currentRate - avg) > 2 * sd

  let recommendation: 'ENTER' | 'WAIT' | 'EXIT' = 'WAIT'
  if (currentRate > 0.0003 && flipProb < 0.2 && !anomalyDetected) {
    recommendation = 'ENTER'
  } else if (flipProb > 0.4 || (anomalyDetected && trend === 'DOWN')) {
    recommendation = 'EXIT'
  }

  const analysis = [
    `Funding rate atual: ${(currentRate * 100).toFixed(4)}% (média histórica: ${(avg * 100).toFixed(4)}%)`,
    `Volatilidade: ${(sd * 100).toFixed(4)}% | Probabilidade de flip: ${(flipProb * 100).toFixed(1)}%`,
    anomalyDetected ? 'Anomalia detectada: funding rate fora do padrão histórico.' : '',
    `Tendência prevista: ${trend}. Taxa prevista: ${(predictedRate * 100).toFixed(4)}%`,
    `Recomendação: ${recommendation === 'ENTER' ? 'ENTRAR na posição' : recommendation === 'EXIT' ? 'SAIR da posição' : 'AGUARDAR condições melhores'}`,
  ]
    .filter(Boolean)
    .join('\n')

  return {
    symbol,
    exchange,
    currentRate,
    predictedRate,
    confidence,
    trend,
    anomalyDetected,
    recommendation,
    analysis,
    predictedAt: new Date(),
  }
}

async function openAIPredict(input: PredictorInput): Promise<FundingRatePrediction | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: buildPrompt(input) }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 300,
      }),
    })

    if (!res.ok) return null

    const json = await res.json()
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? '{}')

    return {
      symbol: input.symbol,
      exchange: input.exchange,
      currentRate: input.currentRate,
      predictedRate: parsed.predictedRate ?? input.currentRate,
      confidence: parsed.confidence ?? 0.5,
      trend: parsed.trend ?? 'STABLE',
      anomalyDetected: parsed.anomalyDetected ?? false,
      recommendation: parsed.recommendation ?? 'WAIT',
      analysis: parsed.analysis ?? 'Análise indisponível.',
      predictedAt: new Date(),
    }
  } catch {
    return null
  }
}

async function zAIPredict(input: PredictorInput): Promise<FundingRatePrediction | null> {
  if (!process.env.Z_AI_API_KEY) return null

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const zai = (0, eval)('require')('z-ai-web-dev-sdk') as any
    const client = new zai.Client({ apiKey: process.env.Z_AI_API_KEY })
    const response = await client.chat({
      model: 'z-ai-web-dev',
      messages: [{ role: 'user', content: buildPrompt(input) }],
      response_format: { type: 'json_object' },
    })

    const parsed = JSON.parse(response.content ?? '{}')
    return {
      symbol: input.symbol,
      exchange: input.exchange,
      currentRate: input.currentRate,
      predictedRate: parsed.predictedRate ?? input.currentRate,
      confidence: parsed.confidence ?? 0.5,
      trend: parsed.trend ?? 'STABLE',
      anomalyDetected: parsed.anomalyDetected ?? false,
      recommendation: parsed.recommendation ?? 'WAIT',
      analysis: parsed.analysis ?? 'Análise indisponível.',
      predictedAt: new Date(),
    }
  } catch {
    return null
  }
}

export async function predictFundingRate(
  symbol: string,
  exchange: Exchange,
  historicalRates: number[],
  currentRate: number
): Promise<FundingRatePrediction> {
  const input: PredictorInput = { symbol, exchange, historicalRates, currentRate }

  const result =
    (await zAIPredict(input)) ??
    (await openAIPredict(input)) ??
    statisticalPredict(input)

  return result
}
