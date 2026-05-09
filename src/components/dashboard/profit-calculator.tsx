'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { calculateArbitrageProfit } from '@/lib/analyzer/profit-calculator'
import { EXCHANGE_FEES, Exchange } from '@/types'
import { formatUSD, formatPercent } from '@/lib/utils'
import { Calculator } from 'lucide-react'

interface ProfitCalculatorProps {
  initialFundingRate?: number
  initialExchange?: Exchange
}

export function ProfitCalculator({ initialFundingRate = 0.0003, initialExchange = 'OKX' }: ProfitCalculatorProps) {
  const [capital, setCapital] = useState(5)
  const [fundingRate, setFundingRate] = useState(initialFundingRate * 100) // as percent
  const [exchange, setExchange] = useState<Exchange>(initialExchange)
  const [leverage, setLeverage] = useState(1)

  const result = useMemo(() => {
    const fees = EXCHANGE_FEES[exchange]
    return calculateArbitrageProfit({
      fundingRate: fundingRate / 100,
      positionSizeUSD: capital,
      spotMakerFee: fees.spotMaker,
      perpMakerFee: fees.perpMaker,
      spreadPercent: 0.05,
      leverage,
    })
  }, [capital, fundingRate, exchange, leverage])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="w-4 h-4 text-blue-400" />
          Calculadora de Lucro
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Capital (USD)</label>
            <input
              type="number"
              min={5}
              step={1}
              value={capital}
              onChange={(e) => setCapital(parseFloat(e.target.value) || 5)}
              className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Funding Rate (%)</label>
            <input
              type="number"
              min={0}
              step={0.001}
              value={fundingRate}
              onChange={(e) => setFundingRate(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Exchange</label>
            <select
              value={exchange}
              onChange={(e) => setExchange(e.target.value as Exchange)}
              className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="OKX">OKX</option>
              <option value="BINANCE">Binance</option>
              <option value="BYBIT">Bybit</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Alavancagem</label>
            <input
              type="number"
              min={1}
              max={10}
              step={1}
              value={leverage}
              onChange={(e) => setLeverage(parseInt(e.target.value) || 1)}
              className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="border-t border-slate-700/50 pt-3 grid grid-cols-2 gap-3">
          <div className="bg-slate-700/30 rounded-lg p-3">
            <div className="text-xs text-slate-500 mb-1">Ganho por período (8h)</div>
            <div className="font-mono text-emerald-400 font-semibold">
              {formatUSD(result.fundingPerPeriod)}
            </div>
          </div>
          <div className="bg-slate-700/30 rounded-lg p-3">
            <div className="text-xs text-slate-500 mb-1">Custo de entrada</div>
            <div className="font-mono text-red-400 font-semibold">
              {formatUSD(result.entryCost)}
            </div>
          </div>
          <div className="bg-slate-700/30 rounded-lg p-3">
            <div className="text-xs text-slate-500 mb-1">Break-even</div>
            <div className="font-mono text-slate-200 font-semibold">
              {result.breakEvenDays.toFixed(1)} dias
            </div>
          </div>
          <div className="bg-slate-700/30 rounded-lg p-3">
            <div className="text-xs text-slate-500 mb-1">Retorno mensal</div>
            <div className="font-mono text-blue-400 font-semibold">
              {formatPercent(result.monthlyReturn)}
            </div>
          </div>
        </div>

        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 flex justify-between items-center">
          <div>
            <div className="text-xs text-emerald-400 mb-0.5">Lucro anualizado</div>
            <div className="text-2xl font-bold text-emerald-400">{formatPercent(result.annualizedReturn)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400 mb-0.5">Lucro mensal</div>
            <div className="text-lg font-bold text-emerald-300">{formatUSD(result.monthlyProfitUSD)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
