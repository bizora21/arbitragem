'use client'

import { useEffect, useState } from 'react'
import { DashboardStats } from '@/types'
import { formatPercent, formatFundingRate, formatCountdown } from '@/lib/utils'
import { TrendingUp, Activity, Clock, Target, Wallet } from 'lucide-react'

export function StatsBar() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats')
        const json = await res.json()
        setStats(json.data)
        setCountdown(json.data?.nextFundingIn ?? 0)
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => setCountdown((prev) => Math.max(0, prev - 1)), 1000)
    return () => clearInterval(timer)
  }, [countdown])

  const items = [
    {
      icon: Target,
      label: 'Oportunidades',
      value: loading ? '...' : `${stats?.totalOpportunities ?? 0}`,
      color: 'text-blue-400',
    },
    {
      icon: TrendingUp,
      label: 'Melhor Retorno',
      value: loading ? '...' : formatPercent(stats?.bestAnnualizedReturn ?? 0),
      color: 'text-emerald-400',
    },
    {
      icon: Activity,
      label: 'Funding Médio',
      value: loading ? '...' : formatFundingRate(stats?.avgFundingRate ?? 0),
      color: 'text-yellow-400',
    },
    {
      icon: Clock,
      label: 'Próx. Funding',
      value: formatCountdown(countdown),
      color: 'text-purple-400',
    },
    {
      icon: Wallet,
      label: 'PnL Total',
      value: loading ? '...' : `$${(stats?.totalPnL ?? 0).toFixed(2)}`,
      color: 'text-slate-300',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex items-center gap-3"
        >
          <item.icon className={`w-8 h-8 ${item.color} flex-shrink-0`} />
          <div>
            <div className="text-xs text-slate-500 leading-tight">{item.label}</div>
            <div className={`font-bold text-lg font-mono ${item.color}`}>{item.value}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
