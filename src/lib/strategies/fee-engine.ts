export interface FeeBreakdown {
  tradingFeeBuy: number
  tradingFeeSell: number
  withdrawalFee: number
  slippage: number
  gasCost: number
  bridgeCost: number
  flashLoanFee: number
  totalFees: number
}

interface FeeParams {
  strategy: 'FUNDING' | 'DEPEG' | 'YIELD' | 'SPREAD'
  capital: number
  exchanges?: string[]
  chains?: string[]
  isCrossChain?: boolean
  useFlashLoan?: boolean
}

const EXCHANGE_FEES: Record<string, { maker: number; taker: number; withdrawalUsd: number }> = {
  BINANCE: { maker: 0.0002, taker: 0.0005, withdrawalUsd: 8 },
  OKX:     { maker: 0.0002, taker: 0.0005, withdrawalUsd: 5 },
  BYBIT:   { maker: 0.0002, taker: 0.00055, withdrawalUsd: 12 },
}
const DEFAULT_EXCHANGE = { maker: 0.0002, taker: 0.001, withdrawalUsd: 15 }

// Average gas cost in USD for a single DeFi interaction
const GAS_COSTS: Record<string, number> = {
  Ethereum: 20,
  Base:     0.05,
  Arbitrum: 0.20,
  Optimism: 0.05,
  Polygon:  0.02,
}
const DEFAULT_GAS = 5

const BRIDGE_COST_USD = 2.5     // Average cross-chain bridge
const AAVE_FLASH_LOAN_FEE = 0.0005  // 0.05%
const UNISWAP_FLASH_LOAN_FEE = 0.003 // 0.3%

export function calculateFeeBreakdown(params: FeeParams): FeeBreakdown {
  const { strategy, capital, exchanges = [], chains = [], isCrossChain = false, useFlashLoan = false } = params

  const ex1 = EXCHANGE_FEES[exchanges[0]?.toUpperCase()] ?? DEFAULT_EXCHANGE
  const ex2 = EXCHANGE_FEES[exchanges[1]?.toUpperCase()] ?? DEFAULT_EXCHANGE

  const chain1 = chains[0] ?? 'Ethereum'
  const chain2 = chains[1] ?? chains[0] ?? 'Ethereum'

  let tradingFeeBuy = 0
  let tradingFeeSell = 0
  let withdrawalFee = 0
  let slippage = 0
  let gasCost = 0
  let bridgeCost = 0
  let flashLoanFee = 0

  switch (strategy) {
    case 'FUNDING': {
      // Long on ex1 (maker), short on ex2 (maker) — both perp
      tradingFeeBuy = capital * ex1.maker
      tradingFeeSell = capital * ex2.maker
      // Cross-exchange needs withdrawal if transferring collateral
      withdrawalFee = exchanges.length >= 2 ? (ex1.withdrawalUsd + ex2.withdrawalUsd) / 2 : 0
      // Slippage for large orders
      slippage = capital > 10000 ? capital * 0.0001 : capital * 0.00005
      gasCost = 0 // CEX only
      break
    }
    case 'YIELD': {
      // withdraw from current protocol + deposit into new protocol (taker on both)
      tradingFeeBuy = 0  // DeFi supply has no trading fee
      tradingFeeSell = 0
      withdrawalFee = 0
      const g1 = GAS_COSTS[chain1] ?? DEFAULT_GAS
      const g2 = GAS_COSTS[chain2] ?? DEFAULT_GAS
      // 2 transactions per rotation: withdraw + deposit
      gasCost = isCrossChain ? (g1 + g2) * 2 : g1 * 2
      bridgeCost = isCrossChain ? BRIDGE_COST_USD : 0
      break
    }
    case 'SPREAD': {
      // Buy on DEX (taker), sell on CEX (taker)
      tradingFeeBuy = capital * (GAS_COSTS[chain1] ?? DEFAULT_GAS) / capital // gas ratio
      tradingFeeSell = capital * ex1.taker
      slippage = capital > 10000 ? capital * 0.0003 : capital * 0.0001
      gasCost = GAS_COSTS[chain1] ?? DEFAULT_GAS
      flashLoanFee = useFlashLoan ? capital * AAVE_FLASH_LOAN_FEE : 0
      // Re-assign tradingFeeBuy to actual DEX swap fee estimate
      tradingFeeBuy = capital * 0.0005 // ~0.05% Uniswap V3 pool fee typical
      break
    }
    case 'DEPEG': {
      tradingFeeBuy = capital * ex1.taker
      tradingFeeSell = capital * ex1.taker
      slippage = capital > 5000 ? capital * 0.001 : capital * 0.0003
      gasCost = GAS_COSTS[chain1] ?? DEFAULT_GAS
      flashLoanFee = useFlashLoan ? capital * UNISWAP_FLASH_LOAN_FEE : 0
      break
    }
  }

  const totalFees = tradingFeeBuy + tradingFeeSell + withdrawalFee + slippage + gasCost + bridgeCost + flashLoanFee

  return { tradingFeeBuy, tradingFeeSell, withdrawalFee, slippage, gasCost, bridgeCost, flashLoanFee, totalFees }
}

export function calculateNetEdge(grossEdge: number, fees: FeeBreakdown): number {
  return grossEdge - fees.totalFees
}

export function minimumCapitalRequired(
  grossEdgePct: number,
  strategy: string,
  exchanges: string[] = [],
  chains: string[] = []
): number {
  if (grossEdgePct <= 0) return Infinity

  // Binary search for minimum capital where netEdge > 0
  let lo = 1, hi = 1_000_000
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    const fees = calculateFeeBreakdown({
      strategy: strategy as 'FUNDING' | 'DEPEG' | 'YIELD' | 'SPREAD',
      capital: mid,
      exchanges,
      chains,
    })
    const grossEdge = mid * (grossEdgePct / 100)
    const net = calculateNetEdge(grossEdge, fees)
    if (net > 0) hi = mid
    else lo = mid
  }
  return Math.ceil(hi)
}

export function getGasCost(chain: string): number {
  return GAS_COSTS[chain] ?? DEFAULT_GAS
}
