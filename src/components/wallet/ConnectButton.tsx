'use client'

import { useEffect, useRef, useState } from 'react'
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { base, arbitrum, optimism, mainnet, bsc } from 'wagmi/chains'
import { AlertTriangle, ChevronDown, Loader2, LogOut, RefreshCw } from 'lucide-react'

const CHAINS = [
  { id: base.id,     name: 'Base',     short: 'BASE', color: 'bg-blue-500' },
  { id: arbitrum.id, name: 'Arbitrum', short: 'ARB',  color: 'bg-sky-500'  },
  { id: bsc.id,      name: 'BSC',      short: 'BNB',  color: 'bg-yellow-500' },
  { id: mainnet.id,  name: 'Ethereum', short: 'ETH',  color: 'bg-indigo-500' },
  { id: optimism.id, name: 'Optimism', short: 'OP',   color: 'bg-red-500'  },
]

const SUPPORTED_IDS = new Set(CHAINS.map((c) => c.id))

export function ConnectButton() {
  const [mounted, setMounted]       = useState(false)
  const [chainOpen, setChainOpen]   = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const chainRef   = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    function close(e: MouseEvent) {
      if (chainRef.current   && !chainRef.current.contains(e.target as Node))   setChainOpen(false)
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const { address, isConnected, chain } = useAccount()
  const { connect, connectors, isPending, error } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: switching } = useSwitchChain()

  const truncated  = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ''
  const currentChain = CHAINS.find((c) => c.id === chain?.id)
  const unsupported  = isConnected && chain && !SUPPORTED_IDS.has(chain.id)
  const connector    = connectors[0]

  if (!mounted) return <div className="w-28 h-7 bg-slate-700/50 rounded-lg animate-pulse" />

  if (!isConnected) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          disabled={isPending || !connector}
          onClick={() => connector && connect({ connector })}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {isPending ? <><Loader2 className="w-3 h-3 animate-spin" /> Conectando…</> : 'Ligar Carteira'}
        </button>
        {error && <span className="text-[10px] text-red-400 max-w-[160px] text-right">{error.message.split('\n')[0]}</span>}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">

      {/* ── Network switcher ── */}
      <div className="relative" ref={chainRef}>
        <button
          onClick={() => setChainOpen(!chainOpen)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
            unsupported
              ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
          }`}
        >
          {switching ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : unsupported ? (
            <AlertTriangle className="w-3 h-3" />
          ) : currentChain ? (
            <span className={`w-2 h-2 rounded-full ${currentChain.color}`} />
          ) : null}
          <span className="hidden sm:block">
            {unsupported ? 'Rede errada' : (currentChain?.name ?? chain?.name ?? '?')}
          </span>
          <span className="sm:hidden">
            {unsupported ? '?' : (currentChain?.short ?? '?')}
          </span>
          <ChevronDown className="w-3 h-3 text-slate-500" />
        </button>

        {chainOpen && (
          <div className="absolute right-0 top-full mt-1.5 w-44 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
            <p className="text-[10px] text-slate-500 px-3 pt-2 pb-1">Mudar rede</p>
            {CHAINS.map((c) => (
              <button
                key={c.id}
                onClick={() => { switchChain({ chainId: c.id }); setChainOpen(false) }}
                disabled={switching}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-slate-700 ${
                  chain?.id === c.id ? 'text-emerald-400' : 'text-slate-300'
                }`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${c.color}`} />
                {c.name}
                {chain?.id === c.id && <span className="ml-auto text-[10px] text-emerald-500">✓ activa</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Profile / address ── */}
      <div className="relative" ref={profileRef}>
        <button
          onClick={() => setProfileOpen(!profileOpen)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg transition-colors"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          {truncated}
          <ChevronDown className="w-3 h-3 text-slate-500" />
        </button>

        {profileOpen && (
          <div className="absolute right-0 top-full mt-1.5 w-52 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="px-3 py-2.5 border-b border-slate-700">
              <p className="text-[10px] text-slate-500">Carteira ligada</p>
              <p className="text-xs text-slate-200 font-mono mt-0.5 break-all">{address}</p>
            </div>
            <div className="p-1">
              <button
                onClick={() => { disconnect(); setProfileOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Desligar carteira
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
