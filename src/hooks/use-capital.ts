'use client'

import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'scanner_capital'
const DEFAULT_CAPITAL = 1000

export function useCapital() {
  const [capital, setCapitalState] = useState<number>(DEFAULT_CAPITAL)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = parseFloat(stored)
      if (!isNaN(parsed) && parsed > 0) setCapitalState(parsed)
    }
    setLoaded(true)
  }, [])

  const setCapital = useCallback((value: number) => {
    const clamped = Math.max(1, Math.min(1_000_000, value))
    setCapitalState(clamped)
    localStorage.setItem(STORAGE_KEY, String(clamped))
  }, [])

  return { capital, setCapital, loaded }
}
