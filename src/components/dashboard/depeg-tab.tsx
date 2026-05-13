'use client'

import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, CheckCircle2, RefreshCw, AlertCircle, Shield, TrendingUp, Zap, ChevronDown, ChevronUp } from 'lucide-react'
import { StrategyValidationPanel } from './strategy-validation-panel'
import { CapitalBadge } from '@/components/CapitalBadge'
import { ReturnSimulator } from '@/components/ReturnSimulator'
import { DepegExecutePanel } from './depeg-execute-panel'

interface StablecoinStatus {
  symbol: string
  name: string
  price: number
  deviationPct: number
  status: 'OK' | 'WARNING' | 'ALERT'
  source: string
  timestamp: string
}

interface DepegData {
  stablecoins?: StablecoinStatus[]
  alerts?: StablecoinStatus[]
  timestamp?: string
  error?: string
}

const STATUS_CONFIG = {
  OK: {
    bg:    'bg-emerald-500/10 border-emerald-500/30',
    text:  'text-emerald-400',
    icon:  CheckCircle2,
    label: 'Estável',
  },
  WARNING: {
    bg:    'bg-yellow-500/10 border-yellow-500/30',
    text:  'text-yellow-400',
    icon:  AlertTriangle,
    label: 'Aviso',
  },
  ALERT: {
    bg:    'bg-red-500/10 border-red-500/30',
    text:  'text-red-400',
    icon:  AlertTriangle,
    label: 'DEPEG!',
  },
}

// ─── Stablecoin card with inline opportunity calculator ───────────────────────

