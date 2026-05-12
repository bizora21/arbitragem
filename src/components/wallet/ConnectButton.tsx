'use client'

import { useEffect, useState } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { AlertTriangle, Loader2 } from 'lucide-react'

const SUPPORTED_CHAIN_IDS = [1, 8453, 42161, 10, 137]

export function ConnectButton() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const { address, isConnected, chain } = useAccount()
  const { connect, connectors, isPending, error } = useConnect()
  const { disconnect } = useDisconnect()

  const truncated = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ''
  const unsupported = isConnected && chain && !SUPPORTED_CHAIN_IDS.includes(chain.id)
  const connector = connectors[0]

  // Avoid SSR hydration mismatch
  if (!mounted) {
    return <div className="w-28 h-7 bg-slate-700/50 rounded-lg animate-pulse" />
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          disabled={isPending || !connector}
          onClick={() => connector && connect({ connector })}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Conectando…
            </>
          ) : 'Connect Wallet'}
        </button>
        {error && (
          <span className="text-[10px] text-red-400 max-w-[160px] text-right leading-tight">
            {error.message.split('\n')[0]}
          </span>
        )}
      </div>
    )
  }

  if (unsupported) {
    return (
      <button
        onClick={() => disconnect()}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 rounded-lg transition-colors"
      >
        <AlertTriangle className="w-3 h-3" />
        Rede errada
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {chain && (
        <span className="hidden sm:flex items-center gap-1 px-2 py-1.5 text-xs bg-slate-800 border border-slate-700 text-slate-400 rounded-lg">
          {chain.name}
        </span>
      )}
      <button
        onClick={() => disconnect()}
        title="Clica para desconectar"
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg transition-colors"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        {truncated}
      </button>
    </div>
  )
}
