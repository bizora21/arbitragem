'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, AlertCircle, AlertTriangle, CheckCircle2, Wifi, WifiOff } from 'lucide-react'
import { StrategyValidationPanel } from './strategy-validation-panel'
import { CapitalBadge } from '@/components/CapitalBadge'
import { ReturnSimulator } from '@/components/ReturnSimulator'

interface SpreadData {
  symbol: string
  cexName: string
  cexPrice: number
  dexName: string
  dexPrice: number | null
  spreadPct: number | null
  direction: 'CEX_HIGHER' | 'DEX_HIGHER' | 'EQUAL' | null
  dexError: string | null
  dexSource: string | null
}

interface SpreadResult {
  spreads?: SpreadData[]
  alerts?: SpreadData[]
  dexStatus?: 'OK' | 'ERROR'
  dexStatusMsg?: string | null
  dexSource?: string | null
  dexSourceType?: string | null
  timestamp?: string
  error?: string
}

const CEX_COLORS: Record<string, string> = {
  BINANCE: 'text-yellow-400 bg-yellow-400/10 border-yellow-500/30',
  OKX:     'text-blue-400 bg-blue-400/10 border-blue-500/30',
}

function SpreadBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-slate-600 font-mono">—</span>
  const abs = Math.abs(pct)
  const color =
    abs > 0.5 ? 'text-red-400 bg-red-400/10 border-red-500/30' :
    abs > 0.2 ? 'text-yellow-400 bg-yellow-400/10 border-yellow-500/30' :
    'text-slate-400 bg-slate-400/10 border-slate-500/30'
  return (
    <span className={`font-mono text-xs px-2 py-0.5 rounded-full border ${color}`}>
      {pct > 0 ? '+' : ''}{pct.toFixed(4)}%
    </span>
  )
}

function DirectionBadge({ dir }: { dir: SpreadData['direction'] }) {
  if (!dir) return <span className="text-slate-600">—</span>
  const map = {
    CEX_HIGHER: { label: 'CEX > DEX', color: 'text-orange-400' },
    DEX_HIGHER: { label: 'DEX > CEX', color: 'text-blue-400' },
    EQUAL:      { label: 'Par',        color: 'text-slate-400' },
  }
  const { label, color } = map[dir]
  return <span className={`text-xs ${color}`}>{label}</span>
}

