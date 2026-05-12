'use client'

import { useState, useEffect } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { parseUnits, formatUnits, erc20Abi } from 'viem'
import { base } from 'wagmi/chains'
import { TrendingDown, CheckCircle, AlertTriangle, Loader2, ExternalLink, ArrowRight, Info } from 'lucide-react'
import { UNISWAP_ROUTER, UNISWAP_SWAP_ABI, USDC } from '@/lib/contracts'

// Depegged stablecoins available to buy on Base via Uniswap V3
const DEPEG_TARGETS = [
  {
    symbol: 'FRAX',
    address: '0xBB558A58F7F9F7B4Cd4DE6f0d1234f04c37C4f9b' as `0x${string}`,
    decimals: 18,
    fee: 500 as const, // 0.05% pool
    description: 'Se voltou ao peg, lucraste o desvio',
  },
  {
    symbol: 'DAI',
    address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb' as `0x${string}`,
    decimals: 18,
    fee: 100 as const, // 0.01% stable pool
    description: 'MakerDAO — stablecoin colateralizada',
  },
] as const

type TxStep = 'idle' | 'approve_wait' | 'swapping' | 'swap_wait' | 'done' | 'error'

interface Props {
  // Pre-select a token if coming from depeg monitor alert
  preselect?: string
  deviationPct?: number
}

