'use client'

import { useAccount, useBalance, useReadContract } from 'wagmi'
import { erc20Abi, formatUnits } from 'viem'
import { base, arbitrum, optimism, mainnet } from 'wagmi/chains'

const USDC: Record<number, `0x${string}`> = {
  [mainnet.id]:  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  [base.id]:     '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  [arbitrum.id]: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  [optimism.id]: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
}

// Static ETH price for display — good enough; update via CoinGecko in future
const ETH_USD = 3000

export interface ChainBalance {
  name: string
  chainId: number
  ethBalance: string
  usdcBalance: string
  ethUsd: number
  usdcUsd: number
  totalUsd: number
}

function fmtEth(value: bigint | undefined, decimals: number = 18): string {
  if (value === undefined) return '0'
  return formatUnits(value, decimals)
}

function fmtUsdc(value: bigint | undefined): string {
  if (value === undefined) return '0'
  return formatUnits(value, 6)  // USDC has 6 decimals
}

function toNum(s: string): number {
  return parseFloat(s) || 0
}

export function useWalletBalance() {
  const { address } = useAccount()
  const enabled = !!address

  // Native ETH per chain
  const ethBase  = useBalance({ address, chainId: base.id })
  const ethArb   = useBalance({ address, chainId: arbitrum.id })
  const ethOpt   = useBalance({ address, chainId: optimism.id })
  const ethMain  = useBalance({ address, chainId: mainnet.id })

  // USDC per chain via ERC-20 balanceOf
  const usdcBase  = useReadContract({ address: USDC[base.id],     abi: erc20Abi, functionName: 'balanceOf', args: [address!], chainId: base.id,     query: { enabled } })
  const usdcArb   = useReadContract({ address: USDC[arbitrum.id], abi: erc20Abi, functionName: 'balanceOf', args: [address!], chainId: arbitrum.id, query: { enabled } })
  const usdcOpt   = useReadContract({ address: USDC[optimism.id], abi: erc20Abi, functionName: 'balanceOf', args: [address!], chainId: optimism.id, query: { enabled } })
  const usdcMain  = useReadContract({ address: USDC[mainnet.id],  abi: erc20Abi, functionName: 'balanceOf', args: [address!], chainId: mainnet.id,  query: { enabled } })

  const chains: ChainBalance[] = [
    {
      name: 'Base',
      chainId: base.id,
      ethBalance:  fmtEth(ethBase.data?.value),
      usdcBalance: fmtUsdc(usdcBase.data as bigint | undefined),
      ethUsd:  toNum(fmtEth(ethBase.data?.value))  * ETH_USD,
      usdcUsd: toNum(fmtUsdc(usdcBase.data as bigint | undefined)),
      totalUsd: toNum(fmtEth(ethBase.data?.value)) * ETH_USD + toNum(fmtUsdc(usdcBase.data as bigint | undefined)),
    },
    {
      name: 'Arbitrum',
      chainId: arbitrum.id,
      ethBalance:  fmtEth(ethArb.data?.value),
      usdcBalance: fmtUsdc(usdcArb.data as bigint | undefined),
      ethUsd:  toNum(fmtEth(ethArb.data?.value))  * ETH_USD,
      usdcUsd: toNum(fmtUsdc(usdcArb.data as bigint | undefined)),
      totalUsd: toNum(fmtEth(ethArb.data?.value)) * ETH_USD + toNum(fmtUsdc(usdcArb.data as bigint | undefined)),
    },
    {
      name: 'Optimism',
      chainId: optimism.id,
      ethBalance:  fmtEth(ethOpt.data?.value),
      usdcBalance: fmtUsdc(usdcOpt.data as bigint | undefined),
      ethUsd:  toNum(fmtEth(ethOpt.data?.value))  * ETH_USD,
      usdcUsd: toNum(fmtUsdc(usdcOpt.data as bigint | undefined)),
      totalUsd: toNum(fmtEth(ethOpt.data?.value)) * ETH_USD + toNum(fmtUsdc(usdcOpt.data as bigint | undefined)),
    },
    {
      name: 'Ethereum',
      chainId: mainnet.id,
      ethBalance:  fmtEth(ethMain.data?.value),
      usdcBalance: fmtUsdc(usdcMain.data as bigint | undefined),
      ethUsd:  toNum(fmtEth(ethMain.data?.value))  * ETH_USD,
      usdcUsd: toNum(fmtUsdc(usdcMain.data as bigint | undefined)),
      totalUsd: toNum(fmtEth(ethMain.data?.value)) * ETH_USD + toNum(fmtUsdc(usdcMain.data as bigint | undefined)),
    },
  ]

  const totalUsd    = chains.reduce((s, c) => s + c.totalUsd, 0)
  const totalUsdc   = chains.reduce((s, c) => s + c.usdcUsd, 0)
  const totalEthUsd = chains.reduce((s, c) => s + c.ethUsd, 0)
  const isLoading   = ethBase.isLoading || usdcBase.isLoading

  return { address, chains, totalUsd, totalUsdc, totalEthUsd, isLoading }
}
