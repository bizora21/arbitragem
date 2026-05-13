'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, AlertCircle, ArrowRight, Brain, ExternalLink, Zap, Eye, AlertTriangle, ChevronDown, ChevronUp, TrendingUp, Clock } from 'lucide-react'
import { StrategyValidationPanel } from './strategy-validation-panel'
import { CapitalBadge } from '@/components/CapitalBadge'
import { ReturnSimulator } from '@/components/ReturnSimulator'
import { MyPositions } from './my-positions'

interface YieldPool {
  protocol: string
  chain: string
  asset: string
  poolSymbol: string
  apy: number
  apyBase: number
  apyReward: number
  tvlUsd: number
}

interface YieldOpportunity {
  fromProtocol: string
  toProtocol: string
  fromChain: string
  toChain: string
  asset: string
  currentApy: number
  targetApy: number
  gainPct: number
}

interface YieldData {
  pools?: YieldPool[]
  opportunities?: YieldOpportunity[]
  bestPerAsset?: Record<string, YieldPool>
  timestamp?: string
  error?: string
}

interface AIAnalysis {
  score: number
  recommendation: 'ENTER' | 'WATCH' | 'SKIP'
  reasoning: string
  risks: string[]
  estimatedAPY: number | null
}

const CHAIN_COLORS: Record<string, string> = {
  Ethereum: 'text-slate-300 bg-slate-300/10 border-slate-500/30',
  Polygon:  'text-purple-400 bg-purple-400/10 border-purple-500/30',
  Arbitrum: 'text-blue-400 bg-blue-400/10 border-blue-500/30',
  Optimism: 'text-red-400 bg-red-400/10 border-red-500/30',
  Base:     'text-blue-300 bg-blue-300/10 border-blue-400/30',
}

const ASSET_COLORS: Record<string, string> = {
  USDC: 'text-blue-400',
  USDT: 'text-green-400',
  DAI:  'text-yellow-400',
}

