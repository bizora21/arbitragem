'use client'

import { useMemo } from 'react'
import { useCapital } from '@/hooks/use-capital'
import { analyzeCapital } from '@/lib/strategies/capital-analyzer'

interface CapitalBadgeProps {
  strategy: 'FUNDING' | 'DEPEG' | 'YIELD' | 'SPREAD'
  apy?: number
}

const LEVEL_STYLES = {
  FULL:         'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  PARTIAL:      'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  INSUFFICIENT: 'bg-red-500/15 text-red-400 border-red-500/30',
}

const LEVEL_LABELS = {
  FULL:         'Capital OK',
  PARTIAL:      'Capital Parcial',
  INSUFFICIENT: 'Capital Insuficiente',
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`
  return `$${n}`
}

export function CapitalBadge({ strategy, apy }: CapitalBadgeProps) {
  const { capital, loaded } = useCapital()

  const analysis = useMemo(
    () => analyzeCapital(strategy, capital, { apy }),
    [strategy, capital, apy]
  )

  if (!loaded) return null

  const style = LEVEL_STYLES[analysis.viabilityLevel]
  const label = LEVEL_LABELS[analysis.viabilityLevel]

  return (
    <div className={`flex items-center gap-2 text-xs px-2.5 py-1 rounded-lg border ${style}`}>
      <span className="font-medium">{label}</span>
      <span className="opacity-70">·</span>
      <span>Min {fmt(analysis.capitalMin)}</span>
      {analysis.viabilityLevel !== 'FULL' && (
        <>
          <span className="opacity-70">·</span>
          <span>Ideal {fmt(analysis.capitalOptimal)}</span>
        </>
      )}
    </div>
  )
}
