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

const USDT: Record<number, `0x${string}`> = {
  [mainnet.id]:  '0xdAC17F958D2ee523a2206206994597C13D831ec7', // 6 decimals
  [base.id]:     '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', // 6 decimals
  [arbitrum.id]: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', // 6 decimals
  [optimism.id]: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', // 6 decimals
  [bsc.id]:      '0x55d398326f99059fF775485246999027B3197955', // 18 decimals
}

const NATIVE_PRICE: Record<number, number> = {
  [mainnet.id]:  3000,
  [base.id]:     3000,
  [arbitrum.id]: 3000,
  [optimism.id]: 3000,
  [bsc.id]:      600,
}

export interface ChainBalance {
  name: string
  chainId: number
  nativeSymbol: string
  nativeBalance: string
  usdcBalance: string
  usdtBalance: string
  nativeUsd: number
  usdcUsd: number
  usdtUsd: number
  totalUsd: number
}

function fmt(value: bigint | undefined, decimals: number): string {
  if (!value) return '0'
  return formatUnits(value, decimals)
}

function toNum(s: string): number {
  return parseFloat(s) || 0
}

function buildChain(
  name: string,
  chainId: number,
  nativeSymbol: string,
  nativeBig: bigint | undefined,
  usdcBig: bigint | undefined,
  usdtBig: bigint | undefined,
  usdcDecimals = 6,
  usdtDecimals = 6,
): ChainBalance {
  const nativeFmt = fmt(nativeBig, 18)
  const usdcFmt   = fmt(usdcBig, usdcDecimals)
  const usdtFmt   = fmt(usdtBig, usdtDecimals)
  const price     = NATIVE_PRICE[chainId] ?? 3000
  const nativeUsd = toNum(nativeFmt) * price
  const usdcUsd   = toNum(usdcFmt)
  const usdtUsd   = toNum(usdtFmt)
  return {
    name, chainId, nativeSymbol,
    nativeBalance: nativeFmt,
    usdcBalance: usdcFmt,
    usdtBalance: usdtFmt,
    nativeUsd, usdcUsd, usdtUsd,
    totalUsd: nativeUsd + usdcUsd + usdtUsd,
  }
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
  const usdcBsc   = useReadContract({ address: USDC[bsc.id],      abi: erc20Abi, functionName: 'balanceOf', args: [address!], chainId: bsc.id,      query: { enabled } })

  // USDT per chain
  const usdtBase  = useReadContract({ address: USDT[base.id],     abi: erc20Abi, functionName: 'balanceOf', args: [address!], chainId: base.id,     query: { enabled } })
  const usdtArb   = useReadContract({ address: USDT[arbitrum.id], abi: erc20Abi, functionName: 'balanceOf', args: [address!], chainId: arbitrum.id, query: { enabled } })
  const usdtOpt   = useReadContract({ address: USDT[optimism.id], abi: erc20Abi, functionName: 'balanceOf', args: [address!], chainId: optimism.id, query: { enabled } })
  const usdtMain  = useReadContract({ address: USDT[mainnet.id],  abi: erc20Abi, functionName: 'balanceOf', args: [address!], chainId: mainnet.id,  query: { enabled } })
  const usdtBsc   = useReadContract({ address: USDT[bsc.id],      abi: erc20Abi, functionName: 'balanceOf', args: [address!], chainId: bsc.id,      query: { enabled } })

  const chains: ChainBalance[] = [
    buildChain('Base',     base.id,     'ETH', natBase.data?.value,  usdcBase.data as bigint | undefined,  usdtBase.data as bigint | undefined),
    buildChain('Arbitrum', arbitrum.id, 'ETH', natArb.data?.value,   usdcArb.data  as bigint | undefined,  usdtArb.data  as bigint | undefined),
    buildChain('Optimism', optimism.id, 'ETH', natOpt.data?.value,   usdcOpt.data  as bigint | undefined,  usdtOpt.data  as bigint | undefined),
    buildChain('Ethereum', mainnet.id,  'ETH', natMain.data?.value,  usdcMain.data as bigint | undefined,  usdtMain.data as bigint | undefined),
    // BSC: both tokens use 18 decimals
    buildChain('BSC',      bsc.id,      'BNB', natBsc.data?.value,   usdcBsc.data  as bigint | undefined,  usdtBsc.data  as bigint | undefined, 18, 18),
  ]

  const totalUsd      = chains.reduce((s, c) => s + c.totalUsd, 0)
  const totalUsdc     = chains.reduce((s, c) => s + c.usdcUsd, 0)
  const totalUsdt     = chains.reduce((s, c) => s + c.usdtUsd, 0)
  const totalNativeUsd = chains.reduce((s, c) => s + c.nativeUsd, 0)
  const isLoading     = natBase.isLoading || usdcBase.isLoading || usdtBase.isLoading

  return { address, chains, totalUsd, totalUsdc, totalUsdt, totalEthUsd: totalNativeUsd, isLoading }
}
