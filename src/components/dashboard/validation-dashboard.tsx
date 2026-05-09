'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  Activity, TrendingUp, TrendingDown, Minus,
  CheckCircle2, XCircle, Clock, RefreshCw, Play,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  PersistenceStats, FundingAccuracyStats, PaperTradingStats,
  GoNoGoReport, GoNoGoVerdict, PairRanking,
} from '@/types'

// ── tipos locais ──────────────────────────────────────────────

interface SchedulerStatus {
  running: boolean
  snapshotsToday: number
  lastSnapshot: string
}

interface SnapshotRow {
  edgeNet: number
  symbol: string
  exchangeA: string
  exchangeB: string
}

// ── utilitários de apresentação ───────────────────────────────

function pct(n: number) { return `${n}%` }
function fmt4(n: number) { return `${(n * 100).toFixed(4)}%` }
function fmtUSD(n: number) {
  const abs  = Math.abs(n)
  const sign = n < 0 ? '-' : n > 0 ? '+' : ''
  return `${sign}$${abs.toFixed(2)}`
}

function VerdictBadge({ verdict }: { verdict: GoNoGoVerdict }) {
  const cfg: Record<GoNoGoVerdict, { label: string; cls: string }> = {
    GO:         { label: '✅ GO',             cls: 'bg-emerald-900/40 text-emerald-400 border-emerald-700/50' },
    CAUTION:    { label: '⚠️ CAUTION',         cls: 'bg-yellow-900/40  text-yellow-400  border-yellow-700/50'  },
    NO_GO:      { label: '🚫 NO-GO',           cls: 'bg-red-900/40     text-red-400     border-red-700/50'     },
    COLLECTING: { label: '⏳ A RECOLHER DADOS', cls: 'bg-slate-800     text-slate-400   border-slate-700'      },
  }
  const { label, cls } = cfg[verdict]
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${cls}`}>
      {label}
    </span>
  )
}

function PersistenceBar({ label, pct: p, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 w-8 shrink-0">{label}</span>
      <div className="flex-1 bg-slate-800 rounded-full h-2.5 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(p, 100)}%` }} />
      </div>
      <span className="text-sm font-mono text-slate-300 w-10 text-right">{p}%</span>
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  )
}

// ── componente principal ──────────────────────────────────────

