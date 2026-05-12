import { CONTRACTS, TOKENS } from './config'

export interface ExecutionStep {
  order: number
  action: 'approve' | 'supply' | 'withdraw' | 'swap' | 'bridge'
  protocol: string
  chain: string
  contractAddress: string
  method: string
  params: Record<string, string>
  gasEstimate: string
  deepLink?: string
}

export interface ExecutionPlan {
  strategy: string
  opportunityId: string
  steps: ExecutionStep[]
  totalGasEstimate: string
  expectedReturn: string
  netReturn: string
  canExecute: boolean
  reasonDisabled?: string
}

const DISABLED_REASON = 'Execução automática disponível em futura actualização'

export function generateYieldPlan(
  opportunity: { fromProtocol: string; toProtocol: string; fromChain: string; toChain: string; asset: string; gainPct: number; adjustedGainPct?: number },
  userCapital: number
): ExecutionPlan {
  const chain = (opportunity.toChain as string).toLowerCase() as keyof typeof CONTRACTS.aaveV3Pool
  const assetKey = opportunity.asset as keyof typeof TOKENS
  const tokenAddress = TOKENS[assetKey]?.[chain as keyof (typeof TOKENS)[typeof assetKey]] ?? '0x...'
  const aavePool = CONTRACTS.aaveV3Pool[chain as keyof typeof CONTRACTS.aaveV3Pool] ?? CONTRACTS.aaveV3Pool.base
  const gasCostChain = opportunity.toChain === 'Ethereum' ? '$15-30' : '$0.05-0.20'

  const steps: ExecutionStep[] = [
    {
      order: 1,
      action: 'approve',
      protocol: opportunity.fromProtocol,
      chain: opportunity.fromChain,
      contractAddress: tokenAddress,
      method: 'approve',
      params: { spender: aavePool, amount: String(userCapital * 1e6) },
      gasEstimate: opportunity.fromChain === 'Ethereum' ? '$5-15' : '$0.02',
    },
    {
      order: 2,
      action: 'withdraw',
      protocol: opportunity.fromProtocol,
      chain: opportunity.fromChain,
      contractAddress: aavePool,
      method: 'withdraw',
      params: { asset: tokenAddress, amount: String(userCapital * 1e6), to: '<your_wallet>' },
      gasEstimate: opportunity.fromChain === 'Ethereum' ? '$8-20' : '$0.03',
    },
    {
      order: 3,
      action: 'supply',
      protocol: opportunity.toProtocol,
      chain: opportunity.toChain,
      contractAddress: aavePool,
      method: 'supply',
      params: { asset: tokenAddress, amount: String(userCapital * 1e6), onBehalfOf: '<your_wallet>', referralCode: '0' },
      gasEstimate: gasCostChain,
    },
  ]

  const totalGas = opportunity.toChain === 'Ethereum' ? '$28-65' : '$0.08-0.25'
  const annualGain = userCapital * (opportunity.gainPct / 100)
  const adjustedGain = userCapital * ((opportunity.adjustedGainPct ?? opportunity.gainPct * 0.8) / 100)

  return {
    strategy: 'YIELD',
    opportunityId: `${opportunity.fromProtocol}_${opportunity.toProtocol}_${opportunity.asset}`,
    steps,
    totalGasEstimate: totalGas,
    expectedReturn: `+$${annualGain.toFixed(0)}/ano`,
    netReturn: `+$${adjustedGain.toFixed(0)}/ano`,
    canExecute: false,
    reasonDisabled: DISABLED_REASON,
  }
}

export function generateDepegPlan(
  event: { stablecoin: string; price: number; deviationPct: number },
  userCapital: number
): ExecutionPlan {
  const adjustedReturn = userCapital * Math.abs(event.deviationPct / 100) * 0.6

  const steps: ExecutionStep[] = [
    {
      order: 1,
      action: 'swap',
      protocol: 'Uniswap V3',
      chain: 'Ethereum',
      contractAddress: CONTRACTS.uniswapV3Router.ethereum,
      method: 'exactInputSingle',
      params: {
        tokenIn: TOKENS.USDC.ethereum,
        tokenOut: '<stablecoin_address>',
        fee: '500',
        amountIn: String(userCapital * 1e6),
      },
      gasEstimate: '$10-25',
    },
  ]

  return {
    strategy: 'DEPEG',
    opportunityId: `DEPEG_${event.stablecoin}`,
    steps,
    totalGasEstimate: '$10-25',
    expectedReturn: `${Math.abs(event.deviationPct).toFixed(2)}% do desvio`,
    netReturn: `+$${adjustedReturn.toFixed(2)}`,
    canExecute: false,
    reasonDisabled: DISABLED_REASON,
  }
}

