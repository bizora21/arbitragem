'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Clock, Layers, Brain, ExternalLink, Zap, Eye, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { LPExecutePanel } from './lp-execute-panel'

interface LPPool {
  id: string
  protocol: string
  chain: string
  pair: string
  tvlUsd: number
  feeAPY: number
  emissionAPY: number
  realAPY: number
  volume24h: number
  rewardToken: string | null
  poolId: string
  updatedAt?: string
}

interface AIAnalysis {
  score: number
  recommendation: 'ENTER' | 'WATCH' | 'SKIP'
  reasoning: string
  risks: string[]
  estimatedAPY: number | null
}

const CHAIN_COLORS: Record<string, string> = {
  Base:     'bg-blue-600/20 text-blue-300',
  Arbitrum: 'bg-sky-600/20 text-sky-300',
  Optimism: 'bg-red-600/20 text-red-300',
  Ethereum: 'bg-slate-600/20 text-slate-300',
  Polygon:  'bg-purple-600/20 text-purple-300',
}

const PROTOCOL_LABELS: Record<string, string> = {
  'aerodrome-finance': 'Aerodrome',
  aerodrome: 'Aerodrome',
  'velodrome-finance': 'Velodrome',
  velodrome: 'Velodrome',
  'curve-dex': 'Curve',
  curve: 'Curve',
  'uniswap-v3': 'Uniswap V3',
  gmx: 'GMX',
}

const PROTOCOL_LINKS: Record<string, string> = {
  'aerodrome-finance': 'https://aerodrome.finance/liquidity',
  aerodrome: 'https://aerodrome.finance/liquidity',
  'velodrome-finance': 'https://velodrome.finance/liquidity',
  velodrome: 'https://velodrome.finance/liquidity',
  'curve-dex': 'https://curve.finance/pools',
  curve: 'https://curve.finance/pools',
  'uniswap-v3': 'https://app.uniswap.org/positions/create/v3',
  gmx: 'https://app.gmx.io/#/earn',
  'aave-v3': 'https://app.aave.com',
  'compound-v3': 'https://app.compound.finance',
}

const LP_STEPS: Record<string, string[]> = {
  aerodrome:    ['Abre aerodrome.finance/liquidity', 'Muda a MetaMask para Base', 'Procura o par (ex: USDC/USDbC)', 'Clica "Add Liquidity" e escolhe o montante', 'Confirma as 2 aprovações + o depósito na MetaMask'],
  velodrome:    ['Abre velodrome.finance/liquidity', 'Muda a MetaMask para Optimism', 'Procura o par estável', 'Clica "Add Liquidity" e escolhe o montante', 'Confirma as aprovações na MetaMask'],
  curve:        ['Abre curve.finance/pools', 'Seleciona o pool (ex: 3pool)', 'Clica "Deposit" e escolhe o token', 'Confirma aprovação + depósito na MetaMask'],
  'uniswap-v3': ['Abre app.uniswap.org → "Pools" → "New Position"', 'Seleciona o par e a fee tier (0.05% para stables)', 'Define o range de preço (full range para começar)', 'Introduz o valor e confirma na MetaMask'],
  default:      ['Abre o link do protocolo', 'Liga a MetaMask à chain correta', 'Vai à secção de "Liquidity" ou "Pools"', 'Adiciona liquidez e confirma na MetaMask'],
}

function getLPSteps(protocol: string): string[] {
  const key = Object.keys(LP_STEPS).find((k) => protocol.toLowerCase().includes(k))
  return LP_STEPS[key ?? 'default']
}

