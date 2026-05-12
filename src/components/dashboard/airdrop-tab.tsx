'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, ExternalLink, Shield, Clock, Brain, ChevronDown, ChevronUp, Zap, AlertTriangle, CheckCircle, Eye } from 'lucide-react'

interface AIData {
  recommendation: 'ENTER' | 'WATCH' | 'SKIP'
  reasoning: string
  risks: string[]
  isLegit: boolean
  verifyAnalysis: string
  score: number
}

interface AirdropCandidate {
  id: string
  protocol: string
  chain: string
  tvlUsd: number
  tier: string
  confidenceScore: number
  estimatedValueMin: number
  estimatedValueMax: number
  probability: number
  category: string
  website: string
  twitter: string
  aiAnalysis?: string
  updatedAt?: string
}

const TIER_COLORS: Record<string, string> = {
  S: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  A: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  B: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  C: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
}

const CHAIN_COLORS: Record<string, string> = {
  Base:     'bg-blue-600/20 text-blue-300',
  Arbitrum: 'bg-sky-600/20 text-sky-300',
  Optimism: 'bg-red-600/20 text-red-300',
  Ethereum: 'bg-slate-600/20 text-slate-300',
  Polygon:  'bg-purple-600/20 text-purple-300',
}

const REC_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
  ENTER: { bg: 'bg-emerald-500/15 border-emerald-500/40', text: 'text-emerald-300', icon: <Zap className="w-3 h-3" />, label: 'ENTRAR' },
  WATCH: { bg: 'bg-yellow-500/15 border-yellow-500/40', text: 'text-yellow-300', icon: <Eye className="w-3 h-3" />, label: 'OBSERVAR' },
  SKIP:  { bg: 'bg-red-500/15 border-red-500/40',       text: 'text-red-400',    icon: <AlertTriangle className="w-3 h-3" />, label: 'IGNORAR' },
}

// Execution steps per category
const EXECUTION_STEPS: Record<string, string[]> = {
  Dexes:        ['Liga a tua MetaMask ao site oficial', 'Faz uma troca de $1–$5 (ex: ETH → USDC)', 'Repete 1×/semana para manter atividade', 'Guarda o hash da transação'],
  Lending:      ['Liga a tua MetaMask ao site oficial', 'Deposita $1–$5 USDC (ou o token nativo)', 'Mantém o depósito ativo pelo menos 30 dias', 'Interaje 1×/mês (deposit/withdraw/borrow)'],
  Bridge:       ['Liga a tua MetaMask ao site oficial', 'Faz uma ponte de $1 entre chains (ex: ETH → Base)', 'Usa a bridge em direções diferentes em semanas diferentes'],
  'Liquid Staking': ['Liga a tua MetaMask ao site oficial', 'Deposita $1–$5 de ETH para staking', 'Mantém pelo menos 30 dias'],
  CDP:          ['Liga a tua MetaMask ao site oficial', 'Deposita colateral mínimo e abre uma posição', 'Mantém a posição ativa'],
  Yield:        ['Liga a tua MetaMask ao site oficial', 'Deposita $1–$5 na vault com melhor APY', 'Mantém ativo pelo menos 30 dias'],
  default:      ['Liga a tua MetaMask ao site oficial', 'Interage com o protocolo uma vez ($1–$5)', 'Mantém conta ativa — visita 1×/semana', 'Guarda prova de cada transação'],
}

function getSteps(category: string): string[] {
  return EXECUTION_STEPS[category] ?? EXECUTION_STEPS.default
}