const REC_STYLES: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode; label: string }> = {
  ENTER: { bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/40', icon: <Zap className="w-3.5 h-3.5" />,         label: 'ENTRAR'   },
  WATCH: { bg: 'bg-yellow-500/10',  text: 'text-yellow-300',  border: 'border-yellow-500/40',  icon: <Eye className="w-3.5 h-3.5" />,          label: 'OBSERVAR' },
  SKIP:  { bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/40',      icon: <AlertTriangle className="w-3.5 h-3.5" />, label: 'IGNORAR'  },
}

const PROTOCOL_LINKS: Record<string, Record<string, string>> = {
  'Aave V3': {
    Base:     'https://app.aave.com/?marketName=proto_base_v3',
    Polygon:  'https://app.aave.com/?marketName=proto_polygon_v3',
    Arbitrum: 'https://app.aave.com/?marketName=proto_arbitrum_v3',
    Ethereum: 'https://app.aave.com/?marketName=proto_mainnet_v3',
    default:  'https://app.aave.com',
  },
  'Compound V3': {
    Base:     'https://app.compound.finance/?market=usdc-basemainnet',
    Polygon:  'https://app.compound.finance/?market=usdc-polygon',
    Arbitrum: 'https://app.compound.finance/?market=usdc-arbitrum',
    default:  'https://app.compound.finance',
  },
  Curve: { default: 'https://curve.finance/pools' },
  Yearn: { default: 'https://yearn.fi/vaults' },
}

function getLink(protocol: string, chain: string): string {
  const entry = PROTOCOL_LINKS[protocol]
  if (!entry) return '#'
  return entry[chain] ?? entry.default ?? '#'
}

const YIELD_STEPS: Record<string, string[]> = {
  'Aave V3':     ['Abre o link do Aave abaixo', 'Muda a rede da MetaMask para a chain indicada', 'Clica em "Supply" ao lado do teu asset', 'Introduz o valor e confirma na MetaMask', 'Começas a ganhar APY imediatamente'],
  'Compound V3': ['Abre o link do Compound abaixo', 'Muda a rede da MetaMask para a chain indicada', 'Clica em "Supply" na coluna do teu asset', 'Aprova o contrato (1ª vez) + confirma o depósito', 'Juros acumulam-se por bloco'],
  default:       ['Abre o link do protocolo abaixo', 'Muda a rede da MetaMask para a chain indicada', 'Vai à secção "Supply" ou "Deposit"', 'Deposita o valor e confirma na MetaMask'],
}

function getSteps(protocol: string): string[] {
  return YIELD_STEPS[protocol] ?? YIELD_STEPS.default
}

function fmtTvl(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  return `$${(n / 1e3).toFixed(0)}K`
}

function fmtGain(amount: number, apy: number, days: number) {
  if (!amount || !apy) return '$0.00'
  return `$${((amount * apy / 100 / 365) * days).toFixed(2)}`
}

// ─── Pool card with inline calculator ────────────────────────────────────────

function YieldPoolCard({ pool, rank }: { pool: YieldPool; rank: number }) {
  const [amount, setAmount]     = useState('')
  const [showSteps, setShowSteps] = useState(false)
  const amountN = parseFloat(amount) || 0
  const link    = getLink(pool.protocol, pool.chain)
  const steps   = getSteps(pool.protocol)
  const basePct   = pool.apy > 0 ? (pool.apyBase / pool.apy) * 100 : 100
  const rewardPct = 100 - basePct

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 hover:border-slate-600/60 overflow-hidden transition-all">
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Rank */}
          <div className="shrink-0 w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-400">
            {rank}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-bold text-white">{pool.protocol}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${CHAIN_COLORS[pool.chain] ?? 'text-slate-400 border-slate-600'}`}>{pool.chain}</span>
              <span className={`text-sm font-semibold ${ASSET_COLORS[pool.asset] ?? 'text-slate-200'}`}>{pool.asset}</span>
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <div className="flex-1 max-w-[200px]">
                <div className="flex h-2 rounded-full overflow-hidden bg-slate-700">
                  <div className="bg-emerald-500" style={{ width: `${basePct}%` }} />
                  {rewardPct > 1 && <div className="bg-blue-400" style={{ width: `${rewardPct}%` }} />}
                </div>
                <div className="flex justify-between text-[10px] mt-0.5">
                  <span className="text-emerald-400">base {pool.apyBase.toFixed(2)}%</span>
                  {pool.apyReward > 0 && <span className="text-blue-400">+reward {pool.apyReward.toFixed(2)}%</span>}
                </div>
              </div>
              <span className="text-xs text-slate-500">TVL <span className="text-slate-300">{fmtTvl(pool.tvlUsd)}</span></span>
            </div>
          </div>

          {/* APY */}
          <div className="shrink-0 text-right">
            <p className="text-2xl font-bold text-emerald-400">{pool.apy.toFixed(2)}%</p>
            <p className="text-[10px] text-slate-500">APY</p>
          </div>
        </div>

        {/* ── Gain calculator ── */}
        <div className="mt-3 pt-3 border-t border-slate-700/40">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs text-slate-400">Quanto tens para depositar?</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-24 bg-slate-900/70 border border-slate-600 rounded-lg pl-5 pr-2 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
              {amountN > 0 ? (
                <div className="flex gap-2 text-xs">
                  <span className="text-slate-500">Dia <span className="text-emerald-400 font-semibold">{fmtGain(amountN, pool.apy, 1)}</span></span>
                  <span className="text-slate-500">Mês <span className="text-emerald-400 font-semibold">{fmtGain(amountN, pool.apy, 30)}</span></span>
                  <span className="text-slate-500">Ano <span className="text-emerald-400 font-semibold">{fmtGain(amountN, pool.apy, 365)}</span></span>
                </div>
              ) : (
                <span className="text-[11px] text-slate-600 italic">
                  ex: $1 000 → Mês +${(1000 * pool.apy / 100 / 12).toFixed(2)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            {link !== '#' ? (
              <a href={link} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors">
                <ExternalLink className="w-3 h-3" />
                Depositar em {pool.protocol}
              </a>
            ) : (
              <span className="text-xs text-slate-500 italic">Pesquisa "{pool.protocol}" para depositar</span>
            )}
            <button
              onClick={() => setShowSteps(!showSteps)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-300 border border-slate-700 rounded-lg transition-colors"
            >
              {showSteps ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showSteps ? 'Ocultar passos' : 'Ver passos'}
            </button>
          </div>
        </div>

        {showSteps && (
          <div className="mt-3 pt-3 border-t border-slate-700/30 bg-slate-900/30 rounded-lg p-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase mb-2">Passo a passo</p>
            <ol className="space-y-1.5">
              {steps.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                  <span className="shrink-0 w-4 h-4 rounded-full bg-slate-700 text-slate-300 text-[10px] flex items-center justify-center font-bold">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Rotation opportunity card with gain calculator ───────────────────────────

function OppCard({ opp }: { opp: YieldOpportunity }) {
  const [expanded, setExpanded]       = useState(false)
  const [ai, setAI]                   = useState<AIAnalysis | null>(null)
  const [analyzing, setAnalyzing]     = useState(false)
  const [rotateAmount, setRotateAmount] = useState('')
  const rotateN = parseFloat(rotateAmount) || 0
  const link    = getLink(opp.toProtocol, opp.toChain)
  const steps   = getSteps(opp.toProtocol)
  const rec     = ai ? REC_STYLES[ai.recommendation] : null
  const extraPerMonth = rotateN > 0 ? rotateN * opp.gainPct / 100 / 12 : 0
  const extraPerYear  = rotateN > 0 ? rotateN * opp.gainPct / 100      : 0

  const analyze = async () => {
    setAnalyzing(true)
    try {
      const res = await fetch('/api/analyze-opportunity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocol: opp.toProtocol, chain: opp.toChain, apy: opp.targetApy, tvl: 0, type: 'YIELD' }),
      })
      const json = await res.json()
      if (json.analysis) setAI(json.analysis)
    } catch { /* ignore */ } finally { setAnalyzing(false) }
  }

  return (
    <div className="bg-slate-800/60 border border-green-500/20 rounded-xl overflow-hidden">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className={`font-semibold ${ASSET_COLORS[opp.asset] ?? 'text-slate-200'}`}>{opp.asset}</span>
          <span className="text-green-400 font-bold text-sm">+{opp.gainPct.toFixed(2)}% APY</span>
          {rec && (
            <span className={`ml-auto flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${rec.bg} ${rec.border} ${rec.text}`}>
              {rec.icon}{rec.label}
            </span>
          )}
        </div>

        {/* Route */}
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-1 flex-wrap">
          <span className="text-slate-300">{opp.fromProtocol}</span>
          <span className={`text-[10px] px-1 rounded ${CHAIN_COLORS[opp.fromChain] ?? ''}`}>{opp.fromChain}</span>
          <ArrowRight className="w-3 h-3 text-green-400 shrink-0" />
          <span className="text-slate-300 font-medium">{opp.toProtocol}</span>
          <span className={`text-[10px] px-1 rounded ${CHAIN_COLORS[opp.toChain] ?? ''}`}>{opp.toChain}</span>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          {opp.currentApy.toFixed(2)}% → <span className="text-emerald-400 font-medium">{opp.targetApy.toFixed(2)}%</span>
        </p>

        {/* ── Gain calculator for rotation ── */}
        <div className="pt-3 border-t border-slate-700/40">
          <div className="flex items-center gap-2 flex-wrap mb-2.5">
            <TrendingUp className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="text-xs text-slate-400">Se moveres</span>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">$</span>
              <input
                type="number"
                value={rotateAmount}
                onChange={(e) => setRotateAmount(e.target.value)}
                placeholder="0"
                className="w-24 bg-slate-900/70 border border-slate-600 rounded-lg pl-5 pr-2 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
            {rotateN > 0 ? (
              <div className="flex gap-2 text-xs">
                <span className="text-slate-500">extra/Mês <span className="text-emerald-400 font-semibold">+${extraPerMonth.toFixed(2)}</span></span>
                <span className="text-slate-500">Ano <span className="text-emerald-400 font-semibold">+${extraPerYear.toFixed(2)}</span></span>
              </div>
            ) : (
              <span className="text-[11px] text-slate-600 italic">para ver o ganho extra desta rotação</span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {link !== '#' && (
              <a href={link} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors">
                <ExternalLink className="w-3 h-3" />
                Rotar para {opp.toProtocol}
              </a>
            )}
            {!ai && (
              <button onClick={analyze} disabled={analyzing}
                className="flex items-center gap-1 px-2 py-1.5 text-[10px] text-purple-400 border border-purple-500/30 hover:border-purple-400 rounded-lg transition-colors disabled:opacity-50">
                <Brain className={`w-2.5 h-2.5 ${analyzing ? 'animate-pulse' : ''}`} />
                {analyzing ? 'IA…' : 'Analisar'}
              </button>
            )}
            <button onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-300 border border-slate-700 rounded-lg transition-colors">
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? 'Ocultar passos' : 'Ver passos'}
            </button>
          </div>
        </div>

        {ai?.reasoning && <p className="mt-2 text-xs text-slate-400 italic">"{ai.reasoning}"</p>}
      </div>

      {expanded && (
        <div className="border-t border-slate-700/50 bg-slate-900/40 px-4 py-3">
          <p className="text-[10px] font-semibold text-slate-400 uppercase mb-2">Como executar a rotação</p>
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
              Abrir {opp.toProtocol} — {opp.toChain}
            </a>
          )}
        </div>
      )}
    </div>
  )
}

type SubTab = 'pools' | 'rotations'

// ─── Main tab ────────────────────────────────────────────────────────────────

export function YieldTab() {
  const [data, setData]           = useState<YieldData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [activeAsset, setActiveAsset] = useState<string>('all')
  const [subTab, setSubTab]       = useState<SubTab>('pools')
  const [tabLoaded, setTabLoaded] = useState(false)

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res  = await fetch('/api/yield-rates')
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
    if (!tabLoaded) { setTabLoaded(true); fetchData() }
  }, [tabLoaded, fetchData])

  const pools    = data?.pools ?? []
  const opps     = data?.opportunities ?? []
  const hasError = !!data?.error

  const filteredPools = (activeAsset === 'all' ? pools : pools.filter((p) => p.asset === activeAsset))
    .sort((a, b) => b.apy - a.apy)
  const filteredOpps = activeAsset === 'all' ? opps : opps.filter((o) => o.asset === activeAsset)

  const bestAPY  = pools.length > 0 ? Math.max(...pools.map((p) => p.apy)) : 0
  const bestGain = opps.length  > 0 ? Math.max(...opps.map((o) => o.gainPct)) : 0

  return (
    <div className="space-y-4">
      <StrategyValidationPanel
        strategy="YIELD"
        label="Yield Farming Rotation"
        icon="🌿"
        timestamp={data?.timestamp ?? null}
        loading={loading}
        error={hasError}
        opportunityCount={opps.length}
        bestValueLabel={bestGain > 0 ? `+${bestGain.toFixed(2)}% APY` : null}
        sources={['DefiLlama', 'Aave V3', 'Compound V3']}
        alerts={{ urgent: 0, high: opps.filter((o) => o.gainPct > 5).length, medium: opps.filter((o) => o.gainPct > 2 && o.gainPct <= 5).length }}
        dataConfidence="HIGH"
      />

      <div className="flex flex-wrap items-center gap-3">
        <CapitalBadge strategy="YIELD" apy={bestGain || undefined} />
        <ReturnSimulator strategy="YIELD" apy={bestGain || undefined} chain="Base" />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-500 text-sm">A recolher APYs via DefiLlama…</p>
          </div>
        </div>
      )}

      {!loading && hasError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-semibold">Erro ao recolher APYs</p>
            <p className="text-red-300 text-sm mt-1 font-mono">{data?.error}</p>
          </div>
        </div>
      )}

      {!loading && !hasError && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3">
              <p className="text-xs text-slate-500">Melhor APY</p>
              <p className="text-2xl font-bold text-emerald-400">{bestAPY.toFixed(2)}%</p>
              <p className="text-[11px] text-slate-500 mt-0.5">rede de menor gas</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3">
              <p className="text-xs text-slate-500">Melhor rotação</p>
              <p className="text-2xl font-bold text-green-400">{bestGain > 0 ? `+${bestGain.toFixed(2)}%` : '—'}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">ganho ao mudar protocolo</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3">
              <p className="text-xs text-slate-500">Pools activos</p>
              <p className="text-2xl font-bold text-blue-400">{pools.length}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{opps.length} rotações disponíveis</p>
            </div>
          </div>

          {/* Sub-tabs + asset filter */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-1">
              <button onClick={() => setSubTab('pools')}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${subTab === 'pools' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-300 border border-slate-700'}`}>
                🏦 Depositar ({filteredPools.length})
              </button>
              <button onClick={() => setSubTab('rotations')}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${subTab === 'rotations' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-300 border border-slate-700'}`}>
                🔄 Rotações ({filteredOpps.length})
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              {(['all', 'USDC', 'USDT', 'DAI'] as const).map((a) => (
                <button key={a} onClick={() => setActiveAsset(a)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${activeAsset === a ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}>
                  {a === 'all' ? 'Todos' : a}
                </button>
              ))}
              <button onClick={() => fetchData(true)} disabled={refreshing}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 rounded-lg transition-colors disabled:opacity-50 ml-1">
                <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>
          </div>

          {/* Pools tab */}
          {subTab === 'pools' && (
            <div className="space-y-3">
              {filteredPools.length === 0 ? (
                <p className="text-center py-10 text-slate-500 text-sm">Nenhum pool encontrado</p>
              ) : (
                filteredPools.slice(0, 20).map((pool, i) => (
                  <YieldPoolCard key={`${pool.protocol}-${pool.chain}-${pool.asset}`} pool={pool} rank={i + 1} />
                ))
              )}
            </div>
          )}

          {/* Rotations tab */}
          {subTab === 'rotations' && (
            <div className="space-y-3">
              {filteredOpps.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm">
                  Nenhuma rotação encontrada{activeAsset !== 'all' && ` para ${activeAsset} — tenta "Todos"`}
                </div>
              ) : (
                filteredOpps.slice(0, 10).map((opp, i) => <OppCard key={i} opp={opp} />)
              )}
            </div>
          )}

          <MyPositions />

          {lastUpdate && (
            <p className="text-xs text-slate-700 text-right flex items-center justify-end gap-1">
              <Clock className="w-3 h-3" />
              {lastUpdate.toLocaleTimeString('pt-BR')} · Próxima atualização: 30 min
            </p>
          )}
        </>
      )}
    </div>
  )
}