const REC_STYLES: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode; label: string }> = {
  ENTER: { bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/40', icon: <Zap className="w-3 h-3" />, label: 'ENTRAR' },
  WATCH: { bg: 'bg-yellow-500/10',  text: 'text-yellow-300',  border: 'border-yellow-500/40',  icon: <Eye className="w-3 h-3" />, label: 'OBSERVAR' },
  SKIP:  { bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/40',      icon: <AlertTriangle className="w-3 h-3" />, label: 'IGNORAR' },
}

function fmtPct(n: number) { return `${n.toFixed(1)}%` }
function fmtTvl(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  return `$${(n / 1e3).toFixed(0)}K`
}

function TopLPPick({ pool, ai }: { pool: LPPool; ai: AIAnalysis | null }) {
  const label = PROTOCOL_LABELS[pool.protocol] ?? pool.protocol
  const link = PROTOCOL_LINKS[pool.protocol] ?? '#'
  const steps = getLPSteps(pool.protocol)
  const rec = ai ? REC_STYLES[ai.recommendation] : REC_STYLES.WATCH
  const emissionShare = pool.realAPY > 0 ? (pool.emissionAPY / pool.realAPY) * 100 : 0

  return (
    <div className={`border rounded-xl p-4 ${rec.bg} ${rec.border}`}>
      <div className="flex items-center gap-2 mb-3">
        <Brain className={`w-4 h-4 ${rec.text}`} />
        <span className={`text-xs font-bold uppercase ${rec.text}`}>Melhor Pool IA — LP Scanner</span>
        {ai && (
          <span className={`ml-auto flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${rec.bg} ${rec.border} ${rec.text}`}>
            {rec.icon}{rec.label}
          </span>
        )}
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-bold text-lg">{label}</span>
            <span className="text-slate-300 font-medium">{pool.pair}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${CHAIN_COLORS[pool.chain] ?? 'bg-slate-600/20 text-slate-400'}`}>{pool.chain}</span>
            {pool.rewardToken && <span className="text-[10px] text-slate-500">+{pool.rewardToken}</span>}
          </div>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex-1 max-w-[140px]">
              <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-700">
                <div className="bg-emerald-500" style={{ width: `${Math.max(0, 100 - emissionShare)}%` }} />
                <div className="bg-yellow-500" style={{ width: `${Math.min(100, emissionShare)}%` }} />
              </div>
              <div className="flex justify-between text-[9px] mt-0.5">
                <span className="text-emerald-500">fee {fmtPct(pool.feeAPY)}</span>
                <span className="text-yellow-500">emission {fmtPct(pool.emissionAPY)}</span>
              </div>
            </div>
            <span className="text-xs text-slate-400">TVL <span className="text-slate-200">{fmtTvl(pool.tvlUsd)}</span></span>
          </div>
          {ai?.reasoning && <p className="mt-2 text-xs text-slate-300 italic">"{ai.reasoning}"</p>}
          {ai?.risks && ai.risks.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {ai.risks.map((r) => (
                <span key={r} className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded">{r}</span>
              ))}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-3xl font-bold text-emerald-400">{fmtPct(pool.realAPY)}</p>
          <p className="text-[10px] text-slate-500">APY real</p>
          {ai && <p className="text-sm font-bold text-slate-300 mt-1">Score {ai.score}</p>}
        </div>
      </div>

      <div className="mt-4 border-t border-white/10 pt-3">
        <p className="text-xs font-semibold text-slate-300 mb-2">Como adicionar liquidez:</p>
        <ol className="space-y-1">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
              <span className="shrink-0 w-4 h-4 rounded-full bg-slate-700 text-slate-300 text-[10px] flex items-center justify-center font-bold">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
        {link !== '#' && (
          <a href={link} target="_blank" rel="noopener noreferrer"
            className={`mt-3 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${rec.bg} ${rec.border} ${rec.text} hover:opacity-80`}>
            <ExternalLink className="w-3 h-3" />
            Abrir {label} — {pool.chain}
          </a>
        )}
      </div>
    </div>
  )
}

type SubTab = 'all' | 'stablecoin' | 'base'
const STABLECOINS = ['USDC', 'USDT', 'DAI', 'FRAX', 'CRVUSD']
function isStable(pair: string) { return STABLECOINS.some((s) => pair.toUpperCase().includes(s)) }

function PoolCard({ p, onAnalyze, analyzing }: { p: LPPool; onAnalyze: () => void; analyzing: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const [ai, setAI] = useState<AIAnalysis | null>(null)
  const label = PROTOCOL_LABELS[p.protocol] ?? p.protocol
  const link = PROTOCOL_LINKS[p.protocol] ?? '#'
  const steps = getLPSteps(p.protocol)
  const emissionShare = p.realAPY > 0 ? (p.emissionAPY / p.realAPY) * 100 : 0
  const rec = ai ? REC_STYLES[ai.recommendation] : null

  const analyze = async () => {
    onAnalyze()
    try {
      const res = await fetch('/api/analyze-opportunity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocol: label, chain: p.chain, apy: p.realAPY, tvl: p.tvlUsd, type: 'LP' }),
      })
      const json = await res.json()
      if (json.analysis) setAI(json.analysis)
    } catch { /* ignore */ }
  }

  return (
    <div className="bg-slate-800/40 border border-slate-700/50 hover:border-slate-600/50 rounded-lg overflow-hidden transition-colors">
      <div className="p-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-white text-sm">{label}</span>
              <span className="text-slate-300 text-sm">{p.pair}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${CHAIN_COLORS[p.chain] ?? 'bg-slate-600/20 text-slate-400'}`}>{p.chain}</span>
              {p.rewardToken && <span className="text-[10px] text-slate-500">+{p.rewardToken}</span>}
              {rec && (
                <span className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${rec.bg} ${rec.border} ${rec.text}`}>
                  {rec.icon}{rec.label}
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex-1 max-w-[140px]">
                <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-700">
                  <div className="bg-emerald-500" style={{ width: `${Math.max(0, 100 - emissionShare)}%` }} />
                  <div className="bg-yellow-500" style={{ width: `${Math.min(100, emissionShare)}%` }} />
                </div>
                <div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
                  <span className="text-emerald-500">fee {fmtPct(p.feeAPY)}</span>
                  <span className="text-yellow-500">emission {fmtPct(p.emissionAPY)}</span>
                </div>
              </div>
              <span className="text-xs text-slate-400">TVL <span className="text-slate-200">{fmtTvl(p.tvlUsd)}</span></span>
              <span className="text-xs text-slate-400">Vol <span className="text-slate-200">{fmtTvl(p.volume24h)}</span>/d</span>
            </div>
            {ai?.reasoning && <p className="mt-1 text-xs text-slate-400 italic">"{ai.reasoning}"</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <div className="text-right mr-1">
              <p className="text-lg font-bold text-emerald-400">{fmtPct(p.realAPY)}</p>
              <p className="text-[10px] text-slate-500">APY real</p>
            </div>
            {!ai && (
              <button onClick={analyze} disabled={analyzing}
                className="flex items-center gap-1 px-2 py-1 text-[10px] text-purple-400 border border-purple-500/30 hover:border-purple-400 rounded transition-colors disabled:opacity-50">
                <Brain className={`w-2.5 h-2.5 ${analyzing ? 'animate-pulse' : ''}`} />
                {analyzing ? '…' : 'IA'}
              </button>
            )}
            <button onClick={() => setExpanded(!expanded)} className="text-slate-500 hover:text-slate-300 p-1 transition-colors">
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-700/50 bg-slate-900/40 px-3 py-3">
          <p className="text-[10px] font-semibold text-slate-400 uppercase mb-2">Como adicionar liquidez</p>
          <ol className="space-y-1.5">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                <span className="shrink-0 w-4 h-4 rounded-full bg-slate-700 text-slate-300 text-[10px] flex items-center justify-center font-bold">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          {link !== '#' && (
            <a href={link} target="_blank" rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
              <ExternalLink className="w-3 h-3" />
              Abrir {label}
            </a>
          )}
        </div>
      )}
    </div>
  )
}

export function LPTab() {
  const [pools, setPools] = useState<LPPool[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subTab, setSubTab] = useState<SubTab>('stablecoin')
  const [timestamp, setTimestamp] = useState('')
  const [topAI, setTopAI] = useState<AIAnalysis | null>(null)
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)

  const load = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/lp-pools${forceRefresh ? '?refresh=true' : ''}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      setPools(json.data ?? [])
      setTimestamp(json.timestamp ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = pools.filter((p) => {
    if (subTab === 'stablecoin') return isStable(p.pair)
    if (subTab === 'base') return p.chain === 'Base'
    return true
  })

  const topPool = [...pools].sort((a, b) => b.realAPY - a.realAPY)[0]

  // AI analysis only on user request

  const bestRealAPY = filtered.length > 0 ? Math.max(...filtered.map((p) => p.realAPY)) : 0
  const avgFeeAPY = filtered.length > 0 ? filtered.reduce((s, p) => s + p.feeAPY, 0) / filtered.length : 0

  const SUB_TABS: { id: SubTab; label: string; count: number }[] = [
    { id: 'stablecoin', label: 'Stablecoin', count: pools.filter((p) => isStable(p.pair)).length },
    { id: 'base',       label: 'Base',       count: pools.filter((p) => p.chain === 'Base').length },
    { id: 'all',        label: 'Todos',      count: pools.length },
  ]

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
          <p className="text-xs text-slate-500">Melhor APY Real</p>
          <p className="text-xl font-bold text-emerald-400">{fmtPct(bestRealAPY)}</p>
          <p className="text-xs text-slate-400">após fees de emissão</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
          <p className="text-xs text-slate-500">Avg Fee APY</p>
          <p className="text-xl font-bold text-blue-400">{fmtPct(avgFeeAPY)}</p>
          <p className="text-xs text-slate-400">fees reais de trading</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
          <p className="text-xs text-slate-500">Pools monitorizados</p>
          <p className="text-xl font-bold text-white">{pools.length}</p>
          <p className="text-xs text-slate-400">Aerodrome · Curve · Uniswap</p>
        </div>
      </div>

      {/* Execute directly inside the tool */}
      {!loading && pools.length > 0 && (
        <LPExecutePanel
          feeAPY={topPool?.feeAPY ?? 0}
          emissionAPY={topPool?.emissionAPY ?? 0}
        />
      )}

      {/* Top Pick IA */}
      {!loading && topPool && (
        <div className="space-y-2">
          <TopLPPick pool={topPool} ai={topAI} />
          {!topAI && (
            <div className="flex justify-end">
              <button
                onClick={() => {
                  const label = PROTOCOL_LABELS[topPool.protocol] ?? topPool.protocol
                  fetch('/api/analyze-opportunity', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ protocol: label, chain: topPool.chain, apy: topPool.realAPY, tvl: topPool.tvlUsd, type: 'LP' }),
                  }).then((r) => r.json()).then((j) => { if (j.analysis) setTopAI(j.analysis) }).catch(() => {})
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-purple-400 border border-purple-500/30 hover:border-purple-400 rounded-lg transition-colors"
              >
                <Brain className="w-3 h-3" />
                Análise IA do melhor pool
              </button>
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {SUB_TABS.map((t) => (
            <button key={t.id} onClick={() => setSubTab(t.id)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${subTab === t.id ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-300'}`}>
              {t.label}<span className="ml-1 text-slate-500">({t.count})</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {timestamp && (
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(timestamp).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button onClick={() => load(true)} disabled={refreshing}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-white border border-slate-700 rounded-md transition-colors disabled:opacity-50">
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
          <RefreshCw className="w-4 h-4 animate-spin mr-2" />A carregar pools…
        </div>
      )}
      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">{error}</div>}
      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-12 text-slate-500 text-sm">
          Nenhum pool encontrado. Clica em Atualizar para fazer scan.
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((p) => (
          <PoolCard
            key={p.poolId ?? p.id ?? `${p.protocol}-${p.chain}-${p.pair}`}
            p={p}
            onAnalyze={() => setAnalyzingId(p.poolId)}
            analyzing={analyzingId === p.poolId}
          />
        ))}
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-500 bg-slate-800/30 border border-slate-700/30 rounded-lg p-3">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3 h-3" />
          <span>APY Real = Fee APY + Emission APY × 0.8</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-sm bg-emerald-500" /> Fee (sustentável)
          <span className="w-2 h-2 rounded-sm bg-yellow-500 ml-1" /> Emissão (variável)
        </div>
      </div>
    </div>
  )
}
