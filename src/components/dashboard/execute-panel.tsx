'use client'

import { useState, useEffect } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { parseUnits, formatUnits, erc20Abi } from 'viem'
import { base, arbitrum } from 'wagmi/chains'
import { Zap, CheckCircle, AlertTriangle, Loader2, ExternalLink, ArrowRight } from 'lucide-react'
import { AAVE_POOL, AAVE_SUPPLY_ABI, COMPOUND_COMET, COMPOUND_SUPPLY_ABI, USDC } from '@/lib/contracts'

export type YieldProtocol = 'aave-base' | 'aave-arb' | 'compound-base' | 'compound-arb'

const PROTOCOL_META: Record<YieldProtocol, {
  label: string
  chain: typeof base | typeof arbitrum
  chainId: number
  contractAddress: `0x${string}`
  abi: typeof AAVE_SUPPLY_ABI | typeof COMPOUND_SUPPLY_ABI
  scanUrl: string
}> = {
  'aave-base':     { label: 'Aave V3 · Base',      chain: base,     chainId: base.id,     contractAddress: AAVE_POOL[base.id],       abi: AAVE_SUPPLY_ABI,     scanUrl: 'https://basescan.org/tx/' },
  'aave-arb':      { label: 'Aave V3 · Arbitrum',  chain: arbitrum, chainId: arbitrum.id, contractAddress: AAVE_POOL[arbitrum.id],   abi: AAVE_SUPPLY_ABI,     scanUrl: 'https://arbiscan.io/tx/' },
  'compound-base': { label: 'Compound V3 · Base',  chain: base,     chainId: base.id,     contractAddress: COMPOUND_COMET[base.id],  abi: COMPOUND_SUPPLY_ABI, scanUrl: 'https://basescan.org/tx/' },
  'compound-arb':  { label: 'Compound V3 · Arb',   chain: arbitrum, chainId: arbitrum.id, contractAddress: COMPOUND_COMET[arbitrum.id], abi: COMPOUND_SUPPLY_ABI, scanUrl: 'https://arbiscan.io/tx/' },
}

function fmtUsdc(v: bigint | undefined) {
  if (!v) return '0.00'
  return parseFloat(formatUnits(v, 6)).toFixed(2)
}

type TxStep = 'idle' | 'approve_wait' | 'supplying' | 'supply_wait' | 'done' | 'error'

interface Props {
  apy: number
  defaultProtocol?: YieldProtocol
}

