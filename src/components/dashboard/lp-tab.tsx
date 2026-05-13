'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Clock, Layers, Brain, ExternalLink, Zap, Eye, AlertTriangle, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react'
import { LPExecutePanel } from './lp-execute-panel'
import { useAccount } from 'wagmi'

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
  Base:     'bg-blue-600/20 text-blue-300 border-blue-600/30',
  Arbitrum: 'bg-sky-600/20 text-sky-300 border-sky-600/30',
  Optimism: 'bg-red-600/20 text-red-300 border-red-600/30',
  Ethereum: 'bg-slate-600/20 text-slate-300 border-slate-600/30',
  Polygon:  'bg-purple-600/20 text-purple-300 border-purple-600/30',
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
}

// Pools that can be executed directly inside the tool (Aerodrome Base only)
function canExecuteInTool(p: LPPool): boolean {
  const proto = p.protocol.toLowerCase()
  return (proto.includes('aerodrome') && p.chain === 'Base')
}

function fmtPct(n: number) { return `${n.toFixed(1)}%` }
function fmtTvl(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  return `$${(n / 1e3).toFixed(0)}K`
}
function fmtGain(amount: number, apy: number, days: number) {
  if (!amount || !apy) return '$0.00'
  return `$${((amount * apy / 100 / 365) * days).toFixed(2)}`
}

