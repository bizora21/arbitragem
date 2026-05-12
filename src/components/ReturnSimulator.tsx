'use client'

import { useMemo } from 'react'
import { useCapital } from '@/hooks/use-capital'
import { simulateReturn, YIELD_CHAIN_PRIORITY } from '@/lib/strategies/capital-analyzer'
import { getGasCost } from '@/lib/strategies/fee-engine'

interface ReturnSimulatorProps {
  strategy: 'FUNDING' | 'DEPEG' | 'YIELD' | 'SPREAD'
  apy?: number
  chain?: string
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('pt-PT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtUsd(n: number): string {
  if (n >= 1000) return `$${fmt(n / 1000, 1)}k`
  return `$${fmt(n, 2)}`
}

function fmtPct(n: number): string {
  if (!isFinite(n)) return '∞'
  if (n > 999_999) return '>1M%'
  return `${fmt(n, 0)}%`
}

const STRATEGY_LABELS: Record<string, string> = {
  FUNDING: 'Funding Rate Arb',
  DEPEG:   'Depeg Monitor',
  YIELD:   'Yield Rotation',
  SPREAD:  'CEX-DEX Spread',
}

export function ReturnSimulator({ strategy, apy, chain }: ReturnSimulatorProps) {
  const { capital, loaded } = useCapital()

  const bestChain = chain ?? (strategy === 'YIELD' ? YIELD_CHAIN_PRIORITY[0] : undefined)

  const sim = useMemo(
    () => simulateReturn(strategy, capital, apy, bestChain),
    [strategy, capital, apy, bestChain]
  )

  const gasCostPerOp = bestChain ? getGasCost(bestChain) * 2 : 0

  if (!loaded) return null

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 px-4 py-3 text-xs">
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-400 font-medium">
          Simulação com {fmtUsd(capital)} — {STRATEGY_LABELS[strategy]}
        </span>
        {bestChain && (
          <span className="text-slate-600">{bestChain}</span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <p className="text-slate-500 mb-0.5">Retorno anual</p>
          <p className="text-emerald-400 font-semibold text-sm">{fmtUsd(sim.annualReturn)}</p>
        </div>
        <div>
          <p className="text-slate-500 mb-0.5">Retorno mensal</p>
          <p className="text-slate-300 font-medium">{fmtUsd(sim.monthlyReturn)}</p>
        </div>
        {gasCostPerOp > 0 && (
          <>
            <div>
              <p className="text-slate-500 mb-0.5">Gas por rotação</p>
              <p className="text-slate-300 font-medium">${fmt(gasCostPerOp, 2)}</p>
            </div>
            <div>
              <p className="text-slate-500 mb-0.5">ROI do gas</p>
              <p className={`font-semibold ${sim.gasROI > 1000 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                {fmtPct(sim.gasROI)}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