export function generateFundingPlan(
  opportunity: { symbol: string; buyExchange: string; sellExchange: string; fundingRateDiff: number; adjustedReturn?: number },
  userCapital: number
): ExecutionPlan {
  const adjustedReturn = opportunity.adjustedReturn ?? opportunity.fundingRateDiff * 2 * 100 * 0.65

  const steps: ExecutionStep[] = [
    {
      order: 1,
      action: 'supply',
      protocol: opportunity.buyExchange,
      chain: 'CEX',
      contractAddress: 'N/A',
      method: 'transfer_collateral',
      params: { exchange: opportunity.buyExchange, amount: String(userCapital / 2), asset: 'USDT' },
      gasEstimate: '$1-8 (withdrawal fee)',
    },
    {
      order: 2,
      action: 'supply',
      protocol: opportunity.sellExchange,
      chain: 'CEX',
      contractAddress: 'N/A',
      method: 'transfer_collateral',
      params: { exchange: opportunity.sellExchange, amount: String(userCapital / 2), asset: 'USDT' },
      gasEstimate: '$1-8 (withdrawal fee)',
    },
    {
      order: 3,
      action: 'swap',
      protocol: opportunity.buyExchange,
      chain: 'CEX',
      contractAddress: 'N/A',
      method: 'open_long',
      params: { symbol: opportunity.symbol, size: String(userCapital / 2), leverage: '1x' },
      gasEstimate: '0.02% maker fee',
    },
    {
      order: 4,
      action: 'swap',
      protocol: opportunity.sellExchange,
      chain: 'CEX',
      contractAddress: 'N/A',
      method: 'open_short',
      params: { symbol: opportunity.symbol, size: String(userCapital / 2), leverage: '1x' },
      gasEstimate: '0.02% maker fee',
    },
  ]

  return {
    strategy: 'FUNDING',
    opportunityId: `FUNDING_${opportunity.symbol}_${opportunity.buyExchange}_${opportunity.sellExchange}`,
    steps,
    totalGasEstimate: '$4-20 (fees totais)',
    expectedReturn: `${(opportunity.fundingRateDiff * 3 * 365 * 100).toFixed(1)}% APY bruto`,
    netReturn: `${adjustedReturn.toFixed(2)}% por periodo`,
    canExecute: false,
    reasonDisabled: DISABLED_REASON,
  }
}

export function generateSpreadPlan(
  spread: { symbol: string; cexName: string; dexName: string; spreadPct: number; adjustedReturn?: number },
  userCapital: number
): ExecutionPlan {
  const netReturn = userCapital * ((spread.adjustedReturn ?? Math.abs(spread.spreadPct) * 0.7) / 100)
  const chain = 'Base'

  const steps: ExecutionStep[] = [
    {
      order: 1,
      action: 'swap',
      protocol: 'Uniswap V3',
      chain,
      contractAddress: CONTRACTS.uniswapV3Router.base,
      method: 'exactInputSingle',
      params: {
        tokenIn: TOKENS.USDC.base,
        tokenOut: '<asset_address>',
        fee: '500',
        amountIn: String(userCapital * 1e6),
      },
      gasEstimate: '$0.03-0.10',
    },
    {
      order: 2,
      action: 'swap',
      protocol: spread.cexName,
      chain: 'CEX',
      contractAddress: 'N/A',
      method: 'market_sell',
      params: { symbol: `${spread.symbol}USDT`, qty: String(userCapital) },
      gasEstimate: '0.05% taker fee',
    },
  ]

  return {
    strategy: 'SPREAD',
    opportunityId: `SPREAD_${spread.symbol}_${spread.cexName}`,
    steps,
    totalGasEstimate: '$0.05-0.15',
    expectedReturn: `${Math.abs(spread.spreadPct).toFixed(2)}% spread`,
    netReturn: `+$${netReturn.toFixed(2)}`,
    canExecute: false,
    reasonDisabled: DISABLED_REASON,
  }
}