const REC_CFG = {
  ENTER: { bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/40', icon: <Zap className="w-3 h-3" />, label: 'ENTRAR' },
  WATCH: { bg: 'bg-yellow-500/10',  text: 'text-yellow-300',  border: 'border-yellow-500/40',  icon: <Eye className="w-3 h-3" />, label: 'OBSERVAR' },
  SKIP:  { bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/40',      icon: <AlertTriangle className="w-3 h-3" />, label: 'IGNORAR' },
}

// ─── Pool Card ────────────────────────────────────────────────────────────────

function PoolCard({
  p,
  rank,
  isOpen,
  onToggleDeposit,
  onAnalyze,
  analyzing,
}: {
  p: LPPool
  rank: number
  isOpen: boolean
  onToggleDeposit: () => void
  onAnalyze: () => void
  analyzing: boolean
}) {
  const [amount, setAmount] = useState('')
  const [ai, setAI] = useState<AIAnalysis | null>(null)
  const [showSteps, setShowSteps] = useState(false)
  const { isConnected } = useAccount()

  const label    = PROTOCOL_LABELS[p.protocol] ?? p.protocol
  const link     = PROTOCOL_LINKS[p.protocol] ?? '#'
  const inTool   = canExecuteInTool(p)
  const emPct    = p.realAPY > 0 ? (p.emissionAPY / p.realAPY) * 100 : 0
  const feePct   = 100 - emPct
  const amountN  = parseFloat(amount) || 0
  const rec      = ai ? REC_CFG[ai.recommendation] : null

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
    <div className={`rounded-xl border overflow-hidden transition-all ${
      isOpen ? 'border-emerald-500/40 bg-slate-800/70' : 'border-slate-700/50 bg-slate-800/40 hover:border-slate-600/60'
    }`}>
      {/* ── Header row ── */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Rank badge */}
          <div className="shrink-0 w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-400">
            {rank}
          </div>

          {/* Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-bold text-white">{label}</span>
              <span className="text-slate-300 font-medium">{p.pair}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${CHAIN_COLORS[p.chain] ?? 'bg-slate-600/20 text-slate-400 border-slate-600/30'}`}>
                {p.chain}
              </span>
              {p.rewardToken && (
                <span className="text-[10px] text-yellow-400/80 bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/20">
                  +{p.rewardToken}
                </span>
              )}
              {rec && (
                <span className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${rec.bg} ${rec.border} ${rec.text}`}>
                  {rec.icon}{rec.label}
                </span>
              )}
              {inTool && (
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  ✓ executa aqui
                </span>
              )}
            </div>

            {/* APY bar */}
            <div className="flex items-center gap-3 mt-1.5">
              <div className="flex-1 max-w-[160px]">
                <div className="flex h-2 rounded-full overflow-hidden bg-slate-700">
                  <div className="bg-emerald-500" style={{ width: `${feePct}%` }} title="Fee APY" />
                  <div className="bg-yellow-400" style={{ width: `${emPct}%` }} title="Emission APY" />
                </div>
                <div className="flex justify-between text-[10px] mt-0.5">
                  <span className="text-emerald-400">comissões {fmtPct(p.feeAPY)}</span>
                  <span className="text-yellow-400">recompensas {fmtPct(p.emissionAPY)}</span>
                </div>
              </div>
              <div className="text-xs text-slate-500">
                TVL <span className="text-slate-300">{fmtTvl(p.tvlUsd)}</span>
              </div>
              <div className="text-xs text-slate-500">
                Vol <span className="text-slate-300">{fmtTvl(p.volume24h)}</span>/dia
              </div>
            </div>
            {ai?.reasoning && (
              <p className="mt-1.5 text-xs text-slate-400 italic">"{ai.reasoning}"</p>
            )}
          </div>

          {/* APY + actions */}
          <div className="shrink-0 text-right flex flex-col items-end gap-1.5">
            <div>
              <p className="text-2xl font-bold text-emerald-400">{fmtPct(p.realAPY)}</p>
              <p className="text-[10px] text-slate-500 text-right">APY real</p>
            </div>
            <div className="flex items-center gap-1">
              {!ai && (
                <button onClick={analyze} disabled={analyzing}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] text-purple-400 border border-purple-500/30 hover:border-purple-400 rounded-lg transition-colors disabled:opacity-50">
                  <Brain className={`w-2.5 h-2.5 ${analyzing ? 'animate-pulse' : ''}`} />
                  {analyzing ? '…' : 'IA'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Gain calculator (always visible) ── */}
        <div className="mt-3 pt-3 border-t border-slate-700/40">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs text-slate-400">Quanto queres depositar?</span>
            </div>
            <div className="flex items-center gap-1.5">
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
              {amountN > 0 && (
                <div className="flex gap-2 text-xs">
                  <span className="text-slate-500">Dia <span className="text-emerald-400 font-semibold">{fmtGain(amountN, p.realAPY, 1)}</span></span>
                  <span className="text-slate-500">Mês <span className="text-emerald-400 font-semibold">{fmtGain(amountN, p.realAPY, 30)}</span></span>
                  <span className="text-slate-500">Ano <span className="text-emerald-400 font-semibold">{fmtGain(amountN, p.realAPY, 365)}</span></span>
                </div>
              )}
              {!amountN && (
                <span className="text-[11px] text-slate-600 italic">ex: $100 → Dia +$0.10 · Mês +$3.17 · Ano +$38</span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-2.5">
            {inTool ? (
              <button
                onClick={onToggleDeposit}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  isOpen
                    ? 'bg-emerald-600/20 border border-emerald-500/40 text-emerald-300'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                <Zap className="w-3 h-3" />
                {isOpen ? 'Fechar painel' : isConnected ? 'Depositar aqui — MetaMask' : 'Ver formulário de depósito'}
                {!isOpen && <ChevronDown className="w-3 h-3" />}
                {isOpen  && <ChevronUp className="w-3 h-3" />}
              </button>
            ) : (
              <a
                href={link} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-600 text-slate-300 hover:border-slate-500 hover:text-white rounded-lg transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Depositar em {label}
              </a>
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

        {/* ── Step-by-step guide ── */}
        {showSteps && (
          <div className="mt-3 pt-3 border-t border-slate-700/30 bg-slate-900/30 rounded-lg p-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase mb-2">Passo a passo</p>
            <ol className="space-y-1.5">
              {getSteps(p.protocol, p.chain, inTool).map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                  <span className="shrink-0 w-4 h-4 rounded-full bg-slate-700 text-slate-300 text-[10px] flex items-center justify-center font-bold">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* ── Inline deposit panel (Aerodrome only) ── */}
      {isOpen && inTool && (
        <div className="border-t border-emerald-500/30 bg-slate-900/50 p-4">
          <LPExecutePanel
            feeAPY={p.feeAPY}
            emissionAPY={p.emissionAPY}
          />
        </div>
      )}
    </div>
  )
}

function getSteps(protocol: string, chain: string, inTool: boolean): string[] {
  if (inTool) return [
    'Liga a carteira MetaMask (botão no topo)',
    'Muda a rede para ' + chain + ' no seletor de rede',
    'Introduz o valor que queres depositar no campo acima',
    'Clica "Depositar aqui" — abre o painel de execução',
    'Aprova o USDC e depois confirma o depósito (2 passos na MetaMask)',
    'Os ganhos acumulam automaticamente na tua posição',
  ]
  const proto = protocol.toLowerCase()
  if (proto.includes('curve')) return [
    'Abre curve.finance/pools',
    `Muda a MetaMask para ${chain}`,
    'Procura o par e clica "Deposit"',
    'Escolhe o token e o valor',
    'Confirma aprovação + depósito na MetaMask',
  ]
  if (proto.includes('uniswap')) return [
    'Abre app.uniswap.org → Pools → New Position',
    `Muda a MetaMask para ${chain}`,
    'Seleciona o par e fee tier (0.05% para stables)',
    'Define o range de preço (full range para começar)',
    'Confirma na MetaMask',
  ]
  if (proto.includes('velodrome')) return [
    'Abre velodrome.finance/liquidity',
    `Muda a MetaMask para ${chain}`,
    'Procura o par estável e clica "Add Liquidity"',
    'Confirma as aprovações + depósito na MetaMask',
  ]
  return [
    `Abre o site do ${PROTOCOL_LABELS[protocol] ?? protocol}`,
    `Muda a MetaMask para ${chain}`,
    'Vai à secção Liquidity / Pools',
    'Adiciona o valor e confirma na MetaMask',
  ]
}

type SubTab = 'stablecoin' | 'base' | 'all'
const STABLECOINS = ['USDC', 'USDT', 'DAI', 'FRAX', 'CRVUSD', 'USDBC']
function isStable(pair: string) { return STABLECOINS.some((s) => pair.toUpperCase().includes(s)) }

// ─── Main tab ────────────────────────────────────────────────────────────────

export function LPTab() {
  const [pools, setPools]           = useState<LPPool[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [subTab, setSubTab]         = useState<SubTab>('stablecoin')
  const [timestamp, setTimestamp]   = useState('')
  const [openPoolId, setOpenPoolId] = useState<string | null>(null)
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)

  const load = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/lp-pools${forceRefresh ? '?refresh=true' : ''}`)
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

  const filtered = pools
    .filter((p) => {
      if (subTab === 'stablecoin') return isStable(p.pair)
      if (subTab === 'base')       return p.chain === 'Base'
      return true
    })
    .sort((a, b) => b.realAPY - a.realAPY)

  const bestAPY  = filtered.length > 0 ? Math.max(...filtered.map((p) => p.realAPY)) : 0
  const avgFee   = filtered.length > 0 ? filtered.reduce((s, p) => s + p.feeAPY, 0) / filtered.length : 0
  const inToolCt = filtered.filter(canExecuteInTool).length

  const SUB_TABS: { id: SubTab; label: string; count: number }[] = [
    { id: 'stablecoin', label: '🔵 Stablecoin', count: pools.filter((p) => isStable(p.pair)).length },
    { id: 'base',       label: '🔷 Base',        count: pools.filter((p) => p.chain === 'Base').length },
    { id: 'all',        label: 'Todos',           count: pools.length },
  ]

  return (
    <div className="space-y-4">

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3">
          <p className="text-xs text-slate-500">Melhor APY</p>
          <p className="text-2xl font-bold text-emerald-400">{fmtPct(bestAPY)}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">comissões + recompensas</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3">
          <p className="text-xs text-slate-500">Fee médio</p>
          <p className="text-2xl font-bold text-blue-400">{fmtPct(avgFee)}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">comissões reais de troca</p>
        </div>
        <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-xl p-3">
          <p className="text-xs text-emerald-400/80">Executáveis aqui</p>
          <p className="text-2xl font-bold text-emerald-300">{inToolCt}</p>
          <p className="text-[11px] text-emerald-500/80 mt-0.5">Aerodrome Base via MetaMask</p>
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center gap-4 text-[11px] text-slate-500 bg-slate-800/30 border border-slate-700/30 rounded-lg px-3 py-2">
        <Layers className="w-3 h-3 shrink-0" />
        <span>APY Real = comissões de troca + recompensas do protocolo</span>
        <div className="flex items-center gap-2 ml-auto">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> comissões (sustentáveis)
          <span className="w-2.5 h-2.5 rounded-sm bg-yellow-400 inline-block ml-1" /> recompensas (variáveis)
        </div>
      </div>

      {/* ── Sub-tab filter ── */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {SUB_TABS.map((t) => (
            <button key={t.id} onClick={() => setSubTab(t.id)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${subTab === t.id ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-300 border border-slate-700'}`}>
              {t.label} <span className="text-slate-500 ml-0.5">({t.count})</span>
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
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 rounded-lg transition-colors disabled:opacity-50">
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* ── States ── */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-400 text-sm gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" /> A carregar pools…
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">{error}</div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-16 text-slate-500 text-sm">
          Nenhum pool encontrado. Clica em Atualizar.
        </div>
      )}

      {/* ── Pool list ── */}
      {!loading && !error && (
        <div className="space-y-3">
          {filtered.map((p, i) => (
            <PoolCard
              key={p.poolId ?? p.id ?? `${p.protocol}-${p.chain}-${p.pair}`}
              p={p}
              rank={i + 1}
              isOpen={openPoolId === (p.poolId ?? p.id)}
              onToggleDeposit={() => {
                const pid = p.poolId ?? p.id
                setOpenPoolId(openPoolId === pid ? null : pid)
              }}
              onAnalyze={() => setAnalyzingId(p.poolId)}
              analyzing={analyzingId === p.poolId}
            />
          ))}
        </div>
      )}
    </div>
  )
}
