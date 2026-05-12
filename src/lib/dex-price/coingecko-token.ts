import { safeFetch } from '@/lib/utils'

const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
const WBTC = '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599'

export async function getCoinGeckoTokenPrices(): Promise<{ eth: number; btc: number }> {
  const addresses = [WETH, WBTC].join(',')
  const res = await safeFetch(
    `https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${addresses}&vs_currencies=usd`,
    { headers: { Accept: 'application/json' } },
    12000
  )
  if (!res.ok) throw new Error(`CoinGecko token price HTTP ${res.status}`)

  const data: Record<string, { usd?: number }> = await res.json()
  const eth = data[WETH]?.usd
  const btc = data[WBTC]?.usd

  if (!eth || !btc) throw new Error('CoinGecko: missing token prices')
  if (!isFinite(eth) || !isFinite(btc)) throw new Error('CoinGecko: invalid prices')

  return { eth, btc }
}
