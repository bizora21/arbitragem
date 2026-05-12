'use client'

import { useState, useEffect, useRef } from 'react'
import { useCapital } from '@/hooks/use-capital'

function viabilityColor(capital: number): string {
  if (capital >= 1000) return 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
  if (capital >= 100)  return 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10'
  return 'text-red-400 border-red-500/40 bg-red-500/10'
}

function viabilityLabel(capital: number): string {
  if (capital >= 1000) return 'Todas estratégias'
  if (capital >= 100)  return 'Yield + Depeg'
  return 'Só Depeg/L2'
}

function formatCapital(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`
  return `$${n}`
}

export function CapitalInput() {
  const { capital, setCapital, loaded } = useCapital()
  const [inputVal, setInputVal] = useState('')
  const [editing, setEditing] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (loaded && !editing) setInputVal(String(capital))
  }, [loaded, capital, editing])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    setInputVal(raw)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const n = parseInt(raw, 10)
      if (!isNaN(n) && n > 0) setCapital(n)
    }, 500)
  }

  if (!loaded) return null

  const colorClass = viabilityColor(capital)
  const label = viabilityLabel(capital)

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500 hidden sm:block">Capital</span>
      <div className="relative flex items-center">
        <span className="absolute left-2 text-slate-400 text-xs pointer-events-none">$</span>
        <input
          type="text"
          inputMode="numeric"
          value={editing ? inputVal : formatCapital(capital).replace('$', '')}
          onFocus={() => { setEditing(true); setInputVal(String(capital)) }}
          onBlur={() => setEditing(false)}
          onChange={handleChange}
          className="w-24 pl-4 pr-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded-md text-slate-200 focus:outline-none focus:border-slate-500"
          aria-label="Capital disponível"
        />
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colorClass}`}>
        {label}
      </span>
    </div>
  )
}
