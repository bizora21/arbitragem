'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Activity, AlertTriangle, AlertCircle, CheckCircle2,
  RefreshCw, ExternalLink, ChevronDown, ChevronUp,
  TrendingDown, DollarSign, Zap, Shield,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface BotStats {
  total_borrowers:    number
  watchlist_count:    number
  hot_count:          number
  liquidatable_count: number
  total_debt_at_risk: number
  eth_price:          number
  simulations:        number
  executions:         number
  total_profit_usd:   number
  last_block:         number
  updated_at:         string
}

interface WatchEntry {
  address:        string
  health_factor:  number
  debt_usd:       number
  collateral_usd: number
  priority:       number
  status:         'liquidatable' | 'hot' | 'watching'
  updated_at:     string
}

interface Position {
  address:          string
  reserve:          string
  collateral_amount: number
  collateral_usd:   number
  debt_amount:      number
  debt_usd:         number
}

interface Alert {
  id:           string
  type:         string
  message:      string
  address:      string
  health_factor: number
  severity:     'critical' | 'warning' | 'info'
  created_at:   string
}

interface Liquidation {
  id:                  string
  user_address:        string
  collateral_symbol:   string
  debt_symbol:         string
  debt_covered:        number
  collateral_received: number
  profit_usd:          number
  tx_hash:             string
  status:              string
  created_at:          string
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtUsd(n: number | null | undefined) {
  if (!n) return '$0'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`
  return `$${n.toFixed(2)}`
}

function fmtAddr(addr: string) {
  return addr.slice(0, 6) + '…' + addr.slice(-4)
}

function fmtAge(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (sec < 60)  return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m`
  return `${Math.floor(sec / 3600)}h`
}

function basescanTx(hash: string)   { return `https://basescan.org/tx/${hash}` }
function basescanAddr(addr: string) { return `https://basescan.org/address/${addr}` }

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: WatchEntry['status'] }) {
  const map = {
    liquidatable: 'bg-red-500/20 text-red-400 border-red-500/40',
    hot:          'bg-orange-500/20 text-orange-400 border-orange-500/40',
    watching:     'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  }
  const label = {
    liquidatable: '🔴 LIQUIDÁVEL',
    hot:          '🟡 HOT',
    watching:     '🟢 Watch',
  }
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${map[status]}`}>
      {label[status]}
    </span>
  )
}

// ── HF Bar ────────────────────────────────────────────────────────────────────

function HFBar({ hf }: { hf: number }) {
  const pct   = Math.min(hf / 2, 1) * 100
  const color = hf < 1.0 ? 'bg-red-500' : hf < 1.1 ? 'bg-orange-400' : 'bg-emerald-500'
  const text  = hf < 1.0 ? 'text-red-400' : hf < 1.1 ? 'text-orange-400' : 'text-emerald-400'
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`font-mono text-xs font-bold ${text} w-12 text-right`}>
        {hf.toFixed(4)}
      </span>
    </div>
  )
}

// ── Severity badge ────────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: Alert['severity'] }) {
  const map = {
    critical: { cls: 'text-red-400 bg-red-400/10 border-red-500/30', icon: <AlertCircle className="w-3 h-3" /> },
    warning:  { cls: 'text-yellow-400 bg-yellow-400/10 border-yellow-500/30', icon: <AlertTriangle className="w-3 h-3" /> },
    info:     { cls: 'text-blue-400 bg-blue-400/10 border-blue-500/30', icon: <CheckCircle2 className="w-3 h-3" /> },
  }
  const { cls, icon } = map[severity]
  return (
    <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      {icon}
      {severity.toUpperCase()}
    </span>
  )
}

// ── Stats cards ───────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = 'text-slate-200' }: {
  label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function AaveLiquidationTab() {
  const [stats,        setStats]       = useState<BotStats | null>(null)
  const [watchlist,    setWatchlist]   = useState<WatchEntry[]>([])
  const [positions,    setPositions]   = useState<Record<string, Position[]>>({})
  const [alerts,       setAlerts]      = useState<Alert[]>([])
  const [liquidations, setLiquidations] = useState<Liquidation[]>([])
  const [loading,      setLoading]     = useState(true)
  const [lastUpdate,   setLastUpdate]  = useState<Date | null>(null)
  const [expandedRow,  setExpandedRow] = useState<string | null>(null)

  const supabase = createClient()

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, watchRes, alertsRes, liqRes] = await Promise.all([
        supabase.from('aave_bot_stats').select('*').eq('id', 1).single(),
        supabase.from('aave_watchlist').select('*').order('health_factor', { ascending: true }).limit(100),
        supabase.from('aave_alerts').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('aave_liquidations').select('*').order('created_at', { ascending: false }).limit(20),
      ])

      if (statsRes.data)    setStats(statsRes.data)
      if (watchRes.data)    setWatchlist(watchRes.data)
      if (alertsRes.data)   setAlerts(alertsRes.data)
      if (liqRes.data)      setLiquidations(liqRes.data)
      setLastUpdate(new Date())
    } catch (e) {
      console.error('Liquidation data fetch error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch positions for expanded row
  async function fetchPositions(addr: string) {
    const { data } = await supabase
      .from('aave_positions')
      .select('*')
      .eq('address', addr)
    if (data) {
      setPositions(prev => ({ ...prev, [addr]: data }))
    }
  }

  function toggleRow(addr: string) {
    if (expandedRow === addr) {
      setExpandedRow(null)
    } else {
      setExpandedRow(addr)
      if (!positions[addr]) fetchPositions(addr)
    }
  }

  useEffect(() => {
    fetchData()
    const iv = setInterval(fetchData, 10_000)
    return () => clearInterval(iv)
  }, [fetchData])

  const liquidatableCount = watchlist.filter(w => w.status === 'liquidatable').length
  const hotCount          = watchlist.filter(w => w.status === 'hot').length

  return (
    <div className="space-y-6">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            Aave V3 Monitor — Base Chain
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Liquidation bot · posições monitorizadas em tempo real
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-[10px] text-slate-600 font-mono">
              {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchData}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          label="ETH Price"
          value={`$${stats?.eth_price?.toFixed(0) ?? '—'}`}
          sub="via Aerodrome on-chain"
          color="text-blue-300"
        />
        <StatCard
          label="Borrowers indexados"
          value={String(stats?.total_borrowers ?? '—')}
          sub={`${stats?.last_block ? `bloco ${stats.last_block.toLocaleString()}` : ''}`}
        />
        <StatCard
          label="Watchlist"
          value={String(stats?.watchlist_count ?? '—')}
          sub={`${hotCount} hot · ${liquidatableCount} liquidáveis`}
          color={liquidatableCount > 0 ? 'text-red-400' : hotCount > 0 ? 'text-orange-400' : 'text-slate-200'}
        />
        <StatCard
          label="Dívida em risco"
          value={fmtUsd(stats?.total_debt_at_risk)}
          sub={`Bónus potencial: ${fmtUsd((stats?.total_debt_at_risk || 0) * 0.05)}`}
          color="text-yellow-400"
        />
        <StatCard
          label="Lucro total"
          value={fmtUsd(stats?.total_profit_usd)}
          sub={`${stats?.executions ?? 0} exec · ${stats?.simulations ?? 0} sims`}
          color="text-emerald-400"
        />
      </div>

      {/* Alertas recentes */}
      {alerts.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/40 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <h3 className="text-sm font-semibold text-slate-200">Alertas Recentes</h3>
          </div>
          <div className="divide-y divide-slate-700/30">
            {alerts.map((a, i) => (
              <div key={a.id ?? i} className="px-4 py-2.5 flex items-start gap-3 hover:bg-slate-700/20">
                <SeverityBadge severity={a.severity} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 truncate">{a.message}</p>
                  <a
                    href={basescanAddr(a.address)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-slate-500 font-mono hover:text-blue-400 transition-colors"
                  >
                    {fmtAddr(a.address)}
                  </a>
                </div>
                <span className="text-[10px] text-slate-600 shrink-0">{fmtAge(a.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Watchlist table */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-200">Watchlist</h3>
            <span className="text-xs text-slate-500">— ordenado por HF ↑</span>
          </div>
          {liquidatableCount > 0 && (
            <span className="text-xs font-bold text-red-400 bg-red-400/10 border border-red-500/30 px-2 py-0.5 rounded-full">
              {liquidatableCount} liquidáveis agora
            </span>
          )}
        </div>

        {loading && watchlist.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">A carregar dados do Supabase…</div>
        ) : watchlist.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-500 text-sm">Nenhuma posição na watchlist.</p>
            <p className="text-slate-600 text-xs mt-1">O bot ainda não detectou posições com HF &lt; 1.3.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700/50 text-slate-500">
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-left px-4 py-2 font-medium">Endereço</th>
                  <th className="text-left px-4 py-2 font-medium min-w-[180px]">Health Factor</th>
                  <th className="text-right px-4 py-2 font-medium">Dívida</th>
                  <th className="text-right px-4 py-2 font-medium">Colateral</th>
                  <th className="text-right px-4 py-2 font-medium">Actualizado</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {watchlist.map((w) => {
                  const isLiq      = w.status === 'liquidatable'
                  const isHot      = w.status === 'hot'
                  const rowBg      = isLiq ? 'bg-red-950/30' : isHot ? 'bg-orange-950/20' : ''
                  const isExpanded = expandedRow === w.address

                  return (
                    <>
                      <tr
                        key={w.address}
                        className={`border-b border-slate-700/20 hover:bg-slate-700/10 cursor-pointer transition-colors ${rowBg}`}
                        onClick={() => toggleRow(w.address)}
                      >
                        <td className="px-4 py-2.5">
                          <StatusBadge status={w.status} />
                        </td>
                        <td className="px-4 py-2.5">
                          <a
                            href={basescanAddr(w.address)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="font-mono text-blue-400 hover:text-blue-300 flex items-center gap-1"
                          >
                            {fmtAddr(w.address)}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                        <td className="px-4 py-2.5">
                          <HFBar hf={w.health_factor} />
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-200">
                          {fmtUsd(w.debt_usd)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-400">
                          {fmtUsd(w.collateral_usd)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-600">
                          {fmtAge(w.updated_at)}
                        </td>
                        <td className="px-2 py-2.5 text-slate-600">
                          {isExpanded
                            ? <ChevronUp className="w-3.5 h-3.5" />
                            : <ChevronDown className="w-3.5 h-3.5" />
                          }
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr key={`${w.address}-detail`} className={`border-b border-slate-700/30 ${rowBg}`}>
                          <td colSpan={7} className="px-4 pb-3 pt-1">
                            <div className="bg-slate-900/60 rounded-lg p-3">
                              <p className="text-[10px] text-slate-500 mb-2 font-semibold uppercase tracking-wide">Posições por reserve</p>
                              {positions[w.address] ? (
                                positions[w.address].length === 0 ? (
                                  <p className="text-xs text-slate-600">Sem dados de posição detalhados.</p>
                                ) : (
                                  <div className="space-y-1">
                                    {positions[w.address].map((p, i) => (
                                      <div key={i} className="flex items-center gap-4 text-xs font-mono">
                                        <span className="text-slate-300 w-12 font-bold">{p.reserve}</span>
                                        {p.collateral_usd > 0 && (
                                          <span className="text-emerald-400">
                                            +{fmtUsd(p.collateral_usd)} colateral
                                          </span>
                                        )}
                                        {p.debt_usd > 0 && (
                                          <span className="text-red-400">
                                            −{fmtUsd(p.debt_usd)} dívida
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )
                              ) : (
                                <p className="text-xs text-slate-600 animate-pulse">A carregar posições…</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Liquidation history */}
      {liquidations.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/40 flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-200">Histórico de Liquidações</h3>
          </div>
          <div className="divide-y divide-slate-700/30">
            {liquidations.map((liq, i) => (
              <div key={liq.id ?? i} className="px-4 py-3 flex items-center gap-4 hover:bg-slate-700/20">
                <div className="shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    liq.status === 'success'
                      ? 'text-emerald-400 bg-emerald-400/10 border-emerald-500/30'
                      : 'text-red-400 bg-red-400/10 border-red-500/30'
                  }`}>
                    {liq.status === 'success' ? '✅' : '❌'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-200 font-mono">
                    {liq.collateral_symbol} → {liq.debt_symbol}
                  </p>
                  <a
                    href={basescanAddr(liq.user_address)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-slate-500 hover:text-blue-400 font-mono"
                  >
                    {fmtAddr(liq.user_address)}
                  </a>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-emerald-400">{fmtUsd(liq.profit_usd)}</p>
                  <p className="text-[10px] text-slate-600">{fmtAge(liq.created_at)}</p>
                </div>
                {liq.tx_hash && (
                  <a
                    href={basescanTx(liq.tx_hash)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-600 hover:text-blue-400 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No data state */}
      {!loading && !stats && (
        <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-8 text-center space-y-2">
          <Activity className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-slate-400 text-sm font-medium">Sem dados do bot ainda</p>
          <p className="text-slate-600 text-xs max-w-sm mx-auto">
            Cria as tabelas no Supabase, preenche as variáveis de ambiente no bot e inicia-o com <code className="font-mono bg-slate-900/80 px-1 py-0.5 rounded">node bot.mjs</code>.
          </p>
        </div>
      )}

      <p className="text-[10px] text-slate-700 text-center">
        Dados em tempo real via Supabase · Refresh automático a cada 10s · Bot corre localmente
      </p>
    </div>
  )
}
