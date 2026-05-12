'use client'

import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, CheckCircle2, RefreshCw, AlertCircle, Shield } from 'lucide-react'
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
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    text: 'text-emerald-400',
    icon: CheckCircle2,
    label: 'Estável',
  },
  WARNING: {
    bg: 'bg-yellow-500/10 border-yellow-500/30',
    text: 'text-yellow-400',
    icon: AlertTriangle,
    label: 'Aviso',
  },
  ALERT: {
    bg: 'bg-red-500/10 border-red-500/30',
    text: 'text-red-400',
    icon: AlertTriangle,
    label: 'DEPEG!',
  },
}

function StablecoinCard({ coin }: { coin: StablecoinStatus }) {
  const cfg = STATUS_CONFIG[coin.status]
  const Icon = cfg.icon
  const absDeviation = Math.abs(coin.deviationPct)

  return (
    <div className={`rounded-xl border p-4 ${cfg.bg}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-bold text-slate-200 text-lg">{coin.symbol}</p>
          <p className="text-xs text-slate-500">{coin.name}</p>
        </div>
        <div className={`flex items-center gap-1 text-xs font-semibold ${cfg.text}`}>
          <Icon className="w-3.5 h-3.5" />
          {cfg.label}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-500">Preço atual</span>
          <span className="font-mono font-semibold text-slate-200">
            ${coin.price.toFixed(4)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-500">Desvio do peg</span>
          <span className={`font-mono text-sm font-semibold ${cfg.text}`}>
            {coin.deviationPct > 0 ? '+' : ''}{coin.deviationPct.toFixed(4)}%
          </span>
        </div>
      </div>

      <div className="mt-3">
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              coin.status === 'OK' ? 'bg-emerald-400' :
              coin.status === 'WARNING' ? 'bg-yellow-400' : 'bg-red-400'
            }`}
            style={{ width: `${Math.min(absDeviation * 100, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-600 mt-1">
          <span>0%</span>
          <span>0.5%</span>
          <span>1%</span>
        </div>
      </div>
    </div>
  )
}

export function DepegTab() {
  const [data, setData] = useState<DepegData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const res = await fetch('/api/depeg-monitor')
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

  const stablecoins = data?.stablecoins ?? []
  const alerts = data?.alerts ?? []
  const hasError = !!data?.error

  const depegAlertCoins = stablecoins.filter((s) => s.status === 'ALERT')
  const warnCoins = stablecoins.filter((s) => s.status === 'WARNING')

  return (
    <div className="space-y-6">
      <StrategyValidationPanel
        strategy="DEPEG"
        label="Stablecoin Depeg Detector"
        icon="🛡️"
        timestamp={data?.timestamp ?? null}
        loading={loading}
        error={hasError}
        opportunityCount={alerts.length}
        bestValueLabel={
          alerts.length > 0
            ? `${alerts.length} depeg${alerts.length > 1 ? 's' : ''}`
            : null
        }
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
            <p className="text-slate-500 text-sm">A verificar preços de stablecoins via CoinGecko...</p>
          </div>
        </div>
      )}

      {!loading && hasError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-semibold">Erro ao recolher dados</p>
            <p className="text-red-300 text-sm mt-1 font-mono">{data?.error}</p>
            <p className="text-slate-500 text-xs mt-2">
              CoinGecko API pode estar com rate limit (5 calls/min no tier gratuito). Aguarda 30s.
            </p>
          </div>
        </div>
      )}

      {!loading && !hasError && (
        <>
          {/* Alert/stable banner */}
          {alerts.length > 0 ? (
            <>
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <p className="text-red-400 font-semibold">
                    {alerts.length} stablecoin{alerts.length > 1 ? 's' : ''} fora do peg!
                  </p>
                  <p className="text-red-300 text-sm mt-1">
                    {alerts.map((a) => `${a.symbol} (${a.deviationPct > 0 ? '+' : ''}${a.deviationPct.toFixed(3)}%)`).join(', ')}
                  </p>
                </div>
              </div>
              {/* Execute panel — buy the depegged coin directly */}
              <DepegExecutePanel
                preselect={alerts[0]?.symbol}
                deviationPct={alerts[0]?.deviationPct}
              />
            </>
          ) : (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
              <Shield className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-emerald-400 font-semibold">Todos os peg estão estáveis</p>
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

          {/* Stablecoin grid */}
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {stablecoins.map((coin) => (
                <StablecoinCard key={coin.symbol} coin={coin} />
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
