'use client'

import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, AlertTriangle, CheckCircle2, Clock, Zap } from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────
interface DEXPrice {
  id: string
  chain: string
  dexName: string
  tokenA: string
  tokenB: string
  priceAtoB: number
  priceBtoA: number
  slippage1000: number
  feeTier: number
  timestamp: string
}

interface DEXOpportunity {
  id: string
  createdAt: string
  tokenPair: string
  chain: string
  dexA: string
  dexB: string
  priceA: number
  priceB: number
  spreadPct: number
  gasCostUSD: number
  totalCostPct: number
  edgeNet: number
  profitUSD100: number
  status: string
}

interface ChainStat { count: number; lastSeen: string | null }

interface StatusData {
  active: boolean
  chains: Record<string, ChainStat>
  oppsToday: number
  tablesReady: boolean
}

// ─── Helpers visuais ──────────────────────────────────────────────────────
const CHAIN_COLORS: Record<string, string> = {
  polygon:  'text-purple-400 bg-purple-400/10 border-purple-500/30',
  arbitrum: 'text-blue-400 bg-blue-400/10 border-blue-500/30',
  ethereum: 'text-slate-300 bg-slate-300/10 border-slate-500/30',
  bsc:      'text-yellow-400 bg-yellow-400/10 border-yellow-500/30',
}
const CHAIN_LABEL: Record<string, string> = {
  polygon: 'Polygon', arbitrum: 'Arbitrum', ethereum: 'Ethereum', bsc: 'BSC',
}
const ALL_CHAINS = ['polygon', 'arbitrum', 'ethereum', 'bsc']

function fmtPct(n: number) { return n.toFixed(3) + '%' }
function fmtUSD(n: number) { return '$' + n.toFixed(2) }
function timeAgo(ts: string) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  return `${Math.floor(s / 3600)}h`
}

