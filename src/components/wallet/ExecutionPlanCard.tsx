'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import type { ExecutionPlan } from '@/lib/wallet/execution-planner'

const ACTION_ICONS: Record<string, string> = {
  approve:  '✓',
  supply:   '↑',
  withdraw: '↓',
  swap:     '⇄',
  bridge:   '⟶',
}

interface ExecutionPlanCardProps {
  plan: ExecutionPlan
}

export function ExecutionPlanCard({ plan }: ExecutionPlanCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 overflow-hidden text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-slate-400 font-medium">{plan.strategy} Execution Plan</span>
          <span className="text-slate-600">·</span>
          <span className="text-emerald-400">{plan.netReturn}</span>
          <span className="text-slate-600 line-through">{plan.expectedReturn}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-600">Gas: {plan.totalGasEstimate}</span>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Steps */}
      {expanded && (
        <div className="border-t border-slate-700/40 divide-y divide-slate-700/20">
          {plan.steps.map((step) => (
            <div key={step.order} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-700 text-slate-400 font-mono font-bold text-xs flex-shrink-0">
                {step.order}
              </span>
              <span className="text-slate-500 w-4 flex-shrink-0">{ACTION_ICONS[step.action] ?? '·'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-slate-300 font-medium">{step.method}</span>
                  <span className="text-slate-600">via {step.protocol}</span>
                  {step.chain !== 'CEX' && (
                    <span className="text-slate-600 bg-slate-700/50 px-1.5 py-0.5 rounded">{step.chain}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-slate-600">{step.gasEstimate}</span>
                {step.deepLink && (
                  <a href={step.deepLink} target="_blank" rel="noopener noreferrer"
                     className="text-slate-600 hover:text-slate-400">
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))}

          {/* Execute button — always disabled */}
          <div className="px-4 py-3 flex items-center justify-between bg-slate-800/20">
            <span className="text-slate-600 italic">{plan.reasonDisabled}</span>
            <button
              disabled
              title={plan.reasonDisabled}
              className="px-4 py-1.5 text-xs font-medium bg-slate-700/50 text-slate-500 border border-slate-600/50 rounded-lg cursor-not-allowed opacity-60"
            >
              Execute (em breve)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