export function ExecutePanel({ apy, defaultProtocol = 'aave-base' }: Props) {
  const { address, isConnected, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const [selected, setSelected] = useState<YieldProtocol>(defaultProtocol)
  const [amount, setAmount]     = useState('')
  const [step, setStep]         = useState<TxStep>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const meta     = PROTOCOL_META[selected]
  const isOnChain = chainId === meta.chainId
  const enabled   = isConnected && !!address && isOnChain
  const usdcAddr  = USDC[meta.chainId]

  // USDC balance
  const { data: usdcRaw, refetch: refetchBalance } = useReadContract({
    address: usdcAddr,
    abi:     erc20Abi,
    functionName: 'balanceOf',
    args:    [address!],
    chainId: meta.chainId,
    query:   { enabled: isConnected && !!address },
  })

  // Allowance
  const { data: allowanceRaw, refetch: refetchAllowance } = useReadContract({
    address: usdcAddr,
    abi:     erc20Abi,
    functionName: 'allowance',
    args:    [address!, meta.contractAddress],
    chainId: meta.chainId,
    query:   { enabled },
  })

  const amountBig   = parseUnits(amount || '0', 6)
  const usdcBalance = parseFloat(fmtUsdc(usdcRaw as bigint | undefined))
  const allowance   = allowanceRaw as bigint | undefined
  const needsApprove = !allowance || allowance < amountBig
  const amountNum   = parseFloat(amount || '0')
  const dailyYield  = apy > 0 && amountNum > 0 ? ((amountNum * apy) / 100 / 365).toFixed(4) : null
  const yearlyYield = apy > 0 && amountNum > 0 ? ((amountNum * apy) / 100).toFixed(2) : null

  // Approve
  const { writeContract: doApprove, data: approveTxHash, isPending: approveSubmitting, error: approveErr } = useWriteContract()
  const { isSuccess: approveConfirmed, isError: approveReverted } = useWaitForTransactionReceipt({ hash: approveTxHash })

  // Supply
  const { writeContract: doSupply, data: supplyTxHash, isPending: supplySubmitting, error: supplyErr } = useWriteContract()
  const { isSuccess: supplyConfirmed, isError: supplyReverted } = useWaitForTransactionReceipt({ hash: supplyTxHash })

  useEffect(() => { if (approveConfirmed) { refetchAllowance(); setStep('supplying') } }, [approveConfirmed, refetchAllowance])
  useEffect(() => { if (approveReverted) { setStep('error'); setErrorMsg('Aprovação rejeitada.') } }, [approveReverted])
  useEffect(() => { if (supplyConfirmed) { setStep('done'); refetchBalance() } }, [supplyConfirmed, refetchBalance])
  useEffect(() => { if (supplyReverted)  { setStep('error'); setErrorMsg('Depósito rejeitado ou sem saldo suficiente.') } }, [supplyReverted])
  useEffect(() => { if (approveErr) { setStep('error'); setErrorMsg(approveErr.message.slice(0, 120)) } }, [approveErr])
  useEffect(() => { if (supplyErr)  { setStep('error'); setErrorMsg(supplyErr.message.slice(0, 120))  } }, [supplyErr])

  // Auto-supply after approval confirmed + allowance refreshed
  useEffect(() => {
    if (step !== 'supplying') return
    if (!allowance || allowance < amountBig) return
    const isAave = selected.startsWith('aave')
    if (isAave) {
      doSupply({ address: meta.contractAddress, abi: AAVE_SUPPLY_ABI, functionName: 'supply', args: [usdcAddr, amountBig, address!, 0], chainId: meta.chainId })
    } else {
      doSupply({ address: meta.contractAddress, abi: COMPOUND_SUPPLY_ABI, functionName: 'supply', args: [usdcAddr, amountBig], chainId: meta.chainId })
    }
    setStep('supply_wait')
  }, [step, allowance, amountBig, address, doSupply, meta, selected, usdcAddr])

  const handleExecute = () => {
    if (!amount || amountNum <= 0) return
    setErrorMsg('')
    if (needsApprove) {
      doApprove({ address: usdcAddr, abi: erc20Abi, functionName: 'approve', args: [meta.contractAddress, amountBig], chainId: meta.chainId })
      setStep('approve_wait')
    } else {
      setStep('supplying')
    }
  }

  const reset = () => { setStep('idle'); setAmount(''); setErrorMsg('') }

  if (!isConnected) {
    return (
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center">
        <p className="text-sm text-slate-400">Liga a tua carteira para executar</p>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <span className="font-semibold text-emerald-300">Depósito confirmado!</span>
        </div>
        <p className="text-sm text-slate-300">
          <span className="font-medium text-white">${amount} USDC</span> em {meta.label} — a ganhar <span className="text-emerald-400 font-medium">{apy.toFixed(2)}% APY</span> (~${dailyYield}/dia).
        </p>
        {supplyTxHash && (
          <a href={`${meta.scanUrl}${supplyTxHash}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors">
            <ExternalLink className="w-3 h-3" /> Ver transação no explorer
          </a>
        )}
        <button onClick={reset} className="block text-xs text-slate-500 hover:text-slate-300 transition-colors">Novo depósito</button>
      </div>
    )
  }

  const isProcessing = step === 'approve_wait' || step === 'supply_wait' || approveSubmitting || supplySubmitting

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-slate-100">Depositar dentro da ferramenta</span>
        </div>
        <span className="text-lg font-bold text-emerald-400">{apy.toFixed(2)}% APY</span>
      </div>

      {/* Protocol selector */}
      <div className="grid grid-cols-2 gap-1.5">
        {(Object.keys(PROTOCOL_META) as YieldProtocol[]).map((key) => (
          <button key={key} onClick={() => { setSelected(key); setStep('idle'); setErrorMsg('') }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              selected === key
                ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300'
            }`}>
            {PROTOCOL_META[key].label}
          </button>
        ))}
      </div>

      {/* Chain warning */}
      {!isOnChain && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-xs text-yellow-300">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Muda a MetaMask para {meta.chain.name}
          </span>
          <button onClick={() => switchChain({ chainId: meta.chainId })}
            className="text-xs px-3 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-200 rounded-lg transition-colors">
            Mudar rede
          </button>
        </div>
      )}

      {/* Balance */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>USDC em {meta.chain.name}</span>
        <span className="text-slate-200 font-medium">${usdcBalance.toFixed(2)}</span>
      </div>

      {/* Amount */}
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00" min="1" max={usdcBalance} disabled={isProcessing}
              className="w-full bg-slate-900/70 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-50" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">USDC</span>
          </div>
          <button onClick={() => setAmount(String(Math.floor(usdcBalance * 100) / 100))}
            className="px-3 py-2.5 text-xs bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-slate-300 transition-colors">
            MAX
          </button>
        </div>
        {amountNum > 0 && amountNum < 10 && (
          <p className="text-xs text-yellow-400/80 px-1 flex items-center gap-1">
            <span>⚠</span> Com menos de $10 os ganhos diários são inferiores a $0.001. Recomendado: $50+.
          </p>
        )}
        {amountNum > 0 && apy > 0 && (
          <div className="flex gap-3 text-xs text-slate-500 px-1">
            <span>Dia <span className="text-emerald-400 font-medium">+${dailyYield}</span></span>
            <span>Mês <span className="text-emerald-400 font-medium">+${((amountNum * apy) / 100 / 12).toFixed(2)}</span></span>
            <span>Ano <span className="text-emerald-400 font-medium">+${yearlyYield}</span></span>
          </div>
        )}
      </div>

      {/* Steps */}
      {step !== 'idle' && step !== 'error' && (
        <div className="flex items-center gap-2 text-xs">
          <span className={`flex items-center gap-1.5 ${step === 'approve_wait' ? 'text-yellow-300' : approveConfirmed ? 'text-emerald-400' : 'text-slate-500'}`}>
            {step === 'approve_wait' ? <Loader2 className="w-3 h-3 animate-spin" /> : approveConfirmed ? <CheckCircle className="w-3 h-3" /> : <span className="w-3 h-3 rounded-full border border-current inline-block" />}
            Aprovação USDC
          </span>
          <ArrowRight className="w-3 h-3 text-slate-600" />
          <span className={`flex items-center gap-1.5 ${step === 'supply_wait' ? 'text-yellow-300' : supplyConfirmed ? 'text-emerald-400' : 'text-slate-500'}`}>
            {step === 'supply_wait' ? <Loader2 className="w-3 h-3 animate-spin" /> : supplyConfirmed ? <CheckCircle className="w-3 h-3" /> : <span className="w-3 h-3 rounded-full border border-current inline-block" />}
            Depósito
          </span>
        </div>
      )}

      {step === 'error' && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2.5 flex items-start gap-2 text-xs text-red-400">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {errorMsg || 'Erro. Tenta novamente.'}
        </div>
      )}

      <button onClick={step === 'error' ? reset : handleExecute}
        disabled={isProcessing || !isOnChain || !amount || amountNum <= 0 || amountNum > usdcBalance}
        className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
          step === 'error'
            ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            : 'bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white'
        }`}>
        {isProcessing
          ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{step === 'approve_wait' ? 'A confirmar aprovação…' : 'A confirmar depósito…'}</span>
          : step === 'error' ? 'Tentar novamente'
          : needsApprove && amountNum > 0 ? `Aprovar + Depositar $${amount} USDC`
          : `Depositar $${amount || '0'} USDC`}
      </button>
      <p className="text-[10px] text-slate-600 text-center">MetaMask confirma cada passo · Nunca sais desta ferramenta</p>
    </div>
  )
}
