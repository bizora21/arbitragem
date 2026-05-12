'use client'

import { useAccount, useBalance, useDisconnect, useSwitchChain } from 'wagmi'
import { base } from 'wagmi/chains'

export function useWallet() {
  const { address, isConnected, chain, status } = useAccount()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const { data: balance } = useBalance({ address })

  const isOnSupportedChain = chain !== undefined
  const isOnPreferredChain = chain?.id === base.id

  function switchToBase() {
    switchChain({ chainId: base.id })
  }

  function truncateAddress(addr: string): string {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  return {
    address,
    isConnected,
    chain,
    status,
    balance,
    disconnect,
    switchChain,
    switchToBase,
    isOnSupportedChain,
    isOnPreferredChain,
    truncatedAddress: address ? truncateAddress(address) : null,
  }
}
