'use client'

import { ArbitrageOpportunity } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getExchangeColor, getRiskColor, formatFundingRate, formatPercent, formatUSD } from '@/lib/utils'
import { TrendingUp, AlertTriangle, Zap, ArrowRight } from 'lucide-react'

interface OpportunityCardProps {
  opportunity: ArbitrageOpportunity
  capital: number
  onAnalyze?: (opportunity: ArbitrageOpportunity) => void
}

export function OpportunityCard({ opportunity, capital, onAnalyze }: OpportunityCardProps) {
  const {
    symbol,
    buyExchange,
    sellExchange,
    fundingRateDiff,
    annualizedReturn,
    riskScore,
    netProfitPerPeriod,
    breakEvenDays,
    monthlyReturn,
    monthlyProfitUSD,
  } = opportunity

  const scaledMonthly = (monthlyProfitUSD / opportunity.positionSizeUSD) * capital

  return (
    <Card className="relative overflow-hidden group hover:border-slate-600/70 transition-all duration-200">
      {annualizedReturn > 100 && (
        <div className="absolute top-0 right-0 w-20 h-20 overflow-hidden">
          <div className="absolute top-3 right-[-20px] bg-emerald-500 text-white text-xs font-bold px-6 py-0.5 rotate-45">
            HOT
          </div>
        </div>
      )}

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{symbol}</CardTitle>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge className={getExchangeColor(buyExchange)}>{buyExchange}</Badge>
              <ArrowRight className="w-3 h-3 text-slate-500" />
              <Badge className={getExchangeColor(sellExchange)}>{sellExchange}</Badge>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-emerald-400">
              {formatPercent(annualizedReturn)}
            </div>
            <div className="text-xs text-slate-500">ao ano</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-700/30 rounded-lg p-2.5">
            <div className="text-xs text-slate-500 mb-0.5">Diff Funding</div>
            <div className="font-mono font-semibold text-slate-100">
              {formatFundingRate(fundingRateDiff)}
            </div>
            <div className="text-xs text-slate-500">por 8h</div>
          </div>

          <div className="bg-slate-700/30 rounded-lg p-2.5">
            <div className="text-xs text-slate-500 mb-0.5">Risco</div>
            <div className={`font-semibold text-lg ${getRiskColor(riskScore)}`}>
              {riskScore}/10
            </div>
            <div className="flex gap-0.5 mt-0.5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full ${
                    i < riskScore
                      ? riskScore <= 3 ? 'bg-emerald-500'
                        : riskScore <= 6 ? 'bg-yellow-500'
                        : 'bg-red-500'
                      : 'bg-slate-600'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-xs text-slate-500">Mensal</div>
            <div className="font-semibold text-slate-200">{formatPercent(monthlyReturn)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Lucro/mês</div>
            <div className="font-semibold text-emerald-400">
              {formatUSD(scaledMonthly)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Break-even</div>
            <div className="font-semibold text-slate-200">{breakEvenDays.toFixed(1)}d</div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-slate-700/50">
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Zap className="w-3 h-3" />
            {formatUSD(netProfitPerPeriod * 1000)} / 8h (por $1k)
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAnalyze?.(opportunity)}
            className="gap-1"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Analisar AI
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
