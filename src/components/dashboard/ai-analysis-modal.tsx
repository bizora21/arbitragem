'use client'

import { useState } from 'react'
import { ArbitrageOpportunity, FundingRatePrediction } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RiskMeter } from './risk-meter'
import { getExchangeColor, formatFundingRate, formatPercent } from '@/lib/utils'
import { X, Brain, TrendingUp, TrendingDown, Minus, CheckCircle, XCircle, Clock } from 'lucide-react'

interface AIAnalysisModalProps {
  opportunity: ArbitrageOpportunity
  onClose: () => void
}

const REC_CONFIG = {
  ENTER: { icon: CheckCircle, color: 'text-emerald-400', label: 'ENTRAR', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  WAIT: { icon: Clock, color: 'text-yellow-400', label: 'AGUARDAR', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  EXIT: { icon: XCircle, color: 'text-red-400', label: 'SAIR', bg: 'bg-red-500/10 border-red-500/20' },
}

const TREND_ICONS = {
  UP: TrendingUp,
  DOWN: TrendingDown,
  STABLE: Minus,
}

export function AIAnalysisModal({ opportunity, onClose }: AIAnalysisModalProps) {
  const [prediction, setPrediction] = useState<FundingRatePrediction | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runAnalysis = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: opportunity.normalizedSymbol,
          exchange: opportunity.sellExchange,
          currentRate: opportunity.sellRate,
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setPrediction(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro na análise')
    } finally {
      setLoading(false)
    }
  }

  const rec = prediction ? REC_CONFIG[prediction.recommendation] : null
  const TrendIcon = prediction ? TREND_ICONS[prediction.trend] : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <Card className="border-slate-600">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-400" />
                Análise AI — {opportunity.symbol}
              </CardTitle>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Opportunity summary */}
            <div className="bg-slate-700/30 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Comprar perp em</div>
                  <Badge className={getExchangeColor(opportunity.buyExchange)}>
                    {opportunity.buyExchange} • {formatFundingRate(opportunity.buyRate)}
                  </Badge>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Vender perp em</div>
                  <Badge className={getExchangeColor(opportunity.sellExchange)}>
                    {opportunity.sellExchange} • {formatFundingRate(opportunity.sellRate)}
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center text-sm">
                <div>
                  <div className="text-xs text-slate-500">Diff</div>
                  <div className="font-mono text-emerald-400">{formatFundingRate(opportunity.fundingRateDiff)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Retorno anual</div>
                  <div className="font-mono text-emerald-400">{formatPercent(opportunity.annualizedReturn)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Risco</div>
                  <div className="font-mono">{opportunity.riskScore}/10</div>
                </div>
              </div>
            </div>

            {/* AI Analysis section */}
            {!prediction && !loading && (
              <div className="text-center py-6">
                <Brain className="w-12 h-12 text-purple-400/40 mx-auto mb-3" />
                <p className="text-slate-400 text-sm mb-4">
                  Clique para analisar padrões históricos e gerar predição de funding rate
                </p>
                <Button onClick={runAnalysis} className="gap-2">
                  <Brain className="w-4 h-4" />
                  Analisar com AI
                </Button>
              </div>
            )}

            {loading && (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Analisando padrões históricos...</p>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            {prediction && rec && TrendIcon && (
              <div className="space-y-4">
                {/* Recommendation */}
                <div className={`border rounded-lg p-4 ${rec.bg}`}>
                  <div className="flex items-center gap-3">
                    <rec.icon className={`w-8 h-8 ${rec.color}`} />
                    <div>
                      <div className="text-xs text-slate-400">Recomendação</div>
                      <div className={`text-xl font-bold ${rec.color}`}>{rec.label}</div>
                    </div>
                    <div className="ml-auto text-right">
                      <div className="text-xs text-slate-400">Confiança</div>
                      <div className="font-bold text-slate-200">{(prediction.confidence * 100).toFixed(0)}%</div>
                    </div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-700/30 rounded-lg p-3 text-center">
                    <div className="text-xs text-slate-500">Taxa Prevista</div>
                    <div className="font-mono font-semibold text-slate-200">
                      {formatFundingRate(prediction.predictedRate)}
                    </div>
                  </div>
                  <div className="bg-slate-700/30 rounded-lg p-3 text-center">
                    <div className="text-xs text-slate-500">Tendência</div>
                    <div className="flex items-center justify-center gap-1">
                      <TrendIcon className={`w-4 h-4 ${prediction.trend === 'UP' ? 'text-emerald-400' : prediction.trend === 'DOWN' ? 'text-red-400' : 'text-slate-400'}`} />
                      <span className="font-semibold text-sm text-slate-200">{prediction.trend}</span>
                    </div>
                  </div>
                  <div className="bg-slate-700/30 rounded-lg p-3 text-center">
                    <div className="text-xs text-slate-500">Anomalia</div>
                    <div className={`font-semibold text-sm ${prediction.anomalyDetected ? 'text-red-400' : 'text-emerald-400'}`}>
                      {prediction.anomalyDetected ? 'Sim' : 'Não'}
                    </div>
                  </div>
                </div>

                {/* Analysis text */}
                <div className="bg-slate-700/20 rounded-lg p-4">
                  <div className="text-xs text-slate-500 mb-2">Análise Detalhada</div>
                  <p className="text-sm text-slate-300 whitespace-pre-line leading-relaxed">
                    {prediction.analysis}
                  </p>
                </div>

                <Button onClick={runAnalysis} variant="outline" size="sm" className="w-full gap-2">
                  <Brain className="w-3.5 h-3.5" />
                  Reanalisar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
