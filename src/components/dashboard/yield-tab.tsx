'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, AlertCircle, ArrowRight, Brain, ExternalLink, Zap, Eye, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { StrategyValidationPanel } from './strategy-validation-panel'
import { CapitalBadge } from '@/components/CapitalBadge'
import { ReturnSimulator } from '@/components/ReturnSimulator'
import { ExecutePanel } from './execute-panel'
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
  ENTER: { bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/40', icon: <Zap className="w-3.5 h-3.5" />, label: 'ENTRAR' },
  WATCH: { bg: 'bg-yellow-500/10',  text: 'text-yellow-300',  border: 'border-yellow-500/40',  icon: <Eye className="w-3.5 h-3.5" />, label: 'OBSERVAR' },
  SKIP:  { bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/40',      icon: <AlertTriangle className="w-3.5 h-3.5" />, label: 'IGNORAR' },
}

// Direct protocol links
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
  'Aave V3':     ['Abre o link do Aave abaixo', 'Muda a rede da MetaMask para a chain indicada', 'Clica em "Supply" ao lado de USDC', 'Introduz o valor e confirma na MetaMask', 'Começas a ganhar APY imediatamente'],
  'Compound V3': ['Abre o link do Compound abaixo', 'Muda a rede da MetaMask para a chain indicada', 'Clica em "Supply" na coluna USDC', 'Aprova o contrato (1ª vez) + confirma o depósito', 'Juros acumulam-se por bloco'],
  default:       ['Abre o link do protocolo', 'Muda a rede da MetaMask para a chain indicada', 'Vai à secção de "Supply" ou "Deposit"', 'Deposita o valor desejado e confirma na MetaMask'],
}

function getSteps(protocol: string): string[] {
  return YIELD_STEPS[protocol] ?? YIELD_STEPS.default
}

function fmtTvl(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  return `$${(n / 1e3).toFixed(0)}K`
}

function TopYieldPick({ pool, ai }: { pool: YieldPool; ai: AIAnalysis | null }) {
  const rec = ai ? REC_STYLES[ai.recommendation] : REC_STYLES.WATCH
  const steps = getSteps(pool.protocol)
  const link = getLink(pool.protocol, pool.chain)

  return (
    <div className={`border rounded-xl p-4 ${rec.bg} ${rec.border}`}>
      <div className="flex items-center gap-2 mb-3">
        <Brain className={`w-4 h-4 ${rec.text}`} />
        <span className={`text-xs font-bold uppercase ${rec.text}`}>Melhor Oportunidade IA — Yield</span>
        {ai && (
          <span className={`ml-auto flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${rec.bg} ${rec.border} ${rec.text}`}>
            {rec.icon}{rec.label}
          </span>
        )}
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-bold text-lg">{pool.protocol}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${CHAIN_COLORS[pool.chain] ?? 'text-slate-400 border-slate-600'}`}>
              {pool.chain}
            </span>
            <span className={`font-semibold text-sm ${ASSET_COLORS[pool.asset] ?? 'text-slate-200'}`}>{pool.asset}</span>
          </div>
          <div className="flex gap-4 mt-1 text-xs text-slate-400">
            <span>APY Base <span className="text-emerald-400 font-medium">{pool.apyBase.toFixed(2)}%</span></span>
            {pool.apyReward > 0 && <span>+ Reward <span className="text-blue-400 font-medium">{pool.apyReward.toFixed(2)}%</span></span>}
            <span>TVL <span className="text-slate-200 font-medium">{fmtTvl(pool.tvlUsd)}</span></span>
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
          <p className="text-3xl font-bold text-emerald-400">{pool.apy.toFixed(2)}%</p>
          <p className="text-[10px] text-slate-500">APY total</p>
          {ai && <p className="text-sm font-bold text-slate-300 mt-1">Score {ai.score}</p>}
        </div>
      </div>

      <div className="mt-4 border-t border-white/10 pt-3">
        <p className="text-xs font-semibold text-slate-300 mb-2">Como depositar (passo a passo):</p>
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
            className={`mt-3 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${rec.bg} ${rec.border} ${rec.text} hover:opacity-80`}
          >
            <ExternalLink className="w-3 h-3" />
            Abrir {pool.protocol} — {pool.chain}
          </a>
        )}
      </div>
    </div>
  )
}

