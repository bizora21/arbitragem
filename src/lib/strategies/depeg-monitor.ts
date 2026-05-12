import { safeFetch } from '@/lib/utils'
import { supabaseAdmin } from '@/lib/supabase'
import { calculateDepegReturn } from './return-calculator'

export interface StablecoinStatus {
  symbol: string
  name: string
  price: number
  deviationPct: number
  status: 'OK' | 'WARNING' | 'ALERT'
  source: string
  timestamp: string
}

export interface DepegResult {
  stablecoins: StablecoinStatus[]
  alerts: StablecoinStatus[]
  timestamp: string
}

const COINS = [
  { id: 'usd-coin', symbol: 'USDC', name: 'USD Coin' },
  { id: 'tether', symbol: 'USDT', name: 'Tether' },
  { id: 'dai', symbol: 'DAI', name: 'Dai' },
  { id: 'frax', symbol: 'frax', name: 'Frax' },
  { id: 'liquity-usd', symbol: 'LUSD', name: 'Liquity USD' },
  { id: 'ethena-usde', symbol: 'USDe', name: 'Ethena USDe' },
]

interface CoinGeckoResponse {
  [id: string]: { usd: number; usd_24h_change?: number }
}

export async function getDepegStatus(): Promise<DepegResult> {
  const ids = COINS.map((c) => c.id).join(',')
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`

  const res = await safeFetch(url, { headers: { Accept: 'application/json' } }, 15000)

  if (!res.ok) {
    throw new Error(`CoinGecko API error: ${res.status} ${res.statusText}`)
  }

  const data: CoinGeckoResponse = await res.json()
  const now = new Date().toISOString()
  const stablecoins: StablecoinStatus[] = []
  const depegRows: object[] = []

  for (const coin of COINS) {
    const entry = data[coin.id]
    if (!entry) continue

    const price = entry.usd
    const deviationPct = ((price - 1.0) / 1.0) * 100
    const absDeviation = Math.abs(deviationPct)

    const status: 'OK' | 'WARNING' | 'ALERT' =
      absDeviation > 0.5 ? 'ALERT' : absDeviation > 0.3 ? 'WARNING' : 'OK'

    stablecoins.push({
      symbol: coin.symbol,
      name: coin.name,
      price,
      deviationPct,
      status,
      source: 'CoinGecko',
      timestamp: now,
    })

    if (absDeviation > 0.3) {
      const { adjustedReturn } = calculateDepegReturn(deviationPct, coin.symbol)
      depegRows.push({
        stablecoin: coin.symbol,
        exchange: 'COINGECKO',
        price,
        deviationPct,
        isActive: true,
        detectedAt: now,
        adjustedReturn,
      })
    }
  }

  if (depegRows.length > 0) {
    const { error } = await supabaseAdmin.from('DepegEvent').insert(depegRows)
    if (error) console.error('[depeg-monitor] db insert error:', error.message)
  }

  const alerts = stablecoins.filter((s) => s.status !== 'OK')
  return { stablecoins, alerts, timestamp: now }
}

export async function getRecentDepegHistory(
  stablecoin?: string,
  hours = 24
): Promise<{ stablecoin: string; price: number; deviationPct: number; detectedAt: string }[]> {
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString()

  let query = supabaseAdmin
    .from('DepegEvent')
    .select('stablecoin, price, deviationPct, detectedAt')
    .gte('detectedAt', since)
    .order('detectedAt', { ascending: false })
    .limit(200)

  if (stablecoin) query = query.eq('stablecoin', stablecoin)

  const { data, error } = await query
  if (error) {
    console.error('[depeg-monitor] history error:', error.message)
    return []
  }

  return data ?? []
}
