'use client'

import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { useWalletBalance } from '@/hooks/useWalletBalance'
import { Wallet, ChevronDown, ChevronUp } from 'lucide-react'

function fmtUsd(n: number) {
  if (n === 0) return '$0.00'
  if (n < 0.01) return '<$0.01'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)
}

function fmtEth(s: string) {
  const n = parseFloat(s)
  if (!n) return '0'
  return n < 0.0001 ? '<0.0001' : n.toFixed(4)
}

export function WalletBalance() {
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => setMounted(true), [])

  const { isConnected } = useAccount()
  const { chains, totalUsd, totalUsdc, totalEthUsd, isLoading } = useWalletBalance()

  if (!mounted || !isConnected) return null

  const activeChains = chains.filter((c) => c.totalUsd > 0.001)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
      >
        <Wallet className="w-3 h-3 text-emerald-400" />
        {isLoading ? (
          <span className="text-slate-400 w-12 h-3 bg-slate-600 rounded animate-pulse inline-block" />
        ) : (
          <span className="font-medium text-slate-200">{fmtUsd(totalUsd)}</span>
        )}
        {open ? <ChevronUp className="w-3 h-3 text-slate-500" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Total */}
          <div className="px-4 py-3 border-b border-slate-700">
            <p className="text-xs text-slate-500">Saldo total</p>
            <p className="text-lg font-bold text-white mt-0.5">{fmtUsd(totalUsd)}</p>
            <div className="flex gap-3 mt-1 text-xs text-slate-400">
              <span>USDC <span className="text-slate-200">{fmtUsd(totalUsdc)}</span></span>
              <span>Nativo <span className="text-slate-200">{fmtUsd(totalEthUsd)}</span></span>
            </div>
          </div>

          {/* Per-chain breakdown */}
          <div className="p-2 space-y-1">
            {isLoading ? (
              <div className="space-y-2 p-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-8 bg-slate-700/50 rounded animate-pulse" />
                ))}
              </div>
            ) : activeChains.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-3">
                Sem saldo nestas chains
              </p>
            ) : (
              activeChains.map((c) => (
                <div key={c.name} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-700/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-300">{c.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-slate-200">{fmtUsd(c.totalUsd)}</p>
                    <div className="flex gap-2 text-[10px] text-slate-500">
                      {c.usdcUsd > 0 && <span>{fmtUsd(c.usdcUsd)} USDC/USDT</span>}
                      {c.nativeUsd > 0 && <span>{fmtEth(c.nativeBalance)} {c.nativeSymbol}</span>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Security note */}
          <div className="border-t border-slate-700 px-3 py-2">
            <p className="text-[10px] text-slate-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              Leitura apenas — o scanner nunca move fundos
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
