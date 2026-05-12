import { safeFetch } from '@/lib/utils'

const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const WBTC = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'

interface DefiLlamaCoins {
  coins: Record<string, { price: number; symbol: string; decimals: number; timestamp: number } | undefined>
}

export async function getDefiLlamaPrices(): Promise<{ eth: number; btc: number }> {
  const keys = [`ethereum:${WETH}`, `ethereum:${WBTC}`].join(',')
  const res = await safeFetch(`https://coins.llama.fi/prices/current/${keys}`, {}, 8000)
  if (!res.ok) throw new Error(`DefiLlama HTTP ${res.status}`)

  const { coins }: DefiLlamaCoins = await res.json()
  const ethData = coins[`ethereum:${WETH}`]
  const btcData = coins[`ethereum:${WBTC}`]

  if (!ethData?.price || !btcData?.price) throw new Error('DefiLlama: missing coin data')
  if (!isFinite(ethData.price) || !isFinite(btcData.price)) throw new Error('DefiLlama: invalid prices')

  return { eth: ethData.price, btc: btcData.price }
}