export function DepegExecutePanel({ preselect, deviationPct }: Props) {
  const { address, isConnected, chainId } = useAccount()
  const { switchChain } = useSwitchChain()

  const defaultTarget = DEPEG_TARGETS.find((t) => t.symbol === preselect) ?? DEPEG_TARGETS[0]
  const [target, setTarget]   = useState(defaultTarget)
  const [amount, setAmount]   = useState('')
  const [step, setStep]       = useState<TxStep>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const isOnBase = chainId === base.id
  const enabled  = isConnected && !!address && isOnBase
  const usdcAddr = USDC[base.id]
  const routerAddr = UNISWAP_ROUTER[base.id]

  const { data: usdcRaw, refetch: refetchBalance } = useReadContract({
    address: usdcAddr, abi: erc20Abi, functionName: 'balanceOf',
    args: [address!], chainId: base.id, query: { enabled: isConnected && !!address },
  })

  const { data: allowanceRaw, refetch: refetchAllowance } = useReadContract({
    address: usdcAddr, abi: erc20Abi, functionName: 'allowance',
    args: [address!, routerAddr], chainId: base.id, query: { enabled },
  })

  const amountBig    = parseUnits(amount || '0', 6) // USDC = 6 decimals
  const usdcBalance  = usdcRaw ? parseFloat(formatUnits(usdcRaw as bigint, 6)) : 0
  const allowance    = allowanceRaw as bigint | undefined
  const needsApprove = !allowance || allowance < amountBig
  const amountNum    = parseFloat(amount || '0')

  // Estimated gain if token repeg (based on current deviation)
  const deviation    = deviationPct ? Math.abs(deviationPct) : 0
  const estimatedGain = deviation > 0 && amountNum > 0 ? ((amountNum * deviation) / 100).toFixed(4) : null

  const { writeContract: doApprove, data: approveTxHash, error: approveErr } = useWriteContract()
  const { isSuccess: approveConfirmed, isError: approveReverted }            = useWaitForTransactionReceipt({ hash: approveTxHash })

  const { writeContract: doSwap, data: swapTxHash, error: swapErr }         = useWriteContract()
  const { isSuccess: swapConfirmed, isError: swapReverted }                  = useWaitForTransactionReceipt({ hash: swapTxHash })

  useEffect(() => { if (approveConfirmed) { refetchAllowance(); setStep('swapping') } }, [approveConfirmed, refetchAllowance])
  useEffect(() => { if (approveReverted)  { setStep('error'); setErrorMsg('Aprovação cancelada.') }    }, [approveReverted])
  useEffect(() => { if (swapConfirmed)    { setStep('done'); refetchBalance() }   }, [swapConfirmed, refetchBalance])
  useEffect(() => { if (swapReverted)     { setStep('error'); setErrorMsg('Swap falhado — slippage ou liquidez insuficiente.') } }, [swapReverted])
  useEffect(() => { if (approveErr) { setStep('error'); setErrorMsg(approveErr.message.slice(0, 120)) } }, [approveErr])
  useEffect(() => { if (swapErr)    { setStep('error'); setErrorMsg(swapErr.message.slice(0, 120))    } }, [swapErr])

  useEffect(() => {
    if (step !== 'swapping') return
    if (!allowance || allowance < amountBig) return
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200) // 20 min
    doSwap({
      address: routerAddr, abi: UNISWAP_SWAP_ABI, functionName: 'exactInputSingle',
      args: [{
        tokenIn:           usdcAddr,
        tokenOut:          target.address,
        fee:               target.fee,
        recipient:         address!,
        amountIn:          amountBig,
        amountOutMinimum:  0n, // accept any amount — small amounts, low risk
        sqrtPriceLimitX96: 0n,
      }],
      chainId: base.id,
    })
    setStep('swap_wait')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, allowance])

  const handleExecute = () => {
    if (!amount || amountNum <= 0) return
    setErrorMsg('')
    if (needsApprove) {
      doApprove({ address: usdcAddr, abi: erc20Abi, functionName: 'approve', args: [routerAddr, amountBig], chainId: base.id })
      setStep('approve_wait')
    } else {
      setStep('swapping')
    }
  }

  const reset = () => { setStep('idle'); setAmount(''); setErrorMsg('') }

  if (!isConnected) return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center">
      <p className="text-sm text-slate-400">Liga a tua carteira para executar</p>
    </div>
  )

  if (step === 'done') return (
    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2">
        <CheckCircle className="w-5 h-5 text-emerald-400" />
        <span className="font-semibold text-emerald-300">Compra executada!</span>
      </div>
      <p className="text-sm text-slate-300">
        <span className="font-medium text-white">${amount} USDC</span> trocado por <span className="text-emerald-400 font-medium">{target.symbol}</span>.
        {estimatedGain && <span> Se voltar ao peg: <span className="text-emerald-400">+${estimatedGain}</span></span>}
      </p>
      {swapTxHash && (
        <a href={`https://basescan.org/tx/${swapTxHash}`} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200">
          <ExternalLink className="w-3 h-3" /> Ver no Basescan
        </a>
      )}
      <button onClick={reset} className="block text-xs text-slate-500 hover:text-slate-300">Novo swap</button>
    </div>
  )

  const isProcessing = step === 'approve_wait' || step === 'swap_wait'

  return (
    <div className="bg-slate-800/60 border border-yellow-500/20 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-yellow-400" />
          <span className="font-semibold text-slate-100">Comprar depeg dentro da ferramenta</span>
        </div>
        {deviation > 0 && (
          <span className="text-xs text-yellow-300 bg-yellow-500/10 border border-yellow-500/30 px-2 py-0.5 rounded-full">
            -{deviation.toFixed(2)}% abaixo do peg
          </span>
        )}
      </div>

      {/* Strategy info */}
      <div className="flex items-start gap-2 bg-slate-900/40 rounded-lg p-2.5 text-xs text-slate-400">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-500" />
        <span>Compras a stablecoin enquanto está abaixo de $1.00. Quando voltar ao peg, vendes com lucro = desvio%.</span>
      </div>

      {/* Token selector */}
      <div className="grid grid-cols-2 gap-1.5">
        {DEPEG_TARGETS.map((t) => (
          <button key={t.symbol} onClick={() => { setTarget(t); setStep('idle'); setErrorMsg('') }}
            className={`px-2.5 py-2 rounded-lg text-xs font-medium border transition-colors ${
              target.symbol === t.symbol
                ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300'
            }`}>
            {t.symbol}
            <span className="block text-[9px] font-normal text-slate-500 mt-0.5">{t.description}</span>
          </button>
        ))}
      </div>

      {!isOnBase && (
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

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>USDC disponível em Base</span>
        <span className="text-slate-200 font-medium">${usdcBalance.toFixed(2)}</span>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00" disabled={isProcessing}
            className="w-full bg-slate-900/70 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-yellow-500 disabled:opacity-50" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">USDC</span>
        </div>
        <button onClick={() => setAmount(String(Math.floor(usdcBalance * 100) / 100))}
          className="px-3 text-xs bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-slate-300">MAX</button>
      </div>

      {amountNum > 0 && estimatedGain && (
        <p className="text-xs text-slate-500 px-1">
          Lucro estimado se repeg: <span className="text-yellow-400 font-medium">+${estimatedGain} USDC</span>
        </p>
      )}

      {step !== 'idle' && step !== 'error' && (
        <div className="flex items-center gap-2 text-xs">
          <span className={`flex items-center gap-1.5 ${step === 'approve_wait' ? 'text-yellow-300' : approveConfirmed ? 'text-emerald-400' : 'text-slate-500'}`}>
            {step === 'approve_wait' ? <Loader2 className="w-3 h-3 animate-spin" /> : approveConfirmed ? <CheckCircle className="w-3 h-3" /> : <span className="w-3 h-3 rounded-full border border-current inline-block" />}
            Aprovação USDC
          </span>
          <ArrowRight className="w-3 h-3 text-slate-600" />
          <span className={`flex items-center gap-1.5 ${step === 'swap_wait' ? 'text-yellow-300' : swapConfirmed ? 'text-emerald-400' : 'text-slate-500'}`}>
            {step === 'swap_wait' ? <Loader2 className="w-3 h-3 animate-spin" /> : swapConfirmed ? <CheckCircle className="w-3 h-3" /> : <span className="w-3 h-3 rounded-full border border-current inline-block" />}
            Swap {target.symbol}
          </span>
        </div>
      )}

      {step === 'error' && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2.5 flex items-start gap-2 text-xs text-red-400">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{errorMsg}
        </div>
      )}

      <button onClick={step === 'error' ? reset : handleExecute}
        disabled={isProcessing || !isOnBase || !amount || amountNum <= 0 || amountNum > usdcBalance}
        className="w-full py-3 rounded-xl font-semibold text-sm bg-yellow-600 hover:bg-yellow-500 disabled:bg-slate-700 disabled:text-slate-500 text-white transition-all">
        {isProcessing
          ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{step === 'approve_wait' ? 'A confirmar aprovação…' : `A comprar ${target.symbol}…`}</span>
          : step === 'error' ? 'Tentar novamente'
          : `Comprar $${amount || '0'} de ${target.symbol} abaixo do peg`}
      </button>
      <p className="text-[10px] text-slate-600 text-center">MetaMask confirma · Nunca sais da ferramenta</p>
    </div>
  )
}
