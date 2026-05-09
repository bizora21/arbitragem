'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield } from 'lucide-react'

interface RiskMeterProps {
  score: number // 1-10
  warnings?: string[]
  flipProbability?: number
  volatility?: number
}

export function RiskMeter({ score, warnings = [], flipProbability, volatility }: RiskMeterProps) {
  const percentage = (score / 10) * 100
  const angle = (percentage / 100) * 180 - 90 // -90deg to +90deg

  const color =
    score <= 3 ? '#10b981'  // emerald
    : score <= 5 ? '#eab308' // yellow
    : score <= 7 ? '#f97316' // orange
    : '#ef4444'              // red

  const label =
    score <= 3 ? 'BAIXO'
    : score <= 5 ? 'MODERADO'
    : score <= 7 ? 'ALTO'
    : 'CRÍTICO'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="w-4 h-4 text-blue-400" />
          Análise de Risco
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center">
          {/* Gauge SVG */}
          <div className="relative w-40 h-20 mb-2">
            <svg viewBox="0 0 160 90" className="w-full">
              {/* Background arc */}
              <path
                d="M 10 80 A 70 70 0 0 1 150 80"
                fill="none"
                stroke="#1e293b"
                strokeWidth="12"
                strokeLinecap="round"
              />
              {/* Colored segments */}
              <path d="M 10 80 A 70 70 0 0 1 52 25" fill="none" stroke="#10b981" strokeWidth="12" strokeLinecap="round" opacity="0.4" />
              <path d="M 52 25 A 70 70 0 0 1 108 25" fill="none" stroke="#eab308" strokeWidth="12" strokeLinecap="round" opacity="0.4" />
              <path d="M 108 25 A 70 70 0 0 1 150 80" fill="none" stroke="#ef4444" strokeWidth="12" strokeLinecap="round" opacity="0.4" />
              {/* Needle */}
              <g transform={`translate(80, 80) rotate(${angle})`}>
                <line x1="0" y1="0" x2="0" y2="-55" stroke={color} strokeWidth="3" strokeLinecap="round" />
                <circle cx="0" cy="0" r="5" fill={color} />
              </g>
              {/* Score text */}
              <text x="80" y="75" textAnchor="middle" fill={color} fontSize="20" fontWeight="bold">
                {score}
              </text>
            </svg>
          </div>

          <div className="font-bold text-lg" style={{ color }}>{label}</div>
          <div className="text-xs text-slate-500 mb-3">Score: {score}/10</div>

          {(flipProbability !== undefined || volatility !== undefined) && (
            <div className="w-full grid grid-cols-2 gap-2 mb-3">
              {flipProbability !== undefined && (
                <div className="bg-slate-700/30 rounded-lg p-2 text-center">
                  <div className="text-xs text-slate-500">Flip Prob.</div>
                  <div className="font-mono text-sm text-slate-200">
                    {(flipProbability * 100).toFixed(1)}%
                  </div>
                </div>
              )}
              {volatility !== undefined && (
                <div className="bg-slate-700/30 rounded-lg p-2 text-center">
                  <div className="text-xs text-slate-500">Volatilidade</div>
                  <div className="font-mono text-sm text-slate-200">
                    {(volatility * 100).toFixed(4)}%
                  </div>
                </div>
              )}
            </div>
          )}

          {warnings.length > 0 && (
            <div className="w-full space-y-1">
              {warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-orange-300 bg-orange-500/10 rounded px-2 py-1">
                  <span className="mt-0.5">⚠</span>
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
