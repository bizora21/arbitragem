'use client'

import { useAccount, useReadContract } from 'wagmi'
import { formatUnits, erc20Abi } from 'viem'
import { base, arbitrum } from 'wagmi/chains'
import { useState } from 'react'
import { Wallet, RefreshCw, ExternalLink, TrendingUp } from 'lucide-react'

// aToken addresses (Aave V3 — interest-bearing receipt tokens)
const A_TOKENS = {
  aUSDC_base:     '0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB' as `0x${string}`,
  aUSDC_arbitrum: '0x724dc807b04555b71ed48a6896b6F41593b8C637' as `0x${string}`,
}

// Compound V3 cUSDCv3 — balance = principal + interest
const C_TOKENS = {
  cUSDC_base: '0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf' as `0x${string}`,
}

// Aerodrome LP token for USDC/USDT stable pool on Base
const AERO_LP_USDC_USDT = '0x1a4b3B2d8E8E8E8E8E8E8E8E8E8E8E8E8E8E8E8E' as `0x${string}` // placeholder — fetched dynamically

const AERO_LP_POSITIONS_URL = 'https://aerodrome.finance/liquidity'

function fmt6(v: bigint | undefined | null): string {
  if (!v) return '0.00'
  return parseFloat(formatUnits(v, 6)).toFixed(2)
}

function PositionRow({ label, balance, usdValue, chain, link, apyLabel }: {
  label: string
  balance: string
  usdValue: number
  chain: string
  link?: string
  apyLabel?: string
}) {
  if (usdValue < 0.001) return null
  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-800/40 border border-slate-700/40">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-200">{label}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-400">{chain}</span>
          {apyLabel && <span className="text-[10px] text-emerald-400">{apyLabel}</span>}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{balance} USDC</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right">
          <p className="text-sm font-bold text-emerald-400">${usdValue.toFixed(2)}</p>
        </div>
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-slate-300 transition-colors">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  )
}

export function MyPositions() {
  const { address, isConnected } = useAccount()
  const [open, setOpen] = useState(false)
  const enabled = isConnected && !!address

  // Aave aToken balances (these grow automatically every block)
  const { data: aUsdcBase }    = useReadContract({ address: A_TOKENS.aUSDC_base,     abi: erc20Abi, functionName: 'balanceOf', args: [address!], chainId: base.id,     query: { enabled } })
  const { data: aUsdcArb }     = useReadContract({ address: A_TOKENS.aUSDC_arbitrum, abi: erc20Abi, functionName: 'balanceOf', args: [address!], chainId: arbitrum.id, query: { enabled } })

  // Compound cToken balance
  const { data: cUsdcBase }    = useReadContract({ address: C_TOKENS.cUSDC_base, abi: erc20Abi, functionName: 'balanceOf', args: [address!], chainId: base.id, query: { enabled } })

  const aaveBase   = parseFloat(fmt6(aUsdcBase   as bigint | null))
  const aaveArb    = parseFloat(fmt6(aUsdcArb    as bigint | null))
  const compBase   = parseFloat(fmt6(cUsdcBase   as bigint | null))

  const totalPositions = aaveBase + aaveArb + compBase
  const hasPositions   = totalPositions > 0.001

  if (!isConnected) return null

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-slate-200">As minhas posições</span>
          {hasPositions && (
            <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              ${totalPositions.toFixed(2)} depositado
            </span>
          )}
        </div>
        <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {!hasPositions ? (
            <div className="text-center py-4">
              <Wallet className="w-6 h-6 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Sem posições activas detectadas</p>
              <p className="text-[10px] text-slate-600 mt-1">Usa os painéis acima para depositar</p>
            </div>
          ) : (
            <>
              <PositionRow
                label="Aave V3 USDC"
                balance={aaveBase.toFixed(4)}
                usdValue={aaveBase}
                chain="Base"
                link="https://app.aave.com/?marketName=proto_base_v3"
                apyLabel="a ganhar juros"
              />
              <PositionRow
                label="Aave V3 USDC"
                balance={aaveArb.toFixed(4)}
                usdValue={aaveArb}
                chain="Arbitrum"
                link="https://app.aave.com/?marketName=proto_arbitrum_v3"
                apyLabel="a ganhar juros"
              />
              <PositionRow
                label="Compound V3 USDC"
                balance={compBase.toFixed(4)}
                usdValue={compBase}
                chain="Base"
                link="https://app.compound.finance/?market=usdc-basemainnet"
                apyLabel="a ganhar juros"
              />
              {/* Aerodrome LP — link out since we need pool-specific token address */}
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/30 border border-dashed border-slate-700/40">
                <span className="text-xs text-slate-500">LP Aerodrome</span>
                <a href={AERO_LP_POSITIONS_URL} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
                  <ExternalLink className="w-3 h-3" />Ver posições LP
                </a>
              </div>
            </>
          )}
          <p className="text-[10px] text-slate-600 text-center pt-1">
            Os saldos Aave/Compound crescem automaticamente a cada bloco
          </p>
        </div>
      )}
    </div>
  )
}
