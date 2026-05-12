import { ethers } from 'ethers'

// Uniswap V3 QuoterV2 — Ethereum mainnet
// Takes a struct param (unlike V1 which took positional args).
const QUOTER_V2 = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e'
const QUOTER_V2_ABI = [
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
]

const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const WBTC = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`RPC timeout ${ms}ms`)), ms)),
  ])
}

export async function getQuoterV2Prices(): Promise<{ eth: number; btc: number }> {
  const rpcUrl = process.env.ETHEREUM_RPC_URL ?? 'https://eth.llamarpc.com'
  const provider = new ethers.JsonRpcProvider(rpcUrl)
  const quoter = new ethers.Contract(QUOTER_V2, QUOTER_V2_ABI, provider)

  const [ethR, btcR] = await Promise.allSettled([
    withTimeout(
      quoter.quoteExactInputSingle.staticCall({
        tokenIn: WETH, tokenOut: USDC,
        amountIn: ethers.parseEther('1'), fee: 500, sqrtPriceLimitX96: 0n,
      }),
      7000
    ),
    withTimeout(
      quoter.quoteExactInputSingle.staticCall({
        tokenIn: WBTC, tokenOut: USDC,
        amountIn: BigInt(1e8), fee: 3000, sqrtPriceLimitX96: 0n,
      }),
      7000
    ),
  ])

  if (ethR.status === 'rejected') throw new Error(`QuoterV2 ETH: ${ethR.reason}`)
  if (btcR.status === 'rejected') throw new Error(`QuoterV2 BTC: ${btcR.reason}`)

  // quoteExactInputSingle returns [amountOut, sqrtPriceX96After, ...]
  const eth = Number((ethR.value as bigint[])[0]) / 1e6
  const btc = Number((btcR.value as bigint[])[0]) / 1e6

  if (!isFinite(eth) || eth <= 0) throw new Error('QuoterV2: invalid ETH price')
  if (!isFinite(btc) || btc <= 0) throw new Error('QuoterV2: invalid BTC price')

  return { eth, btc }
}
