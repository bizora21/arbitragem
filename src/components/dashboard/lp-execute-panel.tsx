'use client'

import { useState, useEffect } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { parseUnits, formatUnits, erc20Abi } from 'viem'
import { base, bsc } from 'wagmi/chains'
import { Droplets, CheckCircle, AlertTriangle, Loader2, ExternalLink, ArrowRight, GitMerge } from 'lucide-react'
import { AERODROME_ROUTER, AERODROME_ADD_LIQUIDITY_ABI, USDC, USDT, DAI } from '@/lib/contracts'

// Stable pairs on Aerodrome Base
const LP_PAIRS = [
  {
    label: 'USDC / USDT',
    tokenA: { symbol: 'USDC', address: USDC[base.id], decimals: 6  },
    tokenB: { symbol: 'USDT', address: USDT[base.id], decimals: 6  },
    stable: true,
  },
  {
    label: 'USDC / DAI',
    tokenA: { symbol: 'USDC', address: USDC[base.id], decimals: 6  },
    tokenB: { symbol: 'DAI',  address: DAI[base.id],  decimals: 18 },
    stable: true,
  },
]

type LPPair = typeof LP_PAIRS[number]
type TxStep = 'idle' | 'approveA_wait' | 'approveB_wait' | 'adding' | 'add_wait' | 'done' | 'error'