function EdgeBadge({ edge }: { edge: number }) {
  const color = edge > 0.5 ? 'text-emerald-400 bg-emerald-400/10 border-emerald-500/30'
    : edge > 0 ? 'text-yellow-400 bg-yellow-400/10 border-yellow-500/30'
    : 'text-red-400 bg-red-400/10 border-red-500/30'
  return (
    <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${color}`}>
      {fmtPct(edge)}
    </span>
  )
}

// ─── Setup Banner (quando tabelas não estão criadas) ──────────────────────
function SetupBanner() {
  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 text-center space-y-3">
      <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
      <h3 className="text-amber-300 font-semibold text-lg">Setup necessário</h3>
      <p className="text-slate-400 text-sm max-w-lg mx-auto">
        As tabelas DEX ainda não foram criadas no Supabase. O monitor inicia automaticamente
        após o setup.
      </p>
      <div className="bg-slate-900 rounded-lg p-4 text-left text-xs font-mono text-slate-300 max-w-lg mx-auto">
        <p className="text-slate-500 mb-2">{'-- Supabase SQL Editor → New query → Run'}</p>
        <p>{'-- Colar conteúdo de:'}</p>
        <p className="text-blue-400">{'supabase/migrations/dex_arb_tables.sql'}</p>
      </div>
      <p className="text-slate-500 text-xs">
        Após criar as tabelas, reinicia o servidor. O primeiro ciclo demora ~60s.
      </p>
    </div>
  )
}

// ─── Dashboard principal ──────────────────────────────────────────────────
export function DexDashboard() {
  const [prices, setPrices]       = useState<DEXPrice[]>([])
  const [opps, setOpps]           = useState<DEXOpportunity[]>([])
  const [status, setStatus]       = useState<StatusData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [activeChain, setActiveChain] = useState<string>('all')

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    const [pricesRes, oppsRes, statusRes] = await Promise.allSettled([
      fetch('/api/dex/prices'),
      fetch('/api/dex/opportunities?hours=24'),
      fetch('/api/dex/status'),
    ])

    if (pricesRes.status === 'fulfilled' && pricesRes.value.ok) {
      const j = await pricesRes.value.json()
      setPrices(j.data ?? [])
    }
    if (oppsRes.status === 'fulfilled' && oppsRes.value.ok) {
      const j = await oppsRes.value.json()
      setOpps(j.data ?? [])
    }
    if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
      const j = await statusRes.value.json()
      setStatus(j.data)
    }

    setLastUpdate(new Date())
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    fetchAll()
    const iv = setInterval(() => fetchAll(true), 30_000)
    return () => clearInterval(iv)
  }, [fetchAll])

  const filteredOpps = activeChain === 'all' ? opps : opps.filter(o => o.chain === activeChain)
  const filteredPrices = activeChain === 'all' ? prices : prices.filter(p => p.chain === activeChain)

  // Agrupar preços por par para mostrar spread entre DEXes
  const pricesByPair = filteredPrices.reduce((m, p) => {
    const key = `${p.chain}|${p.tokenA}-${p.tokenB}`
    if (!m[key]) m[key] = []
    m[key].push(p)
    return m
  }, {} as Record<string, DEXPrice[]>)

  return (
    <div className="space-y-6">
      {/* ── Status bar ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Scheduler */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Monitor DEX</p>
          <div className="flex items-center gap-2">
            {status?.active
              ? <><div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /><span className="text-emerald-400 font-semibold text-sm">Activo</span></>
              : <><div className="w-2 h-2 rounded-full bg-slate-500" /><span className="text-slate-400 text-sm">Inactivo</span></>}
          </div>
        </div>

        {/* Chains activas */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Chains Activas</p>
          <div className="flex gap-1 flex-wrap mt-1">
            {ALL_CHAINS.map(c => {
              const active = status?.chains[c]?.count ?? 0
              return (
                <span key={c} className={`text-xs px-1.5 py-0.5 rounded border ${active > 0 ? CHAIN_COLORS[c] : 'text-slate-600 border-slate-700'}`}>
                  {CHAIN_LABEL[c]}
                </span>
              )
            })}
          </div>
        </div>

        {/* Preços hoje */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Preços Recolhidos</p>
          <p className="text-2xl font-bold text-slate-200">{prices.length}</p>
          <p className="text-xs text-slate-600">últimos 5 min</p>
        </div>

        {/* Oportunidades hoje */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Oportunidades Hoje</p>
          <p className="text-2xl font-bold text-emerald-400">{status?.oppsToday ?? 0}</p>
          <p className="text-xs text-slate-600">edge {'>'} 0.1%</p>
        </div>
      </div>

      {/* ── Setup banner ou conteúdo ──────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-500 text-sm">A conectar às chains...</p>
            <p className="text-slate-600 text-xs mt-1">Polygon • Arbitrum • Ethereum • BSC</p>
          </div>
        </div>
      ) : !status?.tablesReady ? (
        <SetupBanner />
      ) : (
        <>
          {/* ── Filtro por chain ────────────────────────────────────── */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setActiveChain('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeChain === 'all' ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Todas ({opps.length})
            </button>
            {ALL_CHAINS.map(c => {
              const n = opps.filter(o => o.chain === c).length
              return (
                <button
                  key={c}
                  onClick={() => setActiveChain(c)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    activeChain === c ? CHAIN_COLORS[c] : 'text-slate-500 border-transparent hover:text-slate-300'
                  }`}
                >
                  {CHAIN_LABEL[c]} ({n})
                </button>
              )
            })}
          </div>

          {/* ── Oportunidades ───────────────────────────────────────── */}
          <div>
            <h2 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              Oportunidades DEX detectadas (24h)
            </h2>

            {filteredOpps.length === 0 ? (
              <div className="text-center py-12 bg-slate-800/30 rounded-xl border border-slate-700/30">
                <Clock className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                <p className="text-slate-500">Nenhuma oportunidade com edge {'>'} 0.1% nas últimas 24h</p>
                <p className="text-slate-600 text-xs mt-1">O monitor verifica a cada 60s. Aguarda o primeiro ciclo.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-500 border-b border-slate-700/50">
                      <th className="text-left py-2 pr-4">Par</th>
                      <th className="text-left py-2 pr-4">Chain</th>
                      <th className="text-left py-2 pr-4">DEX A → B</th>
                      <th className="text-right py-2 pr-4">Spread</th>
                      <th className="text-right py-2 pr-4">Gas</th>
                      <th className="text-right py-2 pr-4">Custo Total</th>
                      <th className="text-right py-2 pr-4">Edge Net</th>
                      <th className="text-right py-2">Profit/$100</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOpps.map(o => (
                      <tr key={o.id} className="border-b border-slate-700/30 hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 pr-4 font-medium text-slate-200">{o.tokenPair}</td>
                        <td className="py-2.5 pr-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${CHAIN_COLORS[o.chain] ?? 'text-slate-400 border-slate-600'}`}>
                            {CHAIN_LABEL[o.chain] ?? o.chain}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-slate-400 text-xs">
                          <span className="text-slate-300">{o.dexA}</span>
                          <span className="mx-1">→</span>
                          <span className="text-slate-300">{o.dexB}</span>
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono text-blue-400">{fmtPct(o.spreadPct)}</td>
                        <td className="py-2.5 pr-4 text-right font-mono text-slate-400">{fmtUSD(o.gasCostUSD)}</td>
                        <td className="py-2.5 pr-4 text-right font-mono text-red-400">{fmtPct(o.totalCostPct)}</td>
                        <td className="py-2.5 pr-4 text-right"><EdgeBadge edge={o.edgeNet} /></td>
                        <td className={`py-2.5 text-right font-mono font-semibold ${o.profitUSD100 > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {fmtUSD(o.profitUSD100)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Preços por par ──────────────────────────────────────── */}
          <div>
            <h2 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              Preços DEX ao vivo
            </h2>

            {Object.keys(pricesByPair).length === 0 ? (
              <p className="text-slate-600 text-sm text-center py-6">A aguardar primeiro ciclo de preços...</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Object.entries(pricesByPair).map(([key, dexPrices]) => {
                  const [, pair] = key.split('|')
                  const chain = dexPrices[0].chain
                  const prices = dexPrices.sort((a, b) => b.priceAtoB - a.priceAtoB)
                  const spread = prices.length >= 2
                    ? ((prices[0].priceAtoB - prices[prices.length - 1].priceAtoB) / prices[prices.length - 1].priceAtoB) * 100
                    : 0

                  return (
                    <div key={key} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <span className="font-semibold text-slate-200">{pair}</span>
                          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded border ${CHAIN_COLORS[chain] ?? ''}`}>
                            {CHAIN_LABEL[chain] ?? chain}
                          </span>
                        </div>
                        {spread > 0.05 && (
                          <span className="text-xs text-yellow-400 font-mono">Δ {fmtPct(spread)}</span>
                        )}
                      </div>
                      <div className="space-y-2">
                        {prices.map(p => (
                          <div key={p.id} className="flex items-center justify-between text-sm">
                            <span className="text-slate-400 text-xs">{p.dexName}</span>
                            <div className="text-right">
                              <span className="font-mono text-slate-200">{p.priceAtoB.toFixed(6)}</span>
                              {p.slippage1000 > 0 && (
                                <span className="text-xs text-slate-600 ml-2">slip {fmtPct(p.slippage1000)}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 pt-2 border-t border-slate-700/50 flex justify-between text-xs text-slate-600">
                        <span>fee {prices[0].feeTier}%</span>
                        <span>{timeAgo(prices[0].timestamp)} atrás</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Chains status ────────────────────────────────────────── */}
          <div>
            <h2 className="font-semibold text-slate-200 mb-3">Estado das Chains</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {ALL_CHAINS.map(chain => {
                const stat = status?.chains[chain]
                return (
                  <div key={chain} className={`rounded-xl border p-4 ${stat ? CHAIN_COLORS[chain] : 'bg-slate-800/30 border-slate-700/30'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {stat
                        ? <CheckCircle2 className="w-4 h-4" />
                        : <Clock className="w-4 h-4 text-slate-600" />}
                      <span className="font-medium text-sm">{CHAIN_LABEL[chain]}</span>
                    </div>
                    <p className="text-2xl font-bold">{stat?.count ?? 0}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {stat?.lastSeen ? `Último: ${timeAgo(stat.lastSeen)}` : 'Sem dados'}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {lastUpdate && (
        <p className="text-xs text-slate-700 text-right">
          Actualizado: {lastUpdate.toLocaleTimeString('pt-BR')}
        </p>
      )}
    </div>
  )
}

