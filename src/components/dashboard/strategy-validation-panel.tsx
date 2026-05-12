'use client'

import { DataConfidenceBadge, useDataAge } from './data-confidence-badge'
import { AlertTriangle, CheckCircle2, Clock, Zap } from 'lucide-react'

export interface StrategyAlertCounts {
  urgent: number
  high: number
  medium: number
}

export interface StrategyValidationPanelProps {
  strategy: 'FUNDING' | 'DEPEG' | 'YIELD' | 'SPREAD'
  label: string
  icon: string
  timestamp: string | null
  loading: boolean
  error: boolean
  opportunityCount: number
  bestValueLabel: string | null
  sources: string[]
  dataSource?: string | null   // e.g., "DexScreener" for spread
  alerts: StrategyAlertCounts
  dataConfidence: 'HIGH' | 'MEDIUM' | 'LOW'
}

const STRATEGY_COLORS: Record<string, string> = {
  FUNDING: 'border-blue-500/30 bg-blue-500/5',
  DEPEG:   'border-yellow-500/30 bg-yellow-500/5',
  YIELD:   'border-green-500/30 bg-green-500/5',
  SPREAD:  'border-orange-500/30 bg-orange-500/5',
}

const CONFIDENCE_CONFIG = {
  HIGH:   { label: 'Alta confiança',  classes: 'text-emerald-400' },
  MEDIUM: { label: 'Média confiança', classes: 'text-yellow-400' },
  LOW:    { label: 'Baixa confiança', classes: 'text-red-400' },
}

function timeAgoLabel(ts: string | null): string {
  if (!ts) return 'nunca'
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (s < 60)   return `${s}s atrás`
  if (s < 3600) return `${Math.floor(s / 60)}m atrás`
  return `${Math.floor(s / 3600)}h atrás`
}

export function StrategyValidationPanel({
  strategy, label, icon, timestamp, loading, error,
  opportunityCount, bestValueLabel, sources, dataSource,
  alerts, dataConfidence,
}: StrategyValidationPanelProps) {
  const age = useDataAge(timestamp)
  const conf = CONFIDENCE_CONFIG[dataConfidence]
  const borderColor = STRATEGY_COLORS[strategy] ?? 'border-slate-700/50 bg-slate-800/20'
  const totalAlerts = alerts.urgent + alerts.high + alerts.medium

  return (
    <div className={`rounded-xl border p-3 mb-5 ${borderColor}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Identity */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base">{icon}</span>
          <span className="font-semibold text-slate-200 text-sm">{label}</span>
          <DataConfidenceBadge timestamp={timestamp} level="OFFLINE" />
        </div>

        {/* Last update */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Clock className="w-3 h-3" />
          {loading ? 'Carregando...' : error ? (
            <span className="text-red-400">Erro</span>
          ) : (
            <span>{timeAgoLabel(timestamp)}</span>
          )}
        </div>

        {/* Opportunities */}
        {!loading && !error && (
          <div className="flex items-center gap-1.5 text-xs">
            <Zap className="w-3 h-3 text-yellow-400" />
            <span className="text-slate-300">
              {opportunityCount > 0
                ? <><span className="font-semibold text-slate-200">{opportunityCount}</span> oport.{bestValueLabel && <span className="text-emerald-400 ml-1">{bestValueLabel}</span>}</>
                : <span className="text-slate-600">0 oportunidades</span>}
            </span>
          </div>
        )}

        {/* Confidence */}
        {!loading && !error && (
          <span className={`text-xs ${conf.classes}`}>{conf.label}</span>
        )}

        {/* Data source (for spread) */}
        {dataSource && (
          <span className="text-xs text-slate-600">via {dataSource}</span>
        )}

        {/* Sources */}
        {sources.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-slate-600">
            {sources.map((s) => (
              <span key={s} className="px-1.5 py-0.5 rounded bg-slate-700/40 text-slate-400">{s}</span>
            ))}
          </div>
        )}

        {/* Alerts */}
        {totalAlerts > 0 && (
          <div className="flex items-center gap-1.5 text-xs ml-auto">
            <AlertTriangle className="w-3 h-3 text-orange-400" />
            {alerts.urgent > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                {alerts.urgent} URGENTE
              </span>
            )}
            {alerts.high > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">
                {alerts.high} ALTA
              </span>
            )}
            {alerts.medium > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                {alerts.medium} MÉDIA
              </span>
            )}
          </div>
        )}
        {totalAlerts === 0 && !loading && !error && (
          <div className="flex items-center gap-1 text-xs text-slate-600 ml-auto">
            <CheckCircle2 className="w-3 h-3 text-slate-600" />
            <span>Sem alertas</span>
          </div>
        )}
      </div>
    </div>
  )
}