export function LPExecutePanel({ feeAPY = 0, emissionAPY = 0 }: { feeAPY?: number; emissionAPY?: number }) {
  const { address, isConnected, chainId } = useAccount()
  const { switchChain } = useSwitchChain()

  const [pair, setPair]       = useState<LPPair>(LP_PAIRS[0])
  const [amountA, setAmountA] = useState('')
  const [step, setStep]       = useState<TxStep>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const isOnBase = chainId === base.id
  const isOnBsc  = chainId === bsc.id
  const enabled  = isConnected && !!address && isOnBase

  const amountABig = parseUnits(amountA || '0', pair.tokenA.decimals)
  const amountBBig = parseUnits(amountA || '0', pair.tokenB.decimals) // equal value for stable pairs
  const amountNum  = parseFloat(amountA || '0')
  const realAPY    = feeAPY + emissionAPY * 0.8
  const dailyYield = realAPY > 0 && amountNum > 0 ? ((amountNum * 2 * realAPY) / 100 / 365).toFixed(4) : null

  // Balances
  const { data: balanceARaw } = useReadContract({
    address: pair.tokenA.address, abi: erc20Abi, functionName: 'balanceOf',
    args: [address!], chainId: base.id, query: { enabled: isConnected && !!address },
  })
  const { data: balanceBRaw } = useReadContract({
    address: pair.tokenB.address, abi: erc20Abi, functionName: 'balanceOf',
    args: [address!], chainId: base.id, query: { enabled: isConnected && !!address },
  })

  // Allowances
  const { data: allowanceARaw, refetch: refetchA } = useReadContract({
    address: pair.tokenA.address, abi: erc20Abi, functionName: 'allowance',
    args: [address!, AERODROME_ROUTER], chainId: base.id, query: { enabled },
  })
  const { data: allowanceBRaw, refetch: refetchB } = useReadContract({
    address: pair.tokenB.address, abi: erc20Abi, functionName: 'allowance',
    args: [address!, AERODROME_ROUTER], chainId: base.id, query: { enabled },
  })

  const balanceA   = balanceARaw ? parseFloat(formatUnits(balanceARaw as bigint, pair.tokenA.decimals)) : 0
  const balanceB   = balanceBRaw ? parseFloat(formatUnits(balanceBRaw as bigint, pair.tokenB.decimals)) : 0
  const allowanceA = allowanceARaw as bigint | undefined
  const allowanceB = allowanceBRaw as bigint | undefined
  const needsApproveA = !allowanceA || allowanceA < amountABig
  const needsApproveB = !allowanceB || allowanceB < amountBBig

  // Approve A
  const { writeContract: doApproveA, data: approveTxA, error: errA } = useWriteContract()
  const { isSuccess: approvedA, isError: revertedA } = useWaitForTransactionReceipt({ hash: approveTxA })

  // Approve B
  const { writeContract: doApproveB, data: approveTxB, error: errB } = useWriteContract()
  const { isSuccess: approvedB, isError: revertedB } = useWaitForTransactionReceipt({ hash: approveTxB })

  // Add liquidity
  const { writeContract: doAdd, data: addTxHash, error: errAdd } = useWriteContract()
  const { isSuccess: addConfirmed, isError: addReverted } = useWaitForTransactionReceipt({ hash: addTxHash })

  useEffect(() => { if (approvedA) { refetchA(); setStep(needsApproveB ? 'approveB_wait' : 'adding') } }, [approvedA, needsApproveB, refetchA])
  useEffect(() => { if (approvedB) { refetchB(); setStep('adding') } }, [approvedB, refetchB])
  useEffect(() => { if (revertedA || revertedB) { setStep('error'); setErrorMsg('Aprovação cancelada.') } }, [revertedA, revertedB])
  useEffect(() => { if (addConfirmed) setStep('done') }, [addConfirmed])
  useEffect(() => { if (addReverted)  { setStep('error'); setErrorMsg('Liquidez rejeitada — slippage ou saldo insuficiente.') } }, [addReverted])
  useEffect(() => { if (errA || errB || errAdd) { setStep('error'); setErrorMsg((errA ?? errB ?? errAdd)!.message.slice(0, 120)) } }, [errA, errB, errAdd])

  // Auto-add liquidity when both approved
  useEffect(() => {
    if (step !== 'adding') return
    if (needsApproveA || needsApproveB) return
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200)
    const slippage = 50n // 0.5% = amountMin = amount * 995 / 1000
    const minA = amountABig * 995n / 1000n
    const minB = amountBBig * 995n / 1000n
    doAdd({
      address: AERODROME_ROUTER, abi: AERODROME_ADD_LIQUIDITY_ABI, functionName: 'addLiquidity',
      args: [pair.tokenA.address, pair.tokenB.address, pair.stable, amountABig, amountBBig, minA, minB, address!, deadline],
      chainId: base.id,
    })
    setStep('add_wait')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, allowanceA, allowanceB])

  const handleExecute = () => {
    if (!amountA || amountNum <= 0) return
    setErrorMsg('')
    if (needsApproveA) {
      doApproveA({ address: pair.tokenA.address, abi: erc20Abi, functionName: 'approve', args: [AERODROME_ROUTER, amountABig], chainId: base.id })
      setStep('approveA_wait')
    } else if (needsApproveB) {
      doApproveB({ address: pair.tokenB.address, abi: erc20Abi, functionName: 'approve', args: [AERODROME_ROUTER, amountBBig], chainId: base.id })
      setStep('approveB_wait')
    } else {
      setStep('adding')
    }
  }

  const reset = () => { setStep('idle'); setAmountA(''); setErrorMsg('') }

  if (!isConnected) return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center">
      <p className="text-sm text-slate-400">Liga a tua carteira para executar</p>
    </div>
  )

  if (step === 'done') return (
    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2">
        <CheckCircle className="w-5 h-5 text-emerald-400" />
        <span className="font-semibold text-emerald-300">Liquidez adicionada!</span>
      </div>
      <p className="text-sm text-slate-300">
        <span className="font-medium text-white">${amountA} {pair.tokenA.symbol} + ${amountA} {pair.tokenB.symbol}</span> em Aerodrome {pair.label}.
        A ganhar fees de trading automaticamente.
      </p>
      {addTxHash && (
        <a href={`https://basescan.org/tx/${addTxHash}`} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200">
          <ExternalLink className="w-3 h-3" /> Ver no Basescan
        </a>
      )}
      <button onClick={reset} className="block text-xs text-slate-500 hover:text-slate-300">Nova posição</button>
    </div>
  )

  const isProcessing = ['approveA_wait', 'approveB_wait', 'add_wait'].includes(step)
  const stepLabel = step === 'approveA_wait' ? `A aprovar ${pair.tokenA.symbol}…`
    : step === 'approveB_wait' ? `A aprovar ${pair.tokenB.symbol}…`
    : step === 'add_wait' ? 'A adicionar liquidez…' : ''

  return (
    <div className="bg-slate-800/60 border border-blue-500/20 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Droplets className="w-4 h-4 text-blue-400" />
          <span className="font-semibold text-slate-100">Adicionar liquidez · Aerodrome</span>
        </div>
        <span className="text-lg font-bold text-emerald-400">{realAPY.toFixed(1)}% APY real</span>
      </div>

      {/* Pair selector */}
      <div className="grid grid-cols-2 gap-1.5">
        {LP_PAIRS.map((p) => (
          <button key={p.label} onClick={() => { setPair(p); setStep('idle'); setErrorMsg('') }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              pair.label === p.label
                ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300'
            }`}>
            {p.label}
          </button>
        ))}
      </div>

      {/* ── BSC detected: show bridge guide ── */}
      {isOnBsc && (
        <div className="space-y-4">
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
            <p className="text-xs font-semibold text-yellow-300 flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              USDT detectado na BSC — o Aerodrome corre na rede Base
            </p>
            <p className="text-xs text-slate-400">
              São redes diferentes. Escolhe uma das duas opções abaixo para começar a ganhar.
            </p>
          </div>

          {/* Option A: bridge */}
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <GitMerge className="w-3.5 h-3.5 text-blue-400" />
              Opção A — Faz bridge para Base e usa Aerodrome
            </p>
            <p className="text-[11px] text-slate-500">
              APY mais alto · USDC/USDT LP · executa diretamente aqui depois
            </p>
            <ol className="space-y-1.5">
              {[
                'Vai a stargate.finance (mais rápido) ou app.across.to',
                'Seleciona origem BSC → destino Base, token USDT',
                'Introduz o valor e confirma (custo bridge: ~$0.50–2)',
                'USDT chega na Base em 1–5 minutos',
                'Muda a MetaMask para Base e usa o formulário acima',
              ].map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                  <span className="shrink-0 w-4 h-4 rounded-full bg-slate-700 text-slate-300 text-[10px] flex items-center justify-center font-bold">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
            <div className="flex gap-2 pt-1">
              <a href="https://stargate.finance/transfer" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600/30 rounded-lg transition-colors">
                <ExternalLink className="w-3 h-3" /> Stargate Finance
              </a>
              <a href="https://app.across.to" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-600 text-slate-400 hover:text-slate-200 rounded-lg transition-colors">
                <ExternalLink className="w-3 h-3" /> Across Protocol
              </a>
            </div>
          </div>

          {/* Option B: stay on BSC */}
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-slate-200">
              Opção B — LP/Yield diretamente na BSC
            </p>
            <p className="text-[11px] text-slate-500">
              Sem bridge · APY ligeiramente menor · já tens os fundos lá
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <a href="https://pancakeswap.finance/liquidity" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-600 text-slate-300 hover:border-slate-500 rounded-lg transition-colors">
                <ExternalLink className="w-3 h-3" />
                <div>
                  <p>PancakeSwap</p>
                  <p className="text-[10px] text-slate-500">USDT/USDC LP · BSC</p>
                </div>
              </a>
              <a href="https://app.venus.io/markets" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-600 text-slate-300 hover:border-slate-500 rounded-lg transition-colors">
                <ExternalLink className="w-3 h-3" />
                <div>
                  <p>Venus Protocol</p>
                  <p className="text-[10px] text-slate-500">Supply USDT · BSC</p>
                </div>
              </a>
              <a href="https://thena.fi/liquidity" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-600 text-slate-300 hover:border-slate-500 rounded-lg transition-colors">
                <ExternalLink className="w-3 h-3" />
                <div>
                  <p>THENA</p>
                  <p className="text-[10px] text-slate-500">Stablecoin LP · BSC</p>
                </div>
              </a>
              <a href="https://alpacafinance.org" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-600 text-slate-300 hover:border-slate-500 rounded-lg transition-colors">
                <ExternalLink className="w-3 h-3" />
                <div>
                  <p>Alpaca Finance</p>
                  <p className="text-[10px] text-slate-500">Yield USDT · BSC</p>
                </div>
              </a>
            </div>
          </div>

          <button
            onClick={() => switchChain({ chainId: base.id })}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
          >
            Mudar para Base agora (após bridge)
          </button>
        </div>
      )}

      {/* ── Wrong network (not BSC, not Base) ── */}
      {!isOnBase && !isOnBsc && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs text-yellow-300">
            <AlertTriangle className="w-3.5 h-3.5" /> Muda para Base
          </span>
          <button onClick={() => switchChain({ chainId: base.id })}
            className="text-xs px-3 py-1 bg-yellow-500/20 border border-yellow-500/40 text-yellow-200 rounded-lg">
            Mudar rede
          </button>
        </div>
      )}

      {/* Balances */}
      <div className="flex justify-between text-xs text-slate-400">
        <span>{pair.tokenA.symbol} <span className="text-slate-200">${balanceA.toFixed(2)}</span></span>
        <span>{pair.tokenB.symbol} <span className="text-slate-200">{balanceB.toFixed(pair.tokenB.decimals === 18 ? 4 : 2)}</span></span>
      </div>

      {/* Amount — equal value for stable pair */}
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input type="number" value={amountA} onChange={(e) => setAmountA(e.target.value)}
              placeholder="0.00" disabled={isProcessing}
              className="w-full bg-slate-900/70 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">{pair.tokenA.symbol}</span>
          </div>
          <button onClick={() => setAmountA(String(Math.floor(Math.min(balanceA, balanceB) * 100) / 100))}
            className="px-3 text-xs bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-slate-300">MAX</button>
        </div>
        <p className="text-xs text-slate-500 px-1">
          Par simétrico: <span className="text-slate-400">${amountA || '0'} {pair.tokenA.symbol} + ${amountA || '0'} {pair.tokenB.symbol}</span>
        </p>
        {dailyYield && (
          <p className="text-xs text-slate-500 px-1">Fees estimadas: <span className="text-blue-400 font-medium">~${dailyYield}/dia</span></p>
        )}
      </div>

      {/* Steps */}
      {step !== 'idle' && step !== 'error' && (
        <div className="flex items-center gap-1.5 text-xs flex-wrap">
          {[
            { label: `Aprovar ${pair.tokenA.symbol}`, active: step === 'approveA_wait', done: approvedA },
            { label: `Aprovar ${pair.tokenB.symbol}`, active: step === 'approveB_wait', done: approvedB },
            { label: 'Adicionar LP',                  active: step === 'add_wait',     done: addConfirmed },
          ].map((s, i, arr) => (
            <>
              <span key={s.label} className={`flex items-center gap-1 ${s.active ? 'text-yellow-300' : s.done ? 'text-emerald-400' : 'text-slate-500'}`}>
                {s.active ? <Loader2 className="w-3 h-3 animate-spin" /> : s.done ? <CheckCircle className="w-3 h-3" /> : <span className="w-3 h-3 rounded-full border border-current inline-block" />}
                {s.label}
              </span>
              {i < arr.length - 1 && <ArrowRight key={`arr-${i}`} className="w-3 h-3 text-slate-600" />}
            </>
          ))}
        </div>
      )}

      {step === 'error' && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2.5 flex items-start gap-2 text-xs text-red-400">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{errorMsg}
        </div>
      )}

      <button onClick={step === 'error' ? reset : handleExecute}
        disabled={isProcessing || !isOnBase || !amountA || amountNum <= 0 || amountNum > Math.min(balanceA, balanceB)}
        className="w-full py-3 rounded-xl font-semibold text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white transition-all">
        {isProcessing
          ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{stepLabel}</span>
          : step === 'error' ? 'Tentar novamente'
          : `Adicionar $${amountA || '0'} + $${amountA || '0'} em ${pair.label}`}
      </button>
      <p className="text-[10px] text-slate-600 text-center">3 confirmações MetaMask · Nunca sais da ferramenta</p>
    </div>
  )
}
