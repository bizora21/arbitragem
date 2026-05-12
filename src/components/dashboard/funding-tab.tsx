'use client'

import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, TrendingDown, Minus, RefreshCw, AlertCircle } from 'lucide-react'
import { formatFundingRate, getFundingRateColor, getExchangeColor, formatCountdown, getSecondsUntilFunding } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { StrategyValidationPanel } from './strategy-validation-panel'
import { CapitalBadge } from '@/components/CapitalBadge'
import { ReturnSimulator } from '@/components/ReturnSimulator'
import { PaperTradePanel } from '@/components/PaperTradePanel'

interface FundingRow {
  symbol: string
  OKX: number | null
  BINANCE: number | null
  BYBIT: number | null
  bestDiff: number
  annualizedReturn: number
  nextFundingTime: string | null
}

interface Opportunity {
  id: string
  symbol: string
  buyExchange: string
  sellExchange: string
  fundingRateDiff: number
  annualizedReturn: number
  riskScore: number
  netProfitPerPeriod: number
  positionSizeUSD: number
}

interface FundingData {
  data?: FundingRow[]
  error?: string
  timestamp?: string
}

interface OppsData {
  data?: Opportunity[]
  error?: string
}

function RateCell({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-slate-600">—</span>
  const Icon = rate > 0.0001 ? TrendingUp : rate < -0.0001 ? TrendingDown : Minus
  return (
    <div className="flex items-center justify-end gap-1">
      <Icon className={`w-3 h-3 ${getFundingRateColor(rate)}`} />
      <span className={`font-mono text-sm ${getFundingRateColor(rate)}`}>
        {formatFundingRate(rate)}
      </span>
    </div>
  )
}

function CountdownCell({ ts }: { ts: string | null }) {
  const [seconds, setSeconds] = useState(() =>
    getSecondsUntilFunding(ts ? new Date(ts) : null)
  )
  useEffect(() => {
    const iv = setInterval(
      () => setSeconds(getSecondsUntilFunding(ts ? new Date(ts) : null)),
      1000
    )
    return () => clearInterval(iv)
  }, [ts])
  if (!ts) return <span className="text-slate-600">—</span>
  return <span className="font-mono text-sm text-slate-300">{formatCountdown(seconds)}</span>
}

export function FundingTab() {
  const [fundingData, setFundingData] = useState<FundingData | null>(null)
  const [oppsData, setOppsData] = useState<OppsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    const [f, o] = await Promise.allSettled([
      fetch('/api/funding-rates').then((r) => r.json()),
      fetch('/api/opportunities?capital=5&limit=10').then((r) => r.json()),
    ])

    if (f.status === 'fulfilled') setFundingData(f.value)
    if (o.status === 'fulfilled') setOppsData(o.value)

    setLastUpdate(new Date())
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    fetchData()
    const iv = setInterval(() => fetchData(true), 5 * 60_000)
    return () => clearInterval(iv)
  }, [fetchData])

  const rows = fundingData?.data ?? []
  const opps = oppsData?.data ?? []
  const hasError = !!fundingData?.error

  const bestReturn = opps.length > 0
    ? Math.max(...opps.map((o) => o.annualizedReturn ?? 0))
    : null

  return (
    <div className="space-y-6">
      <StrategyValidationPanel
        strategy="FUNDING"
        label="Funding Rate Arbitrage"
        icon="⚡"
        timestamp={fundingData?.timestamp ?? null}
        loading={loading}
        error={hasError}
        opportunityCount={opps.length}
        bestValueLabel={bestReturn != null && bestReturn > 0 ? `${bestReturn.toFixed(1)}% APY` : null}
        sources={['OKX', 'Binance', 'Bybit']}
        alerts={{
          urgent: opps.filter((o) => (o.annualizedReturn ?? 0) > 50).length,
          high:   opps.filter((o) => { const r = o.annualizedReturn ?? 0; return r > 30 && r <= 50 }).length,
          medium: opps.filter((o) => { const r = o.annualizedReturn ?? 0; return r > 10 && r <= 30 }).length,
        }}
        dataConfidence="HIGH"
      />

      <div className="flex flex-wrap items-center gap-3">
        <CapitalBadge strategy="FUNDING" />
        <ReturnSimulator strategy="FUNDING" />
      </div>

      <PaperTradePanel strategy="FUNDING" />

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-500 text-sm">A recolher funding rates de OKX, Binance, Bybit...</p>
          </div>
        </div>
      )}

      {!loading && hasError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-semibold">Erro ao recolher dados</p>
            <p className="text-red-300 text-sm mt-1 font-mono">{fundingData?.error}</p>
          </div>
        </div>
      )}

      {!loading && !hasError && (
        <>
          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Pares monitorados</p>
              <p className="text-2xl font-bold text-slate-200">{rows.length}</p>
            </div>
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Oportunidades {'>'}10% APY</p>
              <p className="text-2xl font-bold text-emerald-400">{opps.length}</p>
            </div>
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Melhor retorno anual</p>
              <p className="text-2xl font-bold text-yellow-400">
                {bestReturn != null && bestReturn > 0 ? `${bestReturn.toFixed(1)}%` : '—'}
              </p>
            </div>
          </div>

          {/* Top opportunities */}
          {opps.length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                Oportunidades delta-neutral ativas
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {opps.slice(0, 4).map((opp) => (
                  <div
                    key={opp.id}
                    className="bg-slate-800/60 border border-emerald-500/20 rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-semibold text-slate-200">{opp.symbol}</span>
                      <span className="text-emerald-400 font-bold text-lg">
                        {(opp.annualizedReturn ?? 0).toFixed(1)}% APY
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Badge className={getExchangeColor(opp.buyExchange as 'OKX' | 'BINANCE' | 'BYBIT')}>
                        LONG {opp.buyExchange}
                      </Badge>
                      <span>→</span>
                      <Badge className={getExchangeColor(opp.sellExchange as 'OKX' | 'BINANCE' | 'BYBIT')}>
                        SHORT {opp.sellExchange}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                      <span>Diff: {formatFundingRate(opp.fundingRateDiff)}</span>
                      <span>Risco: {opp.riskScore}/10</span>
                      <span>Capital: ${opp.positionSizeUSD}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full rate table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-200">Funding Rates por Moeda</h3>
              <button
                onClick={() => fetchData(true)}
                disabled={refreshing}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/50 bg-slate-900/50">
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
                      <th className="text-right p-3 text-slate-400 font-medium">Melhor Diff</th>
                      <th className="text-right p-3 text-slate-400 font-medium">APY Est.</th>
                      <th className="text-right p-3 text-slate-400 font-medium">Próx. Funding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 40).map((row) => (
                      <tr key={row.symbol} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                        <td className="p-3 font-semibold text-slate-200">
                          {row.symbol.replace('USDT', '')}/USDT
                        </td>
                        <td className="p-3 text-right"><RateCell rate={row.OKX} /></td>
                        <td className="p-3 text-right"><RateCell rate={row.BINANCE} /></td>
                        <td className="p-3 text-right"><RateCell rate={row.BYBIT} /></td>
                        <td className="p-3 text-right">
                          <span className={`font-mono font-semibold ${row.bestDiff > 0.001 ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {formatFundingRate(row.bestDiff)}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <span className={`font-mono text-xs ${(row.annualizedReturn ?? 0) > 10 ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {(row.annualizedReturn ?? 0).toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <CountdownCell ts={row.nextFundingTime} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length === 0 && (
                  <p className="p-8 text-center text-slate-500">Nenhum dado disponível</p>
                )}
              </div>
            </div>
          </div>

          {lastUpdate && (
            <p className="text-xs text-slate-700 text-right">
              Actualizado: {lastUpdate.toLocaleTimeString('pt-BR')} · Próxima atualização: 5 min
            </p>
          )}
        </>
      )}
    </div>
  )
}
