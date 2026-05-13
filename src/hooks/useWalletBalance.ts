'use client'

import { useAccount, useBalance, useReadContract } from 'wagmi'
import { erc20Abi, formatUnits } from 'viem'
import { base, arbitrum, optimism, mainnet, bsc } from 'wagmi/chains'

const USDC: Record<number, `0x${string}`> = {
  [mainnet.id]:  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  [base.id]:     '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  [arbitrum.id]: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  [optimism.id]: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  [bsc.id]:      '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // 18 decimals on BSC
}

// USDT on BSC (18 decimals)
const USDT_BSC = '0x55d398326f99059fF775485246999027B3197955' as `0x${string}`

// Static prices — good enough for balance display
const ETH_USD = 3000
const BNB_USD = 600
const MATIC_USD = 0.5

const NATIVE_PRICE: Record<number, number> = {
  [mainnet.id]:  ETH_USD,
  [base.id]:     ETH_USD,
  [arbitrum.id]: ETH_USD,
  [optimism.id]: ETH_USD,
  [bsc.id]:      BNB_USD,
}

export interface ChainBalance {
  name: string
  chainId: number
  nativeSymbol: string
  nativeBalance: string
  usdcBalance: string
  nativeUsd: number
  usdcUsd: number
  totalUsd: number
}

function fmt(value: bigint | undefined, decimals: number): string {
  if (!value) return '0'
  return formatUnits(value, decimals)
}

function toNum(s: string): number {
  return parseFloat(s) || 0
}

export function useWalletBalance() {
  const { address } = useAccount()
  const enabled = !!address

  // Native balances
  const natBase  = useBalance({ address, chainId: base.id })
  const natArb   = useBalance({ address, chainId: arbitrum.id })
  const natOpt   = useBalance({ address, chainId: optimism.id })
  const natMain  = useBalance({ address, chainId: mainnet.id })
  const natBsc   = useBalance({ address, chainId: bsc.id })

  // USDC per chain
  const usdcBase  = useReadContract({ address: USDC[base.id],     abi: erc20Abi, functionName: 'balanceOf', args: [address!], chainId: base.id,     query: { enabled } })
  const usdcArb   = useReadContract({ address: USDC[arbitrum.id], abi: erc20Abi, functionName: 'balanceOf', args: [address!], chainId: arbitrum.id, query: { enabled } })
  const usdcOpt   = useReadContract({ address: USDC[optimism.id], abi: erc20Abi, functionName: 'balanceOf', args: [address!], chainId: optimism.id, query: { enabled } })
  const usdcMain  = useReadContract({ address: USDC[mainnet.id],  abi: erc20Abi, functionName: 'balanceOf', args: [address!], chainId: mainnet.id,  query: { enabled } })
  // BSC: USDC has 18 decimals; also read USDT as fallback
  const usdcBsc   = useReadContract({ address: USDC[bsc.id],  abi: erc20Abi, functionName: 'balanceOf', args: [address!], chainId: bsc.id, query: { enabled } })
  const usdtBsc   = useReadContract({ address: USDT_BSC,       abi: erc20Abi, functionName: 'balanceOf', args: [address!], chainId: bsc.id, query: { enabled } })

  function buildChain(
    name: string,
    chainId: number,
    nativeSymbol: string,
    nativeBig: bigint | undefined,
    usdcBig: bigint | undefined,
    usdcDecimals = 6,
  ): ChainBalance {
    const nativeFmt = fmt(nativeBig, 18)
    const usdcFmt   = fmt(usdcBig, usdcDecimals)
    const price     = NATIVE_PRICE[chainId] ?? ETH_USD
    const nativeUsd = toNum(nativeFmt) * price
    const usdcUsd   = toNum(usdcFmt)
    return { name, chainId, nativeSymbol, nativeBalance: nativeFmt, usdcBalance: usdcFmt, nativeUsd, usdcUsd, totalUsd: nativeUsd + usdcUsd }
  }

  // BSC: combine USDC + USDT (both 18 decimals)
  const bscUsdcBig = usdcBsc.data as bigint | undefined
  const bscUsdtBig = usdtBsc.data as bigint | undefined
  const bscStableUsd = toNum(fmt(bscUsdcBig, 18)) + toNum(fmt(bscUsdtBig, 18))
  const bscNativeFmt = fmt(natBsc.data?.value, 18)
  const bscNativeUsd = toNum(bscNativeFmt) * BNB_USD

  const chains: ChainBalance[] = [
    buildChain('Base',     base.id,     'ETH',  natBase.data?.value, usdcBase.data as bigint | undefined),
    buildChain('Arbitrum', arbitrum.id, 'ETH',  natArb.data?.value,  usdcArb.data  as bigint | undefined),
    buildChain('Optimism', optimism.id, 'ETH',  natOpt.data?.value,  usdcOpt.data  as bigint | undefined),
    buildChain('Ethereum', mainnet.id,  'ETH',  natMain.data?.value, usdcMain.data as bigint | undefined),
    {
      name: 'BSC',
      chainId: bsc.id,
      nativeSymbol: 'BNB',
      nativeBalance: bscNativeFmt,
      usdcBalance: fmt(bscUsdcBig, 18),
      nativeUsd: bscNativeUsd,
      usdcUsd: bscStableUsd,
      totalUsd: bscNativeUsd + bscStableUsd,
    },
  ]

  const totalUsd      = chains.reduce((s, c) => s + c.totalUsd, 0)
  const totalUsdc     = chains.reduce((s, c) => s + c.usdcUsd, 0)
  const totalNativeUsd = chains.reduce((s, c) => s + c.nativeUsd, 0)
  const isLoading     = natBase.isLoading || usdcBase.isLoading

  return { address, chains, totalUsd, totalUsdc, totalEthUsd: totalNativeUsd, isLoading }
}
