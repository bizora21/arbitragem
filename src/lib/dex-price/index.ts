import { getDexScreenerPrices } from './dexscreener'
import { getDefiLlamaPrices } from './defillama-price'
import { getCoinGeckoTokenPrices } from './coingecko-token'
import { getQuoterV2Prices } from './quoter-v2'

export type DexPriceSourceType = 'DEXSCREENER' | 'DEFILLAMA' | 'COINGECKO' | 'QUOTER_V2'

export interface DexPriceResult {
  eth: number
  btc: number
  source: string
  sourceType: DexPriceSourceType
}

// Sequential cascade: try each source in order, return first success.
// Never return null/undefined — throws only if ALL sources fail.
export async function getDexPrices(): Promise<DexPriceResult> {
  const sources: Array<{
    name: string
    type: DexPriceSourceType
    fn: () => Promise<{ eth: number; btc: number }>
  }> = [
    { name: 'DexScreener', type: 'DEXSCREENER', fn: getDexScreenerPrices },
    { name: 'DefiLlama',   type: 'DEFILLAMA',   fn: getDefiLlamaPrices },
    { name: 'CoinGecko',   type: 'COINGECKO',   fn: getCoinGeckoTokenPrices },
    { name: 'Quoter V2',   type: 'QUOTER_V2',   fn: getQuoterV2Prices },
  ]

  const errors: string[] = []

  for (const s of sources) {
    try {
      const prices = await s.fn()
      console.log(`[dex-price] success via ${s.name}: ETH=$${prices.eth.toFixed(0)} BTC=$${prices.btc.toFixed(0)}`)
      return { ...prices, source: s.name, sourceType: s.type }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[dex-price] ${s.name} failed: ${msg}`)
      errors.push(`${s.name}: ${msg}`)
    }
  }

  throw new Error(`All DEX price sources failed — ${errors.join(' | ')}`)
}
