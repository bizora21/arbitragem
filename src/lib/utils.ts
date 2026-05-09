import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Exchange } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Normalize symbol across exchanges
// OKX: BTC-USDT-SWAP → BTCUSDT
// Binance: BTCUSDT → BTCUSDT
// Bybit: BTCUSDT → BTCUSDT
export function normalizeSymbol(symbol: string, exchange: Exchange): string {
  if (exchange === 'OKX') {
    return symbol.replace('-SWAP', '').replace('-', '')
  }
  return symbol.toUpperCase()
}

// Convert normalized symbol back to exchange-specific format
export function toExchangeSymbol(normalizedSymbol: string, exchange: Exchange): string {
  if (exchange === 'OKX') {
    const base = normalizedSymbol.replace('USDT', '')
    return `${base}-USDT-SWAP`
  }
  return normalizedSymbol
}

// Format funding rate as percentage
export function formatFundingRate(rate: number): string {
  return `${(rate * 100).toFixed(4)}%`
}

// Format percentage
export function formatPercent(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`
}

// Format USD value
export function formatUSD(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

// Format large numbers
export function formatNumber(value: number, decimals = 2): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(decimals)}M`
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(decimals)}K`
  return value.toFixed(decimals)
}

// Format countdown in HH:MM:SS
export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '00:00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Get seconds until next funding time
export function getSecondsUntilFunding(nextFundingTime: Date | null): number {
  if (!nextFundingTime) return 0
  const now = Date.now()
  const diff = new Date(nextFundingTime).getTime() - now
  return Math.max(0, Math.floor(diff / 1000))
}

// Color class based on funding rate (positive = green, negative = red)
export function getFundingRateColor(rate: number): string {
  if (rate > 0.0005) return 'text-emerald-400'
  if (rate > 0) return 'text-emerald-300'
  if (rate < -0.0005) return 'text-red-400'
  if (rate < 0) return 'text-red-300'
  return 'text-slate-400'
}

// Color class based on risk score (1=green, 10=red)
export function getRiskColor(score: number): string {
  if (score <= 3) return 'text-emerald-400'
  if (score <= 5) return 'text-yellow-400'
  if (score <= 7) return 'text-orange-400'
  return 'text-red-400'
}

// Exchange badge color
export function getExchangeColor(exchange: Exchange): string {
  const colors: Record<Exchange, string> = {
    OKX: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    BINANCE: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    BYBIT: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  }
  return colors[exchange] ?? 'bg-slate-500/20 text-slate-300'
}

// Standard headers for API calls
export function getApiHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
}

// Sleep utility for rate limiting
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Safe fetch with timeout and retry
export async function safeFetch(
  url: string,
  options?: RequestInit,
  timeoutMs = 10000
): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(id)
    return response
  } catch (error) {
    clearTimeout(id)
    throw error
  }
}

// Calculate standard deviation
export function stdDev(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length
  return Math.sqrt(variance)
}

// Calculate mean
export function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}
