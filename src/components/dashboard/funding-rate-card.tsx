'use client'

import { formatFundingRate, getFundingRateColor, getExchangeColor, formatCountdown, getSecondsUntilFunding } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Exchange } from '@/types'
import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface FundingRateRow {
  symbol: string
  OKX: number | null
  BINANCE: number | null
  BYBIT: number | null
  bestDiff: number
  nextFundingTime: string | null
}

interface FundingRateTableProps {
  data: FundingRateRow[]
  onSelectSymbol?: (symbol: string) => void
}

function RateCell({ rate, exchange }: { rate: number | null; exchange: Exchange }) {
  if (rate === null) return <span className="text-slate-600">—</span>
  const Icon = rate > 0.0001 ? TrendingUp : rate < -0.0001 ? TrendingDown : Minus
  return (
    <div className="flex items-center gap-1">
      <Icon className={`w-3 h-3 ${getFundingRateColor(rate)}`} />
      <span className={`font-mono text-sm ${getFundingRateColor(rate)}`}>
        {formatFundingRate(rate)}
      </span>
    </div>
  )
}

function CountdownCell({ nextFundingTime }: { nextFundingTime: string | null }) {
  const [seconds, setSeconds] = useState(() =>
    getSecondsUntilFunding(nextFundingTime ? new Date(nextFundingTime) : null)
  )

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(getSecondsUntilFunding(nextFundingTime ? new Date(nextFundingTime) : null))
    }, 1000)
    return () => clearInterval(interval)
  }, [nextFundingTime])

  if (!nextFundingTime) return <span className="text-slate-600">—</span>

  return (
    <span className="font-mono text-sm text-slate-300">
      {formatCountdown(seconds)}
    </span>
  )
}

export function FundingRateTable({ data, onSelectSymbol }: FundingRateTableProps) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/50 bg-slate-800/80">
              <th className="text-left p-3 font-medium text-slate-400">Moeda</th>
              <th className="text-right p-3 font-medium">
                <Badge className={getExchangeColor('OKX')}>OKX</Badge>
              </th>
              <th className="text-right p-3 font-medium">
                <Badge className={getExchangeColor('BINANCE')}>Binance</Badge>
              </th>
              <th className="text-right p-3 font-medium">
                <Badge className={getExchangeColor('BYBIT')}>Bybit</Badge>
              </th>
              <th className="text-right p-3 font-medium text-slate-400">Melhor Diff</th>
              <th className="text-right p-3 font-medium text-slate-400">Próx. Funding</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={row.symbol}
                className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors cursor-pointer"
                onClick={() => onSelectSymbol?.(row.symbol)}
              >
                <td className="p-3 font-semibold text-slate-200">
                  {row.symbol.replace('USDT', '')}/USDT
                </td>
                <td className="p-3 text-right">
                  <RateCell rate={row.OKX} exchange="OKX" />
                </td>
                <td className="p-3 text-right">
                  <RateCell rate={row.BINANCE} exchange="BINANCE" />
                </td>
                <td className="p-3 text-right">
                  <RateCell rate={row.BYBIT} exchange="BYBIT" />
                </td>
                <td className="p-3 text-right">
                  <span className={`font-mono font-semibold ${row.bestDiff > 0.001 ? 'text-emerald-400' : 'text-slate-300'}`}>
                    {formatFundingRate(row.bestDiff)}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <CountdownCell nextFundingTime={row.nextFundingTime} />
                </td>
                <td className="p-3">
                  <button
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    onClick={(e) => { e.stopPropagation(); onSelectSymbol?.(row.symbol) }}
                  >
                    Ver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            Carregando funding rates...
          </div>
        )}
      </div>
    </Card>
  )
}
