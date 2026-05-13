'use client'

import { useState } from 'react'
import { TrendingUp, ChevronDown, ChevronUp, Info, Zap } from 'lucide-react'

interface Props {
  defaultApy?: number
  strategyName?: string
}

const MONTHS = [1, 2, 3, 6, 9, 12, 18, 24, 36]

function fmtUsd(n: number) {
  return `$${n.toFixed(2)}`
}

export function CompoundingCalculator({ defaultApy = 10, strategyName = 'Estratégia' }: Props) {
  const [capital, setCapital] = useState('100')
  const [apy, setApy]         = useState(String(Math.round(defaultApy * 10) / 10))
  const [freq, setFreq]       = useState<'monthly' | 'weekly'>('monthly')
  const [open, setOpen]       = useState(false)

  const P = parseFloat(capital) || 0
  const A = parseFloat(apy) || 0
  const n = freq === 'monthly' ? 12 : 52   // cycles per year
  const r = A / 100 / n                    // rate per cycle

  const bal = (months: number) => P > 0 && A > 0
    ? P * Math.pow(1 + r, Math.round(months * n / 12))
    : 0

  const bal1y = bal(12)
  const bal2y = bal(24)
  const bal3y = bal(36)

  // Gas cost on Base: ~$0.05 per reinvestment tx
  const gasPerYear   = 0.05 * n
  const netGain1y    = bal1y - P - gasPerYear
  const minCapital   = gasPerYear > 0 ? Math.ceil(gasPerYear / (A / 100) * 10) : 0

  const rows = MONTHS.map((m) => {
    const balance = bal(m)
    const gain    = balance - P
    const retPct  = P > 0 ? (gain / P) * 100 : 0
    const bar     = bal3y > P ? Math.min((balance - P) / (bal3y - P) * 100, 100) : 0
    return { m, balance, gain, retPct, bar }
  })

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/20 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-sm font-semibold text-slate-200">Crescimento composto · {strategyName}</span>
          <span className="text-[10px] text-slate-500 hidden sm:block">— reinveste os ganhos e o capital cresce sozinho</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {P > 0 && A > 0 && !open && (
            <span className="text-xs text-emerald-400 hidden sm:block">
              {fmtUsd(P)} → <span className="font-bold">{fmtUsd(bal1y)}</span> em 1 ano
            </span>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-700/40 p-4 space-y-4">

          {/* Inputs */}
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <p className="text-[10px] text-slate-500 mb-1">Capital inicial</p>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">$</span>
                <input
                  type="number" value={capital} onChange={(e) => setCapital(e.target.value)}
                  className="w-28 bg-slate-900/70 border border-slate-600 rounded-lg pl-5 pr-2 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 mb-1">APY (%)</p>
              <div className="relative">
                <input
                  type="number" value={apy} onChange={(e) => setApy(e.target.value)}
                  className="w-20 bg-slate-900/70 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white text-right pr-6 focus:outline-none focus:border-emerald-500"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 mb-1">Frequência de reinvestimento</p>
              <div className="flex gap-1">
                {([['monthly', 'Mensal'], ['weekly', 'Semanal']] as const).map(([v, label]) => (
                  <button key={v} onClick={() => setFreq(v)}
                    className={`px-2.5 py-1.5 text-xs rounded-lg transition-colors ${
                      freq === v ? 'bg-slate-600 text-white' : 'text-slate-400 border border-slate-700 hover:text-slate-300'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {P > 0 && A > 0 ? (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: '1 Ano', balance: bal1y },
                  { label: '2 Anos', balance: bal2y },
                  { label: '3 Anos', balance: bal3y },
                ].map(({ label, balance }) => (
                  <div key={label} className="bg-slate-900/50 rounded-lg p-3 text-center">
                    <p className="text-[10px] text-slate-500 mb-1">{label}</p>
                    <p className="text-lg font-bold text-emerald-400">{fmtUsd(balance)}</p>
                    <p className="text-[10px] text-emerald-600">+{fmtUsd(balance - P)}</p>
                  </div>
                ))}
              </div>

              {/* Gas info */}
              <div className="bg-slate-900/30 rounded-lg p-2.5 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-500">
                  Gas estimado na Base: ~{fmtUsd(gasPerYear)}/ano ({n} reinvestimentos × ~$0.05).
                  {netGain1y > 0
                    ? ` Ganho líquido: ${fmtUsd(netGain1y)} no 1.º ano.`
                    : ` Reinveste apenas quando os ganhos acumulados superam $5 — capital mínimo recomendado: ${fmtUsd(minCapital)}.`
                  }
                </p>
              </div>

              {/* Monthly progression table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700/50 text-slate-500">
                      <th className="text-left pb-1.5 font-medium">Mês</th>
                      <th className="text-right pb-1.5 font-medium">Saldo</th>
                      <th className="text-right pb-1.5 font-medium">Ganho total</th>
                      <th className="text-right pb-1.5 font-medium">Retorno</th>
                      <th className="pb-1.5 pl-3 w-24">Progresso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.m} className="border-b border-slate-700/20 hover:bg-slate-700/10">
                        <td className="py-1.5 text-slate-400 font-medium">{r.m}m</td>
                        <td className="py-1.5 text-right font-mono text-slate-200">{fmtUsd(r.balance)}</td>
                        <td className="py-1.5 text-right font-mono text-emerald-400">+{fmtUsd(r.gain)}</td>
                        <td className="py-1.5 text-right font-mono text-emerald-500">+{r.retPct.toFixed(1)}%</td>
                        <td className="py-1.5 pl-3">
                          <div className="h-1.5 bg-slate-700 rounded-full w-20">
                            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${r.bar}%` }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Faucet / free capital tips */}
              <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-3 space-y-1.5">
                <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  Como crescer o capital inicial sem investir mais
                </p>
                <ul className="space-y-1 text-[11px] text-slate-400">
                  <li className="flex items-start gap-1.5">
                    <span className="text-emerald-500 shrink-0">›</span>
                    <span><span className="text-slate-300">Recompensas de emissão (LP)</span> — os protocolos pagam tokens extra por providenciar liquidez. Vende os tokens periodicamente e reinveste.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-emerald-500 shrink-0">›</span>
                    <span><span className="text-slate-300">Airdrops retroativos</span> — usa protocolos DeFi cedo e podes receber tokens gratuitos quando lançam. Vê a tab <span className="text-yellow-400">🪂 Airdrop</span> para as melhores oportunidades.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-emerald-500 shrink-0">›</span>
                    <span><span className="text-slate-300">Depeg trades</span> — quando uma stablecoin desvia do $1.00, compras barato e vendes quando recupera. Ver tab <span className="text-yellow-400">🛡️ Depeg</span>.</span>
                  </li>
                </ul>
              </div>

              <p className="text-[10px] text-slate-700">
                * Simulação com APY constante e reinvestimento {freq === 'monthly' ? 'mensal' : 'semanal'}. APY real pode variar. Não é aconselhamento financeiro.
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-600 text-center py-4">Introduz capital e APY para ver a projeção</p>
          )}
        </div>
      )}
    </div>
  )
}
