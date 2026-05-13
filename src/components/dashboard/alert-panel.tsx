'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, BellOff, X, RefreshCw } from 'lucide-react'

type Strategy = 'FUNDING' | 'DEPEG' | 'YIELD' | 'SPREAD' | 'AIRDROP'
type Filter = 'ALL' | Strategy
type Priority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW'

interface LiveAlert {
  id: string
  strategy: Strategy
  priority: Priority
  title: string
  detail: string
  value?: string
}

const PRIORITY_CONFIG: Record<Priority, { className: string; label: string; order: number }> = {
  URGENT: { className: 'bg-red-500/20 text-red-300 border-red-500/40',         label: 'URGENTE', order: 0 },
  HIGH:   { className: 'bg-orange-500/20 text-orange-300 border-orange-500/40', label: 'ALTA',    order: 1 },
  MEDIUM: { className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40', label: 'MÉDIA',   order: 2 },
  LOW:    { className: 'bg-slate-500/20 text-slate-300 border-slate-500/40',    label: 'BAIXA',   order: 3 },
}

const STRATEGY_META: Record<Strategy, { icon: string; label: string }> = {
  FUNDING: { icon: '⚡', label: 'Funding' },
  DEPEG:   { icon: '🛡️', label: 'Depeg'  },
  YIELD:   { icon: '🌿', label: 'Yield'  },
  SPREAD:  { icon: '🔗', label: 'Spread' },
  AIRDROP: { icon: '🪂', label: 'Airdrop' },
}

function buildAlerts(
  funding:   { data?: any[] } | null,
  depeg:     { stablecoins?: any[] } | null,
  yieldData: { opportunities?: any[] } | null,
  spread:    { alerts?: any[] } | null,
  airdrops:  { data?: any[] } | null,
): LiveAlert[] {
  const alerts: LiveAlert[] = []
  let n = 0

  if (funding?.data) {
    for (const opp of funding.data) {
      const ret: number = opp.annualizedReturn ?? 0
      if (ret < 10) continue
      const priority: Priority = ret > 50 ? 'URGENT' : ret > 30 ? 'HIGH' : ret > 20 ? 'MEDIUM' : 'LOW'
      alerts.push({
        id: `f${n++}`, strategy: 'FUNDING', priority,
        title: `${opp.symbol} delta-neutral`,
        detail: `${opp.buyExchange} long / ${opp.sellExchange} short`,
        value: `${ret.toFixed(1)}% APY`,
      })
    }
  }

  if (depeg?.stablecoins) {
    for (const coin of depeg.stablecoins) {
      if (coin.status === 'OK') continue
      const abs = Math.abs(coin.deviationPct)
      const priority: Priority = abs > 1 ? 'URGENT' : abs > 0.5 ? 'HIGH' : 'MEDIUM'
      alerts.push({
        id: `d${n++}`, strategy: 'DEPEG', priority,
        title: `${coin.symbol} fora do peg`,
        detail: coin.deviationPct > 0 ? 'Premium acima de $1.00' : 'Desconto abaixo de $1.00',
        value: `${coin.deviationPct > 0 ? '+' : ''}${coin.deviationPct.toFixed(3)}%`,
      })
    }
  }

  if (yieldData?.opportunities) {
    for (const opp of yieldData.opportunities) {
      if (opp.gainPct < 1) continue
      const priority: Priority = opp.gainPct > 5 ? 'HIGH' : 'MEDIUM'
      alerts.push({
        id: `y${n++}`, strategy: 'YIELD', priority,
        title: `Rotação ${opp.asset}`,
        detail: `${opp.fromProtocol} → ${opp.toProtocol}`,
        value: `+${opp.gainPct.toFixed(2)}% APY`,
      })
    }
  }

  if (spread?.alerts) {
    for (const s of spread.alerts) {
      const abs = Math.abs(s.spreadPct ?? 0)
      const priority: Priority = abs > 1 ? 'URGENT' : 'HIGH'
      alerts.push({
        id: `s${n++}`, strategy: 'SPREAD', priority,
        title: `${s.symbol} spread ${s.cexName}`,
        detail: s.direction === 'CEX_HIGHER' ? 'CEX acima do DEX' : 'DEX acima do CEX',
        value: `${(s.spreadPct ?? 0) > 0 ? '+' : ''}${(s.spreadPct ?? 0).toFixed(3)}%`,
      })
    }
  }

  if (airdrops?.data) {
    for (const a of airdrops.data) {
      if (a.tier !== 'S' && a.tier !== 'A') continue
      const priority: Priority = a.tier === 'S' ? 'HIGH' : 'MEDIUM'
      alerts.push({
        id: `air${n++}`, strategy: 'AIRDROP', priority,
        title: `${a.protocol} — Tier ${a.tier}`,
        detail: `${a.chain} · ${a.category ?? 'DeFi'} · sem token`,
        value: a.tvl ? `TVL $${(a.tvl / 1_000_000).toFixed(0)}M` : undefined,
      })
    }
  }

  return alerts.sort((a, b) => PRIORITY_CONFIG[a.priority].order - PRIORITY_CONFIG[b.priority].order)
}

export function AlertPanel({ onClose }: { onClose?: () => void }) {
  const [alerts, setAlerts] = useState<LiveAlert[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<Filter>('ALL')
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchAlerts = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true)

    const [f, d, y, s, air] = await Promise.allSettled([
      fetch('/api/opportunities?capital=5&limit=50').then((r) => r.json()),
      fetch('/api/depeg-monitor').then((r) => r.json()),
      fetch('/api/yield-rates').then((r) => r.json()),
      fetch('/api/cex-dex-spread').then((r) => r.json()),
      fetch('/api/airdrops').then((r) => r.json()),
    ])

    setAlerts(buildAlerts(
      f.status   === 'fulfilled' ? f.value   : null,
      d.status   === 'fulfilled' ? d.value   : null,
      y.status   === 'fulfilled' ? y.value   : null,
      s.status   === 'fulfilled' ? s.value   : null,
      air.status === 'fulfilled' ? air.value : null,
    ))
    setLastUpdate(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAlerts()
    const iv = setInterval(() => fetchAlerts(true), 2 * 60_000)
    return () => clearInterval(iv)
  }, [fetchAlerts])

  const active = alerts.filter((a) => !dismissed.has(a.id))
  const visible = active.filter((a) => filter === 'ALL' || a.strategy === filter)

  const counts: Record<Filter, number> = {
    ALL:     active.length,
    FUNDING: active.filter((a) => a.strategy === 'FUNDING').length,
    DEPEG:   active.filter((a) => a.strategy === 'DEPEG').length,
    YIELD:   active.filter((a) => a.strategy === 'YIELD').length,
    SPREAD:  active.filter((a) => a.strategy === 'SPREAD').length,
    AIRDROP: active.filter((a) => a.strategy === 'AIRDROP').length,
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-slate-400" />
          <span className="font-semibold text-sm text-slate-200">Alertas Ativos</span>
          {counts.ALL > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
              {counts.ALL}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchAlerts(true)}
            className="text-slate-600 hover:text-slate-400 transition-colors"
            title="Atualizar"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-600 hover:text-slate-400 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Strategy filter tabs */}
      <div className="flex gap-1 px-2 py-2 border-b border-slate-700/30 overflow-x-auto scrollbar-none flex-shrink-0">
        {(['ALL', 'AIRDROP', 'YIELD', 'DEPEG', 'FUNDING', 'SPREAD'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
              filter === f
                ? 'bg-slate-700 text-slate-200'
                : 'text-slate-600 hover:text-slate-400'
            }`}
          >
            {f !== 'ALL' && <span className="text-xs">{STRATEGY_META[f as Strategy].icon}</span>}
            <span>{f === 'ALL' ? 'Todos' : STRATEGY_META[f as Strategy].label}</span>
            {counts[f] > 0 && (
              <span className="bg-slate-600/80 text-slate-300 rounded-full px-1 text-[10px] leading-4">
                {counts[f]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Alert list */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 border-2 border-slate-600 border-t-slate-300 rounded-full animate-spin" />
          </div>
        )}

        {!loading && visible.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <BellOff className="w-7 h-7 text-slate-700 mb-2" />
            <p className="text-xs text-slate-600">
              {filter === 'ALL'
                ? 'Nenhum alerta ativo'
                : `Sem alertas de ${STRATEGY_META[filter as Strategy]?.label ?? filter}`}
            </p>
          </div>
        )}

        {!loading && visible.map((alert) => {
          const pcfg = PRIORITY_CONFIG[alert.priority]
          const smeta = STRATEGY_META[alert.strategy]
          return (
            <div
              key={alert.id}
              className="group flex items-start gap-2 px-3 py-2.5 border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors"
            >
              <span className="text-sm flex-shrink-0 mt-0.5">{smeta.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full border ${pcfg.className}`}>
                    {pcfg.label}
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-200 truncate">{alert.title}</p>
                <p className="text-xs text-slate-500 truncate">{alert.detail}</p>
                {alert.value && (
                  <p className="text-xs font-mono font-bold text-emerald-400 mt-0.5">{alert.value}</p>
                )}
              </div>
              <button
                onClick={() => setDismissed((prev) => new Set([...prev, alert.id]))}
                className="opacity-0 group-hover:opacity-100 text-slate-700 hover:text-slate-400 transition-all flex-shrink-0 mt-0.5"
                title="Dispensar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      {lastUpdate && (
        <div className="px-3 py-2 border-t border-slate-700/30 flex-shrink-0">
          <p className="text-[10px] text-slate-700 text-center">
            Atualizado: {lastUpdate.toLocaleTimeString('pt-BR')} · cada 2 min
          </p>
        </div>
      )}
    </div>
  )
}
