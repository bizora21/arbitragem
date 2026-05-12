'use client'

import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'

interface PaperTrade {
  id: string
  symbol: string
  exchangeLong: string
  exchangeShort: string
  spreadAtEntry: number
  pnlNet: number | null
  pnlGross: number | null
  positionSize: number
  status: 'open' | 'closed'
  openedAt: string
  closedAt: string | null
  closeReason: string | null
}

interface Stats {
  open: number
  closed: number
  winRate: number
  totalPnL: number
}

interface PaperTradePanelProps {
  strategy?: string
}

function fmt(n: number): string {
  const sign = n >= 0 ? '+' : ''
  return `${sign}$${Math.abs(n).toFixed(2)}`
}

function elapsed(from: string): string {
  const ms = Date.now() - new Date(from).getTime()
  const h = Math.floor(ms / 3600_000)
  if (h < 1) return `${Math.floor(ms / 60_000)}m`
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export function PaperTradePanel({ strategy }: PaperTradePanelProps) {
  const [trades, setTrades] = useState<PaperTrade[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const fetchTrades = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const params = new URLSearchParams({ limit: '20' })
      if (strategy) params.set('strategy', strategy)
      const res = await fetch(`/api/paper-trades?${params}`)
      const json = await res.json()
      setTrades(json.trades ?? [])
      setStats(json.stats ?? null)
    } catch {
      // silent
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [strategy])

  useEffect(() => {
    fetchTrades()
    const iv = setInterval(() => fetchTrades(true), 5 * 60_000)
    return () => clearInterval(iv)
  }, [fetchTrades])

  if (loading) return null

  const openTrades = trades.filter((t) => t.status === 'open')
  const closedTrades = trades.filter((t) => t.status === 'closed').slice(0, 5)

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/20 transition-colors"
      >
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-300 font-medium">Paper Trades</span>
          {stats && (
            <>
              <span className="text-slate-600">·</span>
              <span className="text-slate-500">
                {stats.open} abertos · {stats.winRate}% win · {' '}
                <span className={stats.totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {fmt(stats.totalPnL)}
                </span>
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {refreshing && <RefreshCw className="w-3 h-3 text-slate-500 animate-spin" />}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-700/40 divide-y divide-slate-700/30">
          {/* Accuracy bar */}
          {stats && stats.closed > 0 && (
            <div className="px-4 py-2 flex items-center gap-3 text-xs">
              <span className="text-slate-500">Accuracy</span>
              <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${stats.winRate}%` }}
                />
              </div>
              <span className={stats.winRate >= 60 ? 'text-emerald-400' : stats.winRate >= 40 ? 'text-yellow-400' : 'text-red-400'}>
                {stats.winRate}%
              </span>
              <span className="text-slate-600">({stats.closed} trades)</span>
            </div>
          )}

          {/* Open trades */}
          {openTrades.length > 0 && (
            <div className="px-4 py-2">
              <p className="text-xs text-slate-500 mb-2">Abertos</p>
              <div className="space-y-1.5">
                {openTrades.map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-slate-300 font-medium">{t.symbol}</span>
                      <span className="text-slate-600">{t.exchangeLong}↔{t.exchangeShort}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500">
                      <span>{elapsed(t.openedAt)}</span>
                      <span className="text-slate-600">${t.positionSize}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Closed trades */}
          {closedTrades.length > 0 && (
            <div className="px-4 py-2">
              <p className="text-xs text-slate-500 mb-2">Recentes</p>
              <div className="space-y-1.5">
                {closedTrades.map((t) => {
                  const pnl = t.pnlNet ?? 0
                  const isPositive = pnl >= 0
                  const Icon = isPositive ? TrendingUp : TrendingDown
                  return (
                    <div key={t.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-3 h-3 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`} />
                        <span className="text-slate-400">{t.symbol}</span>
                        <span className="text-slate-600 text-xs">{t.closeReason ?? 'closed'}</span>
                      </div>
                      <span className={`font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                        {fmt(pnl)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {trades.length === 0 && (
            <p className="px-4 py-4 text-xs text-slate-600 text-center">
              Aguardando primeiros paper trades (ciclo de 5min)...
            </p>
          )}
        </div>
      )}
    </div>
  )
}