function OppCard({ opp }: { opp: YieldOpportunity }) {
  const [expanded, setExpanded] = useState(false)
  const [ai, setAI] = useState<AIAnalysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const link = getLink(opp.toProtocol, opp.toChain)
  const steps = getSteps(opp.toProtocol)

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

  const rec = ai ? REC_STYLES[ai.recommendation] : null

  return (
    <div className="bg-slate-800/60 border border-green-500/20 rounded-xl overflow-hidden">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className={`font-semibold ${ASSET_COLORS[opp.asset] ?? 'text-slate-200'}`}>{opp.asset}</span>
          <span className="text-green-400 font-bold text-sm">+{opp.gainPct.toFixed(2)}% APY</span>
          {rec && (
            <span className={`ml-auto flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${rec.bg} ${rec.border} ${rec.text}`}>
              {rec.icon}{rec.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="text-slate-300">{opp.fromProtocol}</span>
          <span className={`text-[10px] px-1 rounded ${CHAIN_COLORS[opp.fromChain] ?? ''}`}>{opp.fromChain}</span>
          <ArrowRight className="w-3 h-3 text-green-400" />
          <span className="text-slate-300 font-medium">{opp.toProtocol}</span>
          <span className={`text-[10px] px-1 rounded ${CHAIN_COLORS[opp.toChain] ?? ''}`}>{opp.toChain}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-slate-500">{opp.currentApy.toFixed(2)}% → <span className="text-emerald-400 font-medium">{opp.targetApy.toFixed(2)}%</span></span>
          <div className="flex items-center gap-1">
            {!ai && (
              <button onClick={analyze} disabled={analyzing}
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-purple-400 border border-purple-500/30 hover:border-purple-400 rounded transition-colors disabled:opacity-50">
                <Brain className={`w-2.5 h-2.5 ${analyzing ? 'animate-pulse' : ''}`} />
                {analyzing ? 'IA…' : 'Analisar'}
              </button>
            )}
            <button onClick={() => setExpanded(!expanded)}
              className="text-slate-500 hover:text-slate-300 p-0.5 transition-colors">
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        {ai?.reasoning && <p className="mt-1.5 text-xs text-slate-400 italic">"{ai.reasoning}"</p>}
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

export function YieldTab() {
  const [data, setData] = useState<YieldData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [activeAsset, setActiveAsset] = useState<string>('all')
  const [topAI, setTopAI] = useState<AIAnalysis | null>(null)
  const [analyzingTop, setAnalyzingTop] = useState(false)
  const [tabLoaded, setTabLoaded] = useState(false)

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch('/api/yield-rates')
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

  const pools = data?.pools ?? []
  const opps = data?.opportunities ?? []
  const bestPerAsset = data?.bestPerAsset ?? {}
  const hasError = !!data?.error

  const filteredPools = activeAsset === 'all' ? pools : pools.filter((p) => p.asset === activeAsset)
  const filteredOpps  = activeAsset === 'all' ? opps  : opps.filter((o) => o.asset === activeAsset)
  const bestGain = opps.length > 0 ? Math.max(...opps.map((o) => o.gainPct)) : null

  // Best pool = highest APY on Base/Polygon (low gas)
  const topPool = pools
    .filter((p) => p.chain === 'Base' || p.chain === 'Polygon' || p.chain === 'Arbitrum')
    .sort((a, b) => b.apy - a.apy)[0] ?? pools[0]

  const analyzeTop = useCallback(async (pool: YieldPool) => {
    setAnalyzingTop(true)
    try {
      const res = await fetch('/api/analyze-opportunity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocol: pool.protocol, chain: pool.chain, apy: pool.apy, tvl: pool.tvlUsd, type: 'YIELD' }),
      })
      const json = await res.json()
      if (json.analysis) setTopAI(json.analysis)
    } catch { /* ignore */ } finally { setAnalyzingTop(false) }
  }, [])

  // AI analysis only on user request — don't auto-run on mount

  return (
    <div className="space-y-6">
      <StrategyValidationPanel
        strategy="YIELD"
        label="Yield Farming Rotation"
        icon="🌿"
        timestamp={data?.timestamp ?? null}
        loading={loading}
        error={hasError}
        opportunityCount={opps.length}
        bestValueLabel={bestGain != null && bestGain > 0 ? `+${bestGain.toFixed(2)}% APY` : null}
        sources={['DefiLlama', 'Aave V3', 'Compound V3']}
        alerts={{ urgent: 0, high: opps.filter((o) => o.gainPct > 5).length, medium: opps.filter((o) => o.gainPct > 2 && o.gainPct <= 5).length }}
        dataConfidence="HIGH"
      />

      <div className="flex flex-wrap items-center gap-3">
        <CapitalBadge strategy="YIELD" apy={bestGain ?? undefined} />
        <ReturnSimulator strategy="YIELD" apy={bestGain ?? undefined} chain="Base" />
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
          {/* Execute directly inside the tool */}
          <ExecutePanel apy={topPool?.apy ?? bestGain ?? 0} />

          {/* Top Pick IA */}
          {topPool && (
            <div>
              {analyzingTop && !topAI ? (
                <div className="border border-slate-700/50 rounded-xl p-4 flex items-center gap-2 text-xs text-slate-400">
                  <Brain className="w-4 h-4 animate-pulse text-purple-400" />
                  A analisar melhor oportunidade com IA…
                  <button onClick={() => analyzeTop(topPool)} className="ml-auto text-xs text-purple-400 hover:text-purple-300">
                    Analisar agora
                  </button>
                </div>
              ) : topAI ? (
                <TopYieldPick pool={topPool} ai={topAI} />
              ) : (
                <div className="flex justify-end">
                  <button
                    onClick={() => analyzeTop(topPool)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-purple-400 border border-purple-500/30 hover:border-purple-400 rounded-lg transition-colors"
                  >
                    <Brain className="w-3 h-3" />
                    Análise IA do melhor pool
                  </button>
                </div>
              )}
            </div>
          )}

          {/* My active positions */}
          <MyPositions />

          {/* Best per asset */}
          <div className="grid grid-cols-3 gap-3">
            {['USDC', 'USDT', 'DAI'].map((asset) => {
              const best = bestPerAsset[asset]
              return (
                <div key={asset} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
                  <p className={`text-xs font-semibold mb-1 ${ASSET_COLORS[asset] ?? 'text-slate-400'}`}>{asset}</p>
                  {best ? (
                    <>
                      <p className="text-2xl font-bold text-emerald-400">{best.apy.toFixed(2)}%</p>
                      <p className="text-xs text-slate-500 mt-1">{best.protocol} · {best.chain}</p>
                    </>
                  ) : <p className="text-slate-600 text-sm">Sem dados</p>}
                </div>
              )
            })}
          </div>

          {/* Rotation opportunities */}
          {filteredOpps.length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-green-400" />
                Oportunidades de rotação ({filteredOpps.length})
                <span className="text-xs text-slate-500 font-normal">— clica ▾ para ver como executar</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredOpps.slice(0, 6).map((opp, i) => <OppCard key={i} opp={opp} />)}
              </div>
            </div>
          )}

          {/* Filter + pools table */}
          <div className="flex gap-2 items-center">
            {(['all', 'USDC', 'USDT', 'DAI'] as const).map((a) => (
              <button key={a} onClick={() => setActiveAsset(a)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeAsset === a ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}>
                {a === 'all' ? 'Todos' : a} {a !== 'all' && `(${pools.filter((p) => p.asset === a).length})`}
              </button>
            ))}
            <div className="ml-auto">
              <button onClick={() => fetchData(true)} disabled={refreshing}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50 bg-slate-900/50">
                    <th className="text-left p-3 text-slate-400 font-medium">Protocol</th>
                    <th className="text-left p-3 text-slate-400 font-medium">Chain</th>
                    <th className="text-left p-3 text-slate-400 font-medium">Asset</th>
                    <th className="text-right p-3 text-slate-400 font-medium">APY Base</th>
                    <th className="text-right p-3 text-slate-400 font-medium">APY Reward</th>
                    <th className="text-right p-3 text-slate-400 font-medium">APY Total</th>
                    <th className="text-right p-3 text-slate-400 font-medium">TVL</th>
                    <th className="text-right p-3 text-slate-400 font-medium">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPools.slice(0, 30).map((pool, i) => (
                    <tr key={i} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                      <td className="p-3 font-medium text-slate-200">{pool.protocol}</td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${CHAIN_COLORS[pool.chain] ?? 'text-slate-400 border-slate-600'}`}>{pool.chain}</span>
                      </td>
                      <td className={`p-3 font-semibold ${ASSET_COLORS[pool.asset] ?? 'text-slate-300'}`}>{pool.asset}</td>
                      <td className="p-3 text-right font-mono text-slate-300">{pool.apyBase.toFixed(2)}%</td>
                      <td className="p-3 text-right font-mono text-blue-400">{pool.apyReward > 0 ? `+${pool.apyReward.toFixed(2)}%` : '—'}</td>
                      <td className={`p-3 text-right font-mono font-semibold ${pool.apy > 5 ? 'text-emerald-400' : 'text-slate-300'}`}>{pool.apy.toFixed(2)}%</td>
                      <td className="p-3 text-right text-slate-500 text-xs">{fmtTvl(pool.tvlUsd)}</td>
                      <td className="p-3 text-right">
                        {getLink(pool.protocol, pool.chain) !== '#' && (
                          <a href={getLink(pool.protocol, pool.chain)} target="_blank" rel="noopener noreferrer"
                            className="text-slate-600 hover:text-slate-300 transition-colors">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredPools.length === 0 && <p className="p-8 text-center text-slate-500">Nenhum pool encontrado</p>}
            </div>
          </div>

          {lastUpdate && (
            <p className="text-xs text-slate-700 text-right">
              Actualizado: {lastUpdate.toLocaleTimeString('pt-BR')} · Próxima atualização: 30 min
            </p>
          )}
        </>
      )}
    </div>
  )
}