export function ValidationDashboard() {
  const [persistence, setPersistence]       = useState<PersistenceStats | null>(null)
  const [accuracy, setAccuracy]             = useState<FundingAccuracyStats | null>(null)
  const [paperStats, setPaperStats]         = useState<PaperTradingStats | null>(null)
  const [report, setReport]                 = useState<GoNoGoReport | null>(null)
  const [topPairs, setTopPairs]             = useState<PairRanking[]>([])
  const [scheduler, setScheduler]           = useState<SchedulerStatus | null>(null)
  const [edgeSnapshots, setEdgeSnapshots]   = useState<SnapshotRow[]>([])
  const [paperTrades, setPaperTrades]       = useState<Record<string, unknown>[]>([])
  const [loading, setLoading]               = useState(true)
  const [refreshing, setRefreshing]         = useState(false)
  const [starting, setStarting]             = useState(false)

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    const [persRes, accRes, paperRes, reportRes, pairsRes, schedRes, snapRes] =
      await Promise.allSettled([
        fetch('/api/validation/persistence?days=7').then((r) => r.json()),
        fetch('/api/validation/funding-accuracy?days=7').then((r) => r.json()),
        fetch('/api/validation/paper-trades?days=7').then((r) => r.json()),
        fetch('/api/validation/report?days=7').then((r) => r.json()),
        fetch('/api/validation/best-pairs?days=7').then((r) => r.json()),
        fetch('/api/validation/scheduler').then((r) => r.json()),
        fetch('/api/validation/snapshot?limit=200').then((r) => r.json()),
      ])

    if (persRes.status   === 'fulfilled') setPersistence(persRes.value.data ?? null)
    if (accRes.status    === 'fulfilled') setAccuracy(accRes.value.data ?? null)
    if (paperRes.status  === 'fulfilled') {
      setPaperStats(paperRes.value.data?.stats ?? null)
      setPaperTrades(paperRes.value.data?.trades ?? [])
    }
    if (reportRes.status === 'fulfilled') setReport(reportRes.value.data ?? null)
    if (pairsRes.status  === 'fulfilled') setTopPairs(pairsRes.value.data ?? [])
    if (schedRes.status  === 'fulfilled') setScheduler(schedRes.value.data ?? null)
    if (snapRes.status   === 'fulfilled') setEdgeSnapshots(snapRes.value.data ?? [])

    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    fetchAll()
    const t = setInterval(() => fetchAll(true), 60_000)
    return () => clearInterval(t)
  }, [fetchAll])

  async function handleStartScheduler() {
    setStarting(true)
    await fetch('/api/validation/scheduler', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start' }),
    })
    await fetchAll(true)
    setStarting(false)
  }

  // Histograma de distribuição de edge
  const edgeHistogram = (() => {
    if (edgeSnapshots.length === 0) return []
    const buckets: Record<string, number> = {}
    for (const s of edgeSnapshots) {
      const key = (Math.round(s.edgeNet * 10000) / 10000 * 100).toFixed(2)
      buckets[key] = (buckets[key] ?? 0) + 1
    }
    return Object.entries(buckets)
      .map(([edge, count]) => ({ edge: parseFloat(edge), count }))
      .sort((a, b) => a.edge - b.edge)
      .slice(0, 30)
  })()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">A carregar dados de validação...</p>
        </div>
      </div>
    )
  }

  const noData = !persistence || persistence.totalDetected === 0

  return (
    <div className="space-y-6">

      {/* ── Status Bar ──────────────────────────────────────── */}
      <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl px-5 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${scheduler?.running ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            <span className="text-sm text-slate-300">
              Edge Tracker: <strong>{scheduler?.running ? 'ACTIVO' : 'PARADO'}</strong>
            </span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="text-sm text-slate-500">
            Snapshots hoje: <strong className="text-slate-300">{scheduler?.snapshotsToday ?? 0}</strong>
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-sm text-slate-500">
            Paper trades: <strong className="text-slate-300">{paperStats?.totalTrades ?? 0}</strong>
          </span>
        </div>
        <div className="flex items-center gap-3">
          {report && <VerdictBadge verdict={report.verdict} />}
          {!scheduler?.running && (
            <Button size="sm" onClick={handleStartScheduler} disabled={starting} className="gap-1.5">
              <Play className="w-3.5 h-3.5" />
              {starting ? 'A iniciar...' : 'Iniciar Tracker'}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => fetchAll(true)} disabled={refreshing} className="gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {noData && (
        <div className="text-center py-12 bg-slate-800/30 rounded-xl border border-slate-700/30">
          <Activity className="w-12 h-12 mx-auto mb-3 text-slate-600" />
          <p className="text-slate-400 font-medium">Ainda não há dados de validação</p>
          <p className="text-slate-600 text-sm mt-1">Inicia o Edge Tracker acima e aguarda 30s para o primeiro snapshot</p>
        </div>
      )}

      {!noData && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* ── Persistence ─────────────────────────────────── */}
          <SectionCard title="Persistência de Oportunidades">
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl font-bold text-slate-100">
                {persistence?.totalDetected ?? 0}
              </span>
              <span className="text-xs text-slate-500">oportunidades detectadas (7d)</span>
            </div>
            <div className="space-y-3">
              <PersistenceBar label="30s" pct={persistence?.percentages.at30s ?? 0} color="bg-emerald-500" />
              <PersistenceBar label="1m"  pct={persistence?.percentages.at1m  ?? 0} color="bg-blue-500"    />
              <PersistenceBar label="5m"  pct={persistence?.percentages.at5m  ?? 0} color="bg-yellow-500"  />
              <PersistenceBar label="30m" pct={persistence?.percentages.at30m ?? 0} color="bg-orange-500"  />
            </div>
          </SectionCard>

          {/* ── Edge Reality Check ───────────────────────────── */}
          <SectionCard title="Edge Reality Check">
            {edgeSnapshots.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Edge positivo</p>
                    <p className="text-xl font-bold text-emerald-400">
                      {Math.round((edgeSnapshots.filter((s) => s.edgeNet > 0).length / edgeSnapshots.length) * 100)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Edge negativo</p>
                    <p className="text-xl font-bold text-red-400">
                      {Math.round((edgeSnapshots.filter((s) => s.edgeNet <= 0).length / edgeSnapshots.length) * 100)}%
                    </p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={edgeHistogram} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis dataKey="edge" tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(v) => `${v}%`} />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => [v, 'count']}
                      labelFormatter={(l) => `Edge: ${l}%`}
                    />
                    <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                      {edgeHistogram.map((entry, i) => (
                        <Cell key={i} fill={entry.edge > 0 ? '#10b981' : '#ef4444'} fillOpacity={0.7} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <p className="text-slate-600 text-sm">Sem snapshots suficientes para histograma</p>
            )}
          </SectionCard>

          {/* ── Funding Accuracy ─────────────────────────────── */}
          <SectionCard title="Accuracy de Funding Rate">
            {accuracy && accuracy.totalPredictions > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-800 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-500 mb-1">Previsões</p>
                    <p className="text-lg font-bold text-slate-200">{accuracy.totalPredictions}</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-500 mb-1">MAE</p>
                    <p className="text-lg font-bold text-slate-200">{fmt4(accuracy.meanAbsoluteError)}</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-500 mb-1">Dentro ±0.01%</p>
                    <p className="text-lg font-bold text-emerald-400">{accuracy.withinThreshold}%</p>
                  </div>
                </div>
                {accuracy.bestPairs.length > 0 && (
                  <div className="text-xs text-slate-500 space-y-1 mt-2">
                    <p className="text-slate-400 font-medium mb-1">Melhor accuracy:</p>
                    {accuracy.bestPairs.map((p) => (
                      <div key={p.symbol} className="flex justify-between">
                        <span>{p.symbol}</span>
                        <span className="text-emerald-400 font-mono">{fmt4(p.mae)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-600 text-sm">Aguardando 8h para primeira realização de funding</p>
            )}
          </SectionCard>

          {/* ── Paper Trading ────────────────────────────────── */}
          <SectionCard title="Paper Trading">
            {paperStats && paperStats.closedTrades > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { label: 'PnL Total',   value: fmtUSD(paperStats.totalPnl),  color: paperStats.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400' },
                    { label: 'Win Rate',    value: pct(paperStats.winRate),       color: paperStats.winRate >= 55 ? 'text-emerald-400' : 'text-yellow-400' },
                    { label: 'Sharpe',      value: paperStats.sharpeRatio !== null ? paperStats.sharpeRatio.toFixed(2) : 'N/A', color: 'text-slate-200' },
                    { label: 'Max DD',      value: fmtUSD(-paperStats.maxDrawdown), color: 'text-red-400' },
                  ].map((m) => (
                    <div key={m.label} className="bg-slate-800 rounded-lg p-3">
                      <p className="text-xs text-slate-500 mb-1">{m.label}</p>
                      <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
                    </div>
                  ))}
                </div>
                {paperStats.equityCurve.length > 1 && (
                  <ResponsiveContainer width="100%" height={100}>
                    <LineChart data={paperStats.equityCurve} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <XAxis dataKey="date" hide />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                        formatter={(v: number) => [`$${v.toFixed(2)}`, 'Equity']}
                      />
                      <Line
                        type="monotone" dataKey="equity" stroke="#3b82f6"
                        strokeWidth={2} dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
                <p className="text-xs text-slate-600 mt-2">
                  {paperStats.closedTrades} fechados · {paperStats.openTrades} abertos ·{' '}
                  Avg win {fmtUSD(paperStats.avgWin)} / loss {fmtUSD(paperStats.avgLoss)}
                </p>
              </>
            ) : (
              <p className="text-slate-600 text-sm">
                {(paperStats?.openTrades ?? 0) > 0
                  ? `${paperStats?.openTrades} trade(s) aberto(s) — aguardando fecho`
                  : 'Sem trades ainda. O tracker abrirá trades quando encontrar edge ≥ 0.03%'}
              </p>
            )}
          </SectionCard>
        </div>
      )}

      {/* ── Top Pares ─────────────────────────────────────────── */}
      {topPairs.length > 0 && (
        <SectionCard title="Top Pares por Edge Real">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-700/50">
                  <th className="text-left pb-2 pr-4">Rank</th>
                  <th className="text-left pb-2 pr-4">Par</th>
                  <th className="text-right pb-2 pr-4">Edge Médio</th>
                  <th className="text-right pb-2 pr-4">Persist. 1m</th>
                  <th className="text-right pb-2">Win Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {topPairs.slice(0, 8).map((p) => (
                  <tr key={p.symbol} className="hover:bg-slate-700/20 transition-colors">
                    <td className="py-2 pr-4 text-slate-500">#{p.rank}</td>
                    <td className="py-2 pr-4 text-slate-200 font-medium font-mono">
                      {p.symbol.replace('USDT', '/USDT')}
                    </td>
                    <td className={`py-2 pr-4 text-right font-mono ${p.avgEdge > 0.0003 ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {fmt4(p.avgEdge)}
                    </td>
                    <td className={`py-2 pr-4 text-right ${p.persistence1m >= 50 ? 'text-emerald-400' : p.persistence1m >= 25 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {pct(p.persistence1m)}
                    </td>
                    <td className={`py-2 text-right ${p.winRate >= 55 ? 'text-emerald-400' : p.winRate >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {pct(p.winRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* ── GO / NO-GO Report ─────────────────────────────────── */}
      {report && (
        <SectionCard title="Veredicto GO / NO-GO">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
            <VerdictBadge verdict={report.verdict} />
            <p className="text-sm text-slate-400 max-w-lg">{report.recommendation}</p>
          </div>
          {report.daysCollected < report.daysRequired && (
            <div className="mb-4">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Dia {report.daysCollected} de {report.daysRequired}</span>
                <span>{Math.round((report.daysCollected / report.daysRequired) * 100)}%</span>
              </div>
              <div className="bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{ width: `${(report.daysCollected / report.daysRequired) * 100}%` }}
                />
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-700/50">
                  <th className="text-left pb-2 pr-4">Critério</th>
                  <th className="text-right pb-2 pr-4">Threshold</th>
                  <th className="text-right pb-2 pr-4">Actual</th>
                  <th className="text-right pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {report.criteria.map((c) => (
                  <tr key={c.name} className="hover:bg-slate-700/20 transition-colors">
                    <td className="py-2 pr-4 text-slate-300">{c.name}</td>
                    <td className="py-2 pr-4 text-right text-slate-500 font-mono text-xs">{c.threshold}</td>
                    <td className="py-2 pr-4 text-right font-mono text-xs text-slate-300">{c.actual}</td>
                    <td className="py-2 text-right">
                      {c.passed
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-400 ml-auto" />
                        : <XCircle className="w-4 h-4 text-red-400 ml-auto" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Últimos paper trades */}
      {paperTrades.length > 0 && (
        <SectionCard title="Últimos Paper Trades">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-slate-700/50">
                  {['Par', 'Longo', 'Curto', 'Entry Edge', 'PnL', 'Status', 'Razão'].map((h) => (
                    <th key={h} className="text-left pb-2 pr-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/20">
                {paperTrades.slice(0, 10).map((t) => {
                  const trade = t as Record<string, unknown>
                  const pnl = (trade.pnlNet as number | null) ?? null
                  return (
                    <tr key={trade.id as string} className="hover:bg-slate-700/20">
                      <td className="py-1.5 pr-3 font-mono text-slate-300">
                        {(trade.symbol as string).replace('USDT', '/USDT')}
                      </td>
                      <td className="py-1.5 pr-3 text-slate-400">{trade.exchangeLong as string}</td>
                      <td className="py-1.5 pr-3 text-slate-400">{trade.exchangeShort as string}</td>
                      <td className="py-1.5 pr-3 font-mono text-slate-400">
                        {fmt4((trade.edgeNetEntry as number) ?? 0)}
                      </td>
                      <td className={`py-1.5 pr-3 font-mono ${pnl === null ? 'text-slate-500' : pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {pnl !== null ? fmtUSD(pnl) : '—'}
                      </td>
                      <td className="py-1.5 pr-3">
                        <span className={`px-1.5 py-0.5 rounded text-xs ${
                          trade.status === 'open'          ? 'bg-blue-900/40 text-blue-400' :
                          trade.status === 'closed_profit' ? 'bg-emerald-900/40 text-emerald-400' :
                          'bg-red-900/40 text-red-400'
                        }`}>
                          {trade.status as string}
                        </span>
                      </td>
                      <td className="py-1.5 text-slate-500">{(trade.closeReason as string) ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  )
}