function fmtPrice(n: number, symbol: string) {
  if (symbol === 'BTC') return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function SpreadTab() {
  const [data, setData] = useState<SpreadResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const res = await fetch('/api/cex-dex-spread')
      const json = await res.json()
      setData(json)
    } catch {
      setData({ error: 'Falha ao conectar ao servidor' })
    }

    setLastUpdate(new Date())
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    fetchData()
    const iv = setInterval(() => fetchData(true), 2 * 60_000)
    return () => clearInterval(iv)
  }, [fetchData])

  const spreads   = data?.spreads ?? []
  const alertsArr = data?.alerts  ?? []
  const dexOk     = data?.dexStatus === 'OK'
  const hasError  = !!data?.error

  const maxSpread = spreads.reduce((m, s) => {
    if (s.spreadPct === null) return m
    return Math.abs(s.spreadPct) > m ? Math.abs(s.spreadPct) : m
  }, 0)

  const bySymbol = spreads.reduce((m, s) => {
    if (!m[s.symbol]) m[s.symbol] = []
    m[s.symbol].push(s)
    return m
  }, {} as Record<string, SpreadData[]>)

  const dexSourceLabel = data?.dexSource ?? 'DEX'

  return (
    <div className="space-y-6">
      <StrategyValidationPanel
        strategy="SPREAD"
        label="CEX-DEX Spread Monitor"
        icon="🔗"
        timestamp={data?.timestamp ?? null}
        loading={loading}
        error={hasError}
        opportunityCount={alertsArr.length}
        bestValueLabel={maxSpread > 0 ? `${maxSpread.toFixed(3)}% spread` : null}
        sources={['Binance', 'OKX']}
        dataSource={data?.dexSource ?? null}
        alerts={{
          urgent: alertsArr.filter((s) => Math.abs(s.spreadPct ?? 0) > 1).length,
          high:   alertsArr.filter((s) => { const a = Math.abs(s.spreadPct ?? 0); return a > 0.5 && a <= 1 }).length,
          medium: spreads.filter((s) => { const a = Math.abs(s.spreadPct ?? 0); return a > 0.2 && a <= 0.5 }).length,
        }}
        dataConfidence={dexOk ? 'HIGH' : 'MEDIUM'}
      />

      <div className="flex flex-wrap items-center gap-3">
        <CapitalBadge strategy="SPREAD" />
        <ReturnSimulator strategy="SPREAD" />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-500 text-sm">A recolher preços CEX e DEX on-chain...</p>
            <p className="text-slate-600 text-xs mt-1">Binance · OKX · DexScreener → DefiLlama → CoinGecko → QuoterV2</p>
          </div>
        </div>
      )}

      {!loading && hasError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-semibold">Erro ao recolher dados</p>
            <p className="text-red-300 text-sm mt-1 font-mono">{data?.error}</p>
          </div>
        </div>
      )}

      {!loading && !hasError && (
        <>
          {/* DEX connection status */}
          <div className={`rounded-xl border p-4 flex items-center gap-3 ${dexOk ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/30'}`}>
            {dexOk
              ? <Wifi className="w-4 h-4 text-emerald-400" />
              : <WifiOff className="w-4 h-4 text-red-400" />}
            <div className="flex-1">
              <p className={`text-sm font-semibold ${dexOk ? 'text-emerald-400' : 'text-red-400'}`}>
                DEX {dexOk ? 'conectado' : 'indisponível'}
                {dexOk && data?.dexSource && (
                  <span className="text-slate-500 font-normal ml-1">via {data.dexSource}</span>
                )}
              </p>
              {!dexOk && data?.dexStatusMsg && (
                <p className="text-xs text-red-300 mt-0.5 font-mono">{data.dexStatusMsg}</p>
              )}
            </div>
          </div>

          {/* Alert banner */}
          {alertsArr.length > 0 && (
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-orange-400 font-semibold">{alertsArr.length} spread{alertsArr.length > 1 ? 's' : ''} {'>'} 0.5%</p>
                <p className="text-orange-300 text-sm mt-1">
                  {alertsArr.map((a) => `${a.symbol} ${a.cexName} (${(a.spreadPct ?? 0) > 0 ? '+' : ''}${(a.spreadPct ?? 0).toFixed(3)}%)`).join(', ')}
                </p>
              </div>
            </div>
          )}

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Pares monitorados</p>
              <p className="text-2xl font-bold text-slate-200">{Object.keys(bySymbol).length}</p>
            </div>
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Spread máximo</p>
              <p className={`text-2xl font-bold ${maxSpread > 0.5 ? 'text-red-400' : maxSpread > 0.2 ? 'text-yellow-400' : 'text-slate-200'}`}>
                {maxSpread > 0 ? `${maxSpread.toFixed(3)}%` : '—'}
              </p>
            </div>
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Alertas {'>'} 0.5%</p>
              <p className={`text-2xl font-bold ${alertsArr.length > 0 ? 'text-orange-400' : 'text-slate-400'}`}>
                {alertsArr.length}
              </p>
            </div>
          </div>

          {/* Price summary per symbol */}
          {Object.keys(bySymbol).length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(bySymbol).map(([symbol, rows]) => {
                const dexRow   = rows.find((r) => r.dexPrice !== null)
                const dexPrice = dexRow?.dexPrice ?? null
                const dexError = dexRow?.dexError ?? null

                return (
                  <div key={symbol} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-slate-200 text-lg">{symbol}/USDT</h4>
                      {dexPrice !== null
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        : <AlertCircle  className="w-4 h-4 text-red-400" />}
                    </div>

                    <div className="space-y-2 mb-3">
                      {rows.map((r) => (
                        <div key={r.cexName} className="flex items-center justify-between text-sm">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${CEX_COLORS[r.cexName] ?? 'text-slate-400 border-slate-600'}`}>
                            {r.cexName}
                          </span>
                          <span className="font-mono text-slate-200">{fmtPrice(r.cexPrice, symbol)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-slate-700/50 pt-2 mt-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-xs px-2 py-0.5 rounded-full border text-purple-400 bg-purple-400/10 border-purple-500/30">
                          {dexSourceLabel}
                        </span>
                        {dexPrice !== null
                          ? <span className="font-mono text-slate-200">{fmtPrice(dexPrice, symbol)}</span>
                          : <span className="text-xs text-red-400 font-mono truncate max-w-48">{dexError ?? 'Indisponível'}</span>}
                      </div>
                    </div>

                    {dexPrice !== null && (
                      <div className="mt-3 space-y-1">
                        {rows.map((r) => r.spreadPct !== null && (
                          <div key={r.cexName} className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">{r.cexName} vs {dexSourceLabel}</span>
                            <div className="flex items-center gap-2">
                              <SpreadBadge pct={r.spreadPct} />
                              <DirectionBadge dir={r.direction} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Full table */}
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-slate-700/50">
              <h3 className="font-semibold text-slate-200 text-sm">Todos os spreads</h3>
              <button
                onClick={() => fetchData(true)}
                disabled={refreshing}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50 bg-slate-900/50">
                    <th className="text-left p-3 text-slate-400 font-medium">Ativo</th>
                    <th className="text-left p-3 text-slate-400 font-medium">CEX</th>
                    <th className="text-right p-3 text-slate-400 font-medium">Preço CEX</th>
                    <th className="text-right p-3 text-slate-400 font-medium">Preço DEX</th>
                    <th className="text-right p-3 text-slate-400 font-medium">Spread</th>
                    <th className="text-left p-3 text-slate-400 font-medium">Direção</th>
                  </tr>
                </thead>
                <tbody>
                  {spreads.map((s, i) => (
                    <tr key={i} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                      <td className="p-3 font-semibold text-slate-200">{s.symbol}/USDT</td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${CEX_COLORS[s.cexName] ?? 'text-slate-400 border-slate-600'}`}>
                          {s.cexName}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-slate-200">{fmtPrice(s.cexPrice, s.symbol)}</td>
                      <td className="p-3 text-right font-mono text-slate-300">
                        {s.dexPrice !== null ? fmtPrice(s.dexPrice, s.symbol) : (
                          <span className="text-xs text-red-400">indisponível</span>
                        )}
                      </td>
                      <td className="p-3 text-right"><SpreadBadge pct={s.spreadPct} /></td>
                      <td className="p-3"><DirectionBadge dir={s.direction} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {spreads.length === 0 && (
                <p className="p-8 text-center text-slate-500">Nenhum dado disponível</p>
              )}
            </div>
          </div>

          <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-4 text-xs text-slate-500">
            <p className="font-semibold text-slate-400 mb-1">Como funciona</p>
            <p>CEX vs DEX spread {'>'} 0.5% indica ineficiência temporária. Janela: minutos a horas.
            A convergência ocorre via arbitrageurs que compram no lado mais barato e vendem no mais caro.</p>
          </div>

          {lastUpdate && (
            <p className="text-xs text-slate-700 text-right">
              Actualizado: {lastUpdate.toLocaleTimeString('pt-BR')} · Atualiza cada 2 min
            </p>
          )}
        </>
      )}
    </div>
  )
}
