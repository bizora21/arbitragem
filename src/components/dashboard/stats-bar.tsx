'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatCountdown, getSecondsUntilFunding } from '@/lib/utils'
import { Zap, TrendingUp, Bell, Clock, Shield } from 'lucide-react'

interface StatsBarData {
  activeOpportunities: number
  bestReturn: number | null
  activeAlerts: number
  nextFundingTs: string | null
  stablecoinsOk: number
  stablecoinsTotal: number
}

export function StatsBar() {
  const [stats, setStats] = useState<StatsBarData>({
    activeOpportunities: 0,
    bestReturn: null,
    activeAlerts: 0,
    nextFundingTs: null,
    stablecoinsOk: 0,
    stablecoinsTotal: 6,
  })
  const [countdown, setCountdown] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    const [oppsRes, depegRes, fundingRes] = await Promise.allSettled([
      fetch('/api/opportunities?capital=5&limit=50').then((r) => r.json()),
      fetch('/api/depeg-monitor').then((r) => r.json()),
      fetch('/api/funding-rates').then((r) => r.json()),
    ])

    const opps: any[]     = oppsRes.status    === 'fulfilled' ? (oppsRes.value.data    ?? []) : []
    const depeg           = depegRes.status   === 'fulfilled' ? depegRes.value              : null
    const fundingRows: any[] = fundingRes.status === 'fulfilled' ? (fundingRes.value.data ?? []) : []

    const stablecoins     = depeg?.stablecoins ?? []
    const depegAlertCount = (depeg?.alerts?.length ?? 0)

    const urgentFunding = opps.filter((o: any) => (o.annualizedReturn ?? 0) > 30).length

    const nextFunding = fundingRows.reduce((best: string | null, row: any) => {
      if (!row.nextFundingTime) return best
      if (!best) return row.nextFundingTime
      return new Date(row.nextFundingTime) < new Date(best) ? row.nextFundingTime : best
    }, null)

    const bestReturn = opps.length > 0
      ? Math.max(...opps.map((o: any) => o.annualizedReturn ?? 0))
      : null

    const newStats: StatsBarData = {
      activeOpportunities: opps.length,
      bestReturn: bestReturn != null && bestReturn > 0 ? bestReturn : null,
      activeAlerts: depegAlertCount + urgentFunding,
      nextFundingTs: nextFunding,
      stablecoinsOk: stablecoins.filter((s: any) => s.status === 'OK').length,
      stablecoinsTotal: stablecoins.length > 0 ? stablecoins.length : 6,
    }

    setStats(newStats)
    if (nextFunding) {
      setCountdown(getSecondsUntilFunding(new Date(nextFunding)))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchStats()
    const iv = setInterval(fetchStats, 5 * 60_000)
    return () => clearInterval(iv)
  }, [fetchStats])

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => setCountdown((prev) => Math.max(0, prev - 1)), 1000)
    return () => clearInterval(timer)
  }, [countdown])

  const allOk = stats.stablecoinsOk === stats.stablecoinsTotal

  const items = [
    {
      icon: Zap,
      label: 'Oportunidades Ativas',
      value: loading ? '—' : `${stats.activeOpportunities}`,
      color: 'text-blue-400',
    },
    {
      icon: TrendingUp,
      label: 'Melhor Retorno',
      value: loading ? '—' : (stats.bestReturn != null ? `${stats.bestReturn.toFixed(1)}%` : '—'),
      color: 'text-emerald-400',
    },
    {
      icon: Bell,
      label: 'Alertas Ativos',
      value: loading ? '—' : `${stats.activeAlerts}`,
      color: stats.activeAlerts > 0 ? 'text-orange-400' : 'text-slate-500',
    },
    {
      icon: Clock,
      label: 'Próx. Funding',
      value: stats.nextFundingTs ? formatCountdown(countdown) : '—',
      color: 'text-purple-400',
    },
    {
      icon: Shield,
      label: 'Stablecoins OK',
      value: loading ? '—' : `${stats.stablecoinsOk}/${stats.stablecoinsTotal}`,
      color: allOk ? 'text-emerald-400' : 'text-yellow-400',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 flex items-center gap-3"
        >
          <item.icon className={`w-7 h-7 flex-shrink-0 ${item.color}`} />
          <div>
            <div className="text-[10px] text-slate-500 leading-tight">{item.label}</div>
            <div className={`font-bold text-base font-mono ${item.color}`}>{item.value}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