function fmt(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function parseAI(raw?: string): AIData | null {
  if (!raw) return null
  try { return JSON.parse(raw) as AIData } catch { return null }
}

type SubTab = 'radar' | 'a_tier' | 'b_tier'

function TopPickPanel({ candidate }: { candidate: AirdropCandidate }) {
  const ai = parseAI(candidate.aiAnalysis)
  const rec = ai ? REC_STYLES[ai.recommendation] : REC_STYLES.WATCH
  const steps = getSteps(candidate.category)

  return (
    <div className={`border rounded-xl p-4 ${rec.bg}`}>
      <div className="flex items-center gap-2 mb-3">
        <Brain className={`w-4 h-4 ${rec.text}`} />
        <span className={`text-xs font-bold uppercase ${rec.text}`}>Melhor Oportunidade IA</span>
        {ai && (
          <span className={`ml-auto flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${rec.bg} ${rec.text}`}>
            {rec.icon}
            {rec.label}
          </span>
        )}
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-bold text-lg">{candidate.protocol}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${TIER_COLORS[candidate.tier] ?? ''}`}>
              Tier {candidate.tier}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${CHAIN_COLORS[candidate.chain] ?? 'bg-slate-600/20 text-slate-400'}`}>
              {candidate.chain}
            </span>
          </div>
          <div className="flex gap-4 mt-1 text-xs text-slate-400">
            <span>TVL <span className="text-slate-200 font-medium">{fmt(candidate.tvlUsd)}</span></span>
            <span>Est. <span className="text-emerald-400 font-medium">${candidate.estimatedValueMin}–${candidate.estimatedValueMax}</span></span>
            <span>Prob. <span className="text-slate-200 font-medium">{Math.round((candidate.probability ?? 0) * 100)}%</span></span>
          </div>
          {ai?.reasoning && (
            <p className="mt-2 text-xs text-slate-300 italic">"{ai.reasoning}"</p>
          )}
          {ai?.risks && ai.risks.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {ai.risks.map((r) => (
                <span key={r} className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded">
                  {r}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p className="text-2xl font-bold text-white">{ai?.score ?? candidate.confidenceScore}</p>
          <p className="text-[10px] text-slate-500">score IA</p>
        </div>
      </div>

      {/* Execution guide */}
      <div className="mt-4 border-t border-white/10 pt-3">
        <p className="text-xs font-semibold text-slate-300 mb-2">Como executar com $1–$5:</p>
        <ol className="space-y-1">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
              <span className="shrink-0 w-4 h-4 rounded-full bg-slate-700 text-slate-300 text-[10px] flex items-center justify-center font-bold">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
        {candidate.website && (
          <a
            href={candidate.website}
            target="_blank"
            rel="noopener noreferrer"
            className={`mt-3 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${rec.bg} ${rec.text} hover:opacity-80`}
          >
            <ExternalLink className="w-3 h-3" />
            Ir para {candidate.protocol}
          </a>
        )}
      </div>
    </div>
  )
}

function CandidateCard({ c, onAnalyze, analyzing }: {
  c: AirdropCandidate
  onAnalyze: (c: AirdropCandidate) => void
  analyzing: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const ai = parseAI(c.aiAnalysis)
  const rec = ai ? REC_STYLES[ai.recommendation] : null
  const steps = getSteps(c.category)

  return (
    <div className="bg-slate-800/40 border border-slate-700/50 hover:border-slate-600/50 rounded-lg overflow-hidden transition-colors">
      <div className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-white text-sm">{c.protocol}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${TIER_COLORS[c.tier] ?? TIER_COLORS.C}`}>
                Tier {c.tier}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${CHAIN_COLORS[c.chain] ?? 'bg-slate-600/20 text-slate-400'}`}>
                {c.chain}
              </span>
              {c.category && <span className="text-[10px] text-slate-500">{c.category}</span>}
              {rec && (
                <span className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${rec.bg} ${rec.text}`}>
                  {rec.icon}{rec.label}
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 mt-1.5 flex-wrap">
              <span className="text-xs text-slate-400">TVL <span className="text-slate-200 font-medium">{fmt(c.tvlUsd ?? 0)}</span></span>
              <span className="text-xs text-slate-400">Est. <span className="text-emerald-400 font-medium">${c.estimatedValueMin}–${c.estimatedValueMax}</span></span>
              <span className="text-xs text-slate-400">Prob. <span className="text-slate-200 font-medium">{Math.round((c.probability ?? 0) * 100)}%</span></span>
              {ai && <span className="text-xs text-slate-400">Score <span className="text-slate-200 font-medium">{ai.score}</span></span>}
            </div>

            {ai?.reasoning && (
              <p className="mt-1.5 text-xs text-slate-400 italic">"{ai.reasoning}"</p>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {!ai && (
              <button
                onClick={() => onAnalyze(c)}
                disabled={analyzing}
                className="flex items-center gap-1 px-2 py-1 text-[10px] text-purple-400 border border-purple-500/30 hover:border-purple-400 rounded-md transition-colors disabled:opacity-50"
              >
                <Brain className={`w-3 h-3 ${analyzing ? 'animate-pulse' : ''}`} />
                {analyzing ? 'Analisando…' : 'IA'}
              </button>
            )}
            {ai && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                <CheckCircle className="w-3 h-3" />
              </span>
            )}
            {c.website && (
              <a href={c.website} target="_blank" rel="noopener noreferrer"
                className="text-slate-500 hover:text-slate-300 p-1 transition-colors" title="Website">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-slate-500 hover:text-slate-300 p-1 transition-colors"
              title="Ver estratégia"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded execution guide */}
      {expanded && (
        <div className="border-t border-slate-700/50 bg-slate-900/40 px-3 py-3">
          <p className="text-[10px] font-semibold text-slate-400 uppercase mb-2">Como executar com $1–$5</p>
          <ol className="space-y-1.5">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                <span className="shrink-0 w-4 h-4 rounded-full bg-slate-700 text-slate-300 text-[10px] flex items-center justify-center font-bold">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          {ai?.risks && ai.risks.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {ai.risks.map((r) => (
                <span key={r} className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded">{r}</span>
              ))}
            </div>
          )}
          {!ai && (
            <button
              onClick={() => onAnalyze(c)}
              className="mt-2 flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
            >
              <Brain className="w-3 h-3" />
              Pedir diagnóstico IA para este protocolo
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function AirdropTab() {
  const [candidates, setCandidates] = useState<AirdropCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subTab, setSubTab] = useState<SubTab>('a_tier')
  const [timestamp, setTimestamp] = useState<string>('')
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)

  const load = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const url = `/api/airdrops${forceRefresh ? '?refresh=true' : ''}`
      const res = await fetch(url)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      setCandidates(json.data ?? [])
      setTimestamp(json.timestamp ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleAnalyze = useCallback(async (c: AirdropCandidate) => {
    setAnalyzingId(c.id ?? `${c.protocol}-${c.chain}`)
    try {
      const res = await fetch('/api/airdrops/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocol: c.protocol, tvl: c.tvlUsd, chain: c.chain, id: c.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setCandidates((prev) =>
        prev.map((x) =>
          x.protocol === c.protocol && x.chain === c.chain
            ? { ...x, aiAnalysis: json.aiAnalysis, confidenceScore: json.confidenceScore }
            : x
        )
      )
    } catch (e) {
      console.error('[ai-analyze]', e)
    } finally {
      setAnalyzingId(null)
    }
  }, [])

  const filtered = candidates.filter((c) => {
    if (subTab === 'a_tier') return c.tier === 'A' || c.tier === 'S'
    if (subTab === 'b_tier') return c.tier === 'B'
    return true
  })

  // Best candidate = highest AI score, then highest TVL
  const topPick = [...candidates]
    .filter((c) => c.tier === 'S' || c.tier === 'A')
    .sort((a, b) => {
      const sa = parseAI(a.aiAnalysis)?.score ?? a.confidenceScore
      const sb = parseAI(b.aiAnalysis)?.score ?? b.confidenceScore
      return sb - sa
    })[0]

  const baseCandidates = candidates.filter((c) => c.chain === 'Base').length
  const totalEstMax = candidates
    .filter((c) => c.tier === 'A' || c.tier === 'S')
    .reduce((s, c) => s + c.estimatedValueMax, 0)

  const SUB_TABS: { id: SubTab; label: string; count: number }[] = [
    { id: 'a_tier', label: 'Tier A/S', count: candidates.filter((c) => c.tier === 'A' || c.tier === 'S').length },
    { id: 'b_tier', label: 'Tier B',   count: candidates.filter((c) => c.tier === 'B').length },
    { id: 'radar',  label: 'Radar completo', count: candidates.length },
  ]

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
          <p className="text-xs text-slate-500">Candidatos ativos</p>
          <p className="text-xl font-bold text-white">{candidates.length}</p>
          <p className="text-xs text-slate-400">{baseCandidates} em Base</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
          <p className="text-xs text-slate-500">Potencial A/S</p>
          <p className="text-xl font-bold text-emerald-400">${totalEstMax.toLocaleString()}</p>
          <p className="text-xs text-slate-400">valor estimado max</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
          <p className="text-xs text-slate-500">Estratégia</p>
          <p className="text-sm font-bold text-blue-400">$0.50–$5</p>
          <p className="text-xs text-slate-400">dusting por protocolo</p>
        </div>
      </div>

      {/* Top pick IA */}
      {!loading && topPick && <TopPickPanel candidate={topPick} />}

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {SUB_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                subTab === t.id ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              {t.label}
              <span className="ml-1 text-slate-500">({t.count})</span>
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
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-white border border-slate-700 rounded-md transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'A analisar…' : 'Atualizar + IA'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
          <RefreshCw className="w-4 h-4 animate-spin mr-2" />
          A carregar e analisar candidatos…
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">{error}</div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-12 text-slate-500 text-sm">
          Nenhum candidato encontrado. Clica em &quot;Atualizar + IA&quot; para fazer scan.
        </div>
      )}

      {/* Candidate list */}
      <div className="space-y-2">
        {filtered.map((c) => (
          <CandidateCard
            key={c.id ?? `${c.protocol}-${c.chain}`}
            c={c}
            onAnalyze={handleAnalyze}
            analyzing={analyzingId === (c.id ?? `${c.protocol}-${c.chain}`)}
          />
        ))}
      </div>

      <div className="flex items-start gap-2 bg-slate-800/30 border border-slate-700/30 rounded-lg p-3 text-xs text-slate-500">
        <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-600" />
        <span>
          Airdrops nunca são garantidos. Verifica sempre o contrato oficial antes de interagir.
          O scanner NUNCA executa transações — toda acção requer confirmação manual via MetaMask.
          Análise IA via GPT-4o-mini — não é aconselhamento financeiro.
        </span>
      </div>
    </div>
  )
}
