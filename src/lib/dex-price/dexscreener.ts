import { safeFetch } from '@/lib/utils'

const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const WBTC = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
const STABLE_QUOTES = new Set(['USDC', 'USDT', 'DAI', 'USDE'])

interface DexScreenerPair {
  chainId: string
  dexId: string
  baseToken: { address: string; symbol: string }
  quoteToken: { address: string; symbol: string }
  priceUsd: string
  liquidity?: { usd: number }
}

interface DexScreenerResponse {
  pairs: DexScreenerPair[] | null
}

async function fetchTokenPrice(tokenAddress: string): Promise<number> {
  const res = await safeFetch(
    `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
    {},
    8000
  )
  if (!res.ok) throw new Error(`DexScreener HTTP ${res.status}`)

  const data: DexScreenerResponse = await res.json()
  if (!data.pairs?.length) throw new Error('DexScreener: no pairs')

  const ethPairs = data.pairs.filter(
    (p) => p.chainId === 'ethereum' && STABLE_QUOTES.has(p.quoteToken.symbol.toUpperCase())
  )
  if (!ethPairs.length) throw new Error('DexScreener: no stable-quote pairs on Ethereum')

  const best = ethPairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0]
  const price = parseFloat(best.priceUsd)
  if (!isFinite(price) || price <= 0) throw new Error('DexScreener: invalid price')
  return price
}

export async function getDexScreenerPrices(): Promise<{ eth: number; btc: number }> {
  const [ethR, btcR] = await Promise.allSettled([
    fetchTokenPrice(WETH),
    fetchTokenPrice(WBTC),
  ])
  if (ethR.status === 'rejected') throw new Error(`DexScreener ETH: ${ethR.reason}`)
  if (btcR.status === 'rejected') throw new Error(`DexScreener BTC: ${btcR.reason}`)
  return { eth: ethR.value, btc: btcR.value }
}
