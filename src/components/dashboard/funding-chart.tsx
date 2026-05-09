'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatFundingRate } from '@/lib/utils'

interface ChartPoint {
  timestamp: string
  OKX?: number
  BINANCE?: number
  BYBIT?: number
}

interface FundingChartProps {
  symbol: string
}

const EXCHANGE_COLORS = {
  OKX: '#3b82f6',
  BINANCE: '#eab308',
  BYBIT: '#f97316',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-slate-400 mb-2">{new Date(label).toLocaleString('pt-BR')}</p>
      {payload.map((entry: { name: string; color: string; value: number }) => (
        <p key={entry.name} style={{ color: entry.color }} className="font-mono">
          {entry.name}: {formatFundingRate(entry.value)}
        </p>
      ))}
    </div>
  )
}

export function FundingChart({ symbol }: FundingChartProps) {
  const [data, setData] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/history?symbol=${symbol}&limit=100`)
      if (!res.ok) throw new Error('Falha ao carregar histórico')
      const json = await res.json()
      setData(json.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [symbol])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          Histórico de Funding Rate — {symbol.replace('USDT', '')}/USDT
          <button
            onClick={fetchHistory}
            className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Atualizar
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="h-64 flex items-center justify-center text-slate-500">
            Carregando histórico...
          </div>
        )}
        {error && (
          <div className="h-64 flex items-center justify-center text-red-400 text-sm">
            {error}
          </div>
        )}
        {!loading && !error && (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(v) => new Date(v).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
              />
              <YAxis
                tickFormatter={(v) => `${(v * 100).toFixed(3)}%`}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={70}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: '12px' }}
                formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{value}</span>}
              />
              {(['OKX', 'BINANCE', 'BYBIT'] as const).map((exchange) => (
                <Line
                  key={exchange}
                  type="monotone"
                  dataKey={exchange}
                  stroke={EXCHANGE_COLORS[exchange]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
        {!loading && !error && data.length === 0 && (
          <div className="h-64 flex items-center justify-center text-slate-500">
            Sem dados históricos disponíveis
          </div>
        )}
      </CardContent>
    </Card>
  )
}
