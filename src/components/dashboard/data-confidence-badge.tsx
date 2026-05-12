'use client'

import { useEffect, useState } from 'react'

export type ConfidenceLevel = 'LIVE' | 'RECENT' | 'STALE' | 'OFFLINE' | 'CALCULATED' | 'ESTIMATED'

export function getDataAge(timestampIso: string | null): 'LIVE' | 'RECENT' | 'STALE' | 'OFFLINE' {
  if (!timestampIso) return 'OFFLINE'
  const ageMins = (Date.now() - new Date(timestampIso).getTime()) / 60000
  if (ageMins < 5)  return 'LIVE'
  if (ageMins < 15) return 'RECENT'
  if (ageMins < 60) return 'STALE'
  return 'OFFLINE'
}

const CONFIG: Record<ConfidenceLevel, { label: string; classes: string; pulse: boolean }> = {
  LIVE:       { label: 'LIVE',       classes: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', pulse: true },
  RECENT:     { label: 'RECENT',     classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', pulse: false },
  STALE:      { label: 'STALE',      classes: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',   pulse: false },
  OFFLINE:    { label: 'OFFLINE',    classes: 'bg-red-500/15 text-red-400 border-red-500/30',            pulse: false },
  CALCULATED: { label: 'CALC',       classes: 'bg-blue-500/15 text-blue-300 border-blue-500/30',         pulse: false },
  ESTIMATED:  { label: 'EST',        classes: 'bg-slate-500/15 text-slate-400 border-slate-500/30',      pulse: false },
}

interface DataConfidenceBadgeProps {
  level: ConfidenceLevel
  /** If provided, level is computed from this timestamp; explicit `level` is ignored when set */
  timestamp?: string | null
  size?: 'xs' | 'sm'
}

export function DataConfidenceBadge({ level, timestamp, size = 'xs' }: DataConfidenceBadgeProps) {
  const effective: ConfidenceLevel = timestamp !== undefined ? getDataAge(timestamp) : level
  const { label, classes, pulse } = CONFIG[effective]

  const px = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'

  return (
    <span className={`inline-flex items-center gap-1 font-mono font-semibold rounded-full border ${px} ${classes}`}>
      {pulse && (
        <span className="relative flex w-1.5 h-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-emerald-400" />
        </span>
      )}
      {label}
    </span>
  )
}

/** Hook that refreshes the age badge every 30 seconds */
export function useDataAge(timestampIso: string | null): 'LIVE' | 'RECENT' | 'STALE' | 'OFFLINE' {
  const [age, setAge] = useState(() => getDataAge(timestampIso))
  useEffect(() => {
    setAge(getDataAge(timestampIso))
    const iv = setInterval(() => setAge(getDataAge(timestampIso)), 30_000)
    return () => clearInterval(iv)
  }, [timestampIso])
  return age
}