function StablecoinCard({
  coin,
  isOpen,
  onToggleExecute,
}: {
  coin: StablecoinStatus
  isOpen: boolean
  onToggleExecute: () => void
}) {
  const [investAmount, setInvestAmount] = useState('')
  const cfg          = STATUS_CONFIG[coin.status]
  const Icon         = cfg.icon
  const absDeviation = Math.abs(coin.deviationPct)
  const investN      = parseFloat(investAmount) || 0
  const isOpportunity = coin.status === 'ALERT' || coin.status === 'WARNING'
  // Gain = amount × |deviationPct| / 100 (simplified recovery estimate)
  const gainOnRecovery = investN > 0 ? investN * absDeviation / 100 : 0

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${
      isOpen ? 'border-emerald-500/40 bg-slate-800/70' : cfg.bg
    }`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="font-bold text-slate-200 text-lg">{coin.symbol}</p>
            <p className="text-xs text-slate-500">{coin.name}</p>
          </div>
          <div className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-lg border ${cfg.bg} ${cfg.text}`}>
            <Icon className="w-3.5 h-3.5" />
            {cfg.label}
          </div>
        </div>

        {/* Price + deviation */}
        <div className="space-y-1.5 mb-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">Preço atual</span>
            <span className="font-mono font-semibold text-slate-200">${coin.price.toFixed(4)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">Desvio do peg</span>
            <span className={`font-mono text-sm font-bold ${cfg.text}`}>
              {coin.deviationPct > 0 ? '+' : ''}{coin.deviationPct.toFixed(4)}%
            </span>
          </div>
        </div>

        {/* Deviation bar */}
        <div className="mb-3">
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                coin.status === 'OK' ? 'bg-emerald-400' :
                coin.status === 'WARNING' ? 'bg-yellow-400' : 'bg-red-400'
              }`}
              style={{ width: `${Math.min(absDeviation * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-600 mt-0.5">
            <span>0%</span><span>0.5%</span><span>1%</span>
          </div>
        </div>

        {/* ── Opportunity section (ALERT / WARNING only) ── */}
        {isOpportunity && (
          <div className="pt-3 border-t border-slate-700/40">
            <p className="text-xs font-medium text-slate-300 mb-2.5 flex items-start gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              {coin.deviationPct < 0
                ? `Desconto de ${absDeviation.toFixed(2)}% — compra barato, aguarda recuperação para $1.00`
                : `Prémio de ${absDeviation.toFixed(2)}% — vende agora, recompra quando voltar a $1.00`
              }
            </p>

            {/* Recovery calculator */}
            <div className="flex items-center gap-2 flex-wrap mb-2.5">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">$</span>
                <input
                  type="number"
                  value={investAmount}
                  onChange={(e) => setInvestAmount(e.target.value)}
                  placeholder="0"
                  className="w-24 bg-slate-900/70 border border-slate-600 rounded-lg pl-5 pr-2 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
              {investN > 0 ? (
                <div className="text-xs">
                  <span className="text-slate-400">Se recuperar ao peg: </span>
                  <span className="text-emerald-400 font-bold">+${gainOnRecovery.toFixed(2)}</span>
                  <span className="text-slate-600 ml-1">({absDeviation.toFixed(2)}% ganho)</span>
                </div>
              ) : (
                <span className="text-[11px] text-slate-600 italic">
                  ex: $1 000 → recuperas +${(1000 * absDeviation / 100).toFixed(2)}
                </span>
              )}
            </div>

            {/* Execute button */}
            <button
              onClick={onToggleExecute}
              className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                isOpen
                  ? 'bg-emerald-600/20 border border-emerald-500/40 text-emerald-300'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              <Zap className="w-3 h-3" />
              {isOpen ? 'Fechar painel' : `Executar trade ${coin.symbol}`}
              {!isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            </button>
          </div>
        )}
      </div>

      {/* ── Inline execute panel ── */}
      {isOpen && isOpportunity && (
        <div className="border-t border-emerald-500/30 bg-slate-900/50 p-4">
          <DepegExecutePanel preselect={coin.symbol} deviationPct={coin.deviationPct} />
        </div>
      )}
    </div>
  )
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export function DepegTab() {
  const [data, setData]           = useState<DepegData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [openSymbol, setOpenSymbol] = useState<string | null>(null)

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res  = await fetch('/api/depeg-monitor')
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
    const iv = setInterval(() => fetchData(true), 30_000)
    return () => clearInterval(iv)
  }, [fetchData])

  const stablecoins    = data?.stablecoins ?? []
  const alerts         = data?.alerts ?? []
  const hasError       = !!data?.error
  const depegAlertCoins = stablecoins.filter((s) => s.status === 'ALERT')
  const warnCoins       = stablecoins.filter((s) => s.status === 'WARNING')

  // Sort: ALERT first, then WARNING, then OK
  const sortedCoins = [...stablecoins].sort((a, b) => {
    const order = { ALERT: 0, WARNING: 1, OK: 2 }
    return order[a.status] - order[b.status]
  })

  return (
    <div className="space-y-4">
      <StrategyValidationPanel
        strategy="DEPEG"
        label="Stablecoin Depeg Detector"
        icon="🛡️"
        timestamp={data?.timestamp ?? null}
        loading={loading}
        error={hasError}
        opportunityCount={alerts.length}
        bestValueLabel={alerts.length > 0 ? `${alerts.length} depeg${alerts.length > 1 ? 's' : ''}` : null}
        sources={['CoinGecko', 'Binance', 'OKX']}
        alerts={{
          urgent: depegAlertCoins.filter((s) => Math.abs(s.deviationPct) > 1).length,
          high:   depegAlertCoins.filter((s) => Math.abs(s.deviationPct) <= 1).length,
          medium: warnCoins.length,
        }}
        dataConfidence={stablecoins.length > 0 ? 'HIGH' : 'MEDIUM'}
      />

      <div className="flex flex-wrap items-center gap-3">
        <CapitalBadge strategy="DEPEG" />
        <ReturnSimulator strategy="DEPEG" />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-500 text-sm">A verificar preços via CoinGecko…</p>
          </div>
        </div>
      )}

      {!loading && hasError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-semibold">Erro ao recolher dados</p>
            <p className="text-red-300 text-sm mt-1 font-mono">{data?.error}</p>
            <p className="text-slate-500 text-xs mt-2">CoinGecko tem rate limit de 5 calls/min no tier gratuito. Aguarda 30s.</p>
          </div>
        </div>
      )}

      {!loading && !hasError && (
        <>
          {/* Alert / stable banner */}
          {alerts.length > 0 ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5 animate-pulse" />
              <div>
                <p className="text-red-400 font-semibold">
                  {alerts.length} stablecoin{alerts.length > 1 ? 's' : ''} fora do peg!
                </p>
                <p className="text-red-300 text-sm mt-1">
                  {alerts.map((a) => `${a.symbol} (${a.deviationPct > 0 ? '+' : ''}${a.deviationPct.toFixed(3)}%)`).join(', ')}
                </p>
                <p className="text-red-400/60 text-xs mt-1">↓ Clica na card da moeda para calcular o ganho e executar o trade</p>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
              <Shield className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-emerald-400 font-semibold">Todos os pegs estão estáveis</p>
                <p className="text-slate-400 text-sm">Nenhuma stablecoin com desvio {'>'} 0.3% do $1.00</p>
              </div>
            </div>
          )}

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Monitoradas</p>
              <p className="text-2xl font-bold text-slate-200">{stablecoins.length}</p>
            </div>
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Com aviso</p>
              <p className="text-2xl font-bold text-yellow-400">{warnCoins.length}</p>
            </div>
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Em alerta</p>
              <p className="text-2xl font-bold text-red-400">{depegAlertCoins.length}</p>
            </div>
          </div>

          {/* Stablecoin grid — sorted ALERT > WARNING > OK */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-200">Estado dos Pegs</h3>
              <button
                onClick={() => fetchData(true)}
                disabled={refreshing}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sortedCoins.map((coin) => (
                <StablecoinCard
                  key={coin.symbol}
                  coin={coin}
                  isOpen={openSymbol === coin.symbol}
                  onToggleExecute={() => setOpenSymbol(openSymbol === coin.symbol ? null : coin.symbol)}
                />
              ))}
            </div>
          </div>

          {/* Historical context */}
          <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-slate-300 mb-2">Depegs históricos validados</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { coin: 'USDC', date: 'Mar 2023', dev: '-13%', cause: 'Silicon Valley Bank' },
                { coin: 'DAI',  date: 'Nov 2022', dev: '-5%',  cause: 'FTX collapse' },
                { coin: 'USDT', date: 'Jun 2022', dev: '-3%',  cause: 'Terra/LUNA crash' },
                { coin: 'FRAX', date: 'Dez 2022', dev: '-2%',  cause: 'Contagion' },
              ].map((e) => (
                <div key={`${e.coin}-${e.date}`} className="text-xs">
                  <span className="font-semibold text-slate-300">{e.coin}</span>
                  <span className="text-red-400 ml-1">{e.dev}</span>
                  <p className="text-slate-600">{e.date} · {e.cause}</p>
                </div>
              ))}
            </div>
          </div>

          {lastUpdate && (
            <p className="text-xs text-slate-700 text-right">
              Actualizado: {lastUpdate.toLocaleTimeString('pt-BR')} · Atualiza cada 30s
            </p>
          )}
        </>
      )}
    </div>
  )
}
