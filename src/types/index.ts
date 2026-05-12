import type { User, Session } from '@supabase/supabase-js'

export type AuthUser = User
export type AuthSession = Session

export interface AuthState {
  user: AuthUser | null
  session: AuthSession | null
  loading: boolean
}

// Exchange identifiers
export type Exchange = 'OKX' | 'BINANCE' | 'BYBIT'

// Raw funding rate from any exchange
export interface FundingRate {
  symbol: string
  exchange: Exchange
  fundingRate: number
  markPrice: number | null
  indexPrice: number | null
  nextFundingTime: Date | null
  timestamp: Date
  volume24hUSD?: number  // volume em USDT nas últimas 24h (para cálculo de slippage)
}

// Normalized funding rate with symbol mapped
export interface NormalizedFundingRate extends FundingRate {
  normalizedSymbol: string // e.g. BTCUSDT
}

// A cross-exchange arbitrage opportunity
export interface ArbitrageOpportunity {
  id: string
  symbol: string
  normalizedSymbol: string
  buyExchange: Exchange       // Exchange where you go LONG perp (lower rate)
  sellExchange: Exchange      // Exchange where you go SHORT perp (higher rate)
  buyRate: number
  sellRate: number
  fundingRateDiff: number
  annualizedReturn: number
  riskScore: number
  netProfitPerPeriod: number
  positionSizeUSD: number
  breakEvenDays: number
  monthlyReturn: number
  monthlyProfitUSD: number
  status: 'ACTIVE' | 'CLOSED' | 'EXPIRED'
  createdAt: Date
}

// Profit calculation inputs
export interface ProfitCalculatorParams {
  fundingRate: number
  positionSizeUSD: number
  spotMakerFee: number
  perpMakerFee: number
  spreadPercent: number
  leverage: number
}

// Profit calculation result
export interface ProfitCalculationResult {
  fundingPerPeriod: number
  netProfitPerPeriod: number
  entryCost: number
  breakEvenPeriods: number
  breakEvenDays: number
  monthlyReturn: number
  annualizedReturn: number
  monthlyProfitUSD: number
}

// Risk analysis inputs
export interface RiskAnalysisParams {
  symbol: string
  exchange: Exchange
  currentFundingRate: number
  historicalRates: number[]
  positionSizeUSD: number
  volume24h?: number
  spreadPercent?: number
  leverage?: number
}

// Risk analysis result
export interface RiskAnalysisResult {
  fundingRateVolatility: number
  flipProbability: number
  liquidationDistance: number
  spreadTrend: 'WIDENING' | 'STABLE' | 'NARROWING'
  volumeAdequate: boolean
  overallRiskScore: number // 1-10
  warnings: string[]
}

// AI prediction result
export interface FundingRatePrediction {
  symbol: string
  exchange: Exchange
  currentRate: number
  predictedRate: number
  confidence: number // 0-1
  trend: 'UP' | 'DOWN' | 'STABLE'
  anomalyDetected: boolean
  recommendation: 'ENTER' | 'WAIT' | 'EXIT'
  analysis: string
  predictedAt: Date
}

// Dashboard stats
export interface DashboardStats {
  totalOpportunities: number
  bestAnnualizedReturn: number
  avgFundingRate: number
  nextFundingIn: number // seconds
  activePositions: number
  totalPnL: number
}

// Alert types
export type AlertType = 'FUNDING_SPIKE' | 'FLIP_WARNING' | 'ARB_OPPORTUNITY'

export interface Alert {
  id: string
  userId: string
  type: AlertType
  symbol: string
  exchange: Exchange
  message: string
  threshold: number | null
  triggered: boolean
  createdAt: Date
  triggeredAt: Date | null
}

// User position
export interface Position {
  id: string
  userId: string
  symbol: string
  exchange: string
  side: 'LONG_SPOT_SHORT_PERP' | 'SHORT_SPOT_LONG_PERP'
  spotEntryPrice: number
  perpEntryPrice: number
  positionSize: number
  fundingEarned: number
  totalFeesPaid: number
  pnl: number
  status: 'OPEN' | 'CLOSED'
  openedAt: Date
  closedAt: Date | null
}

// Funding rate history point
export interface FundingRateHistoryPoint {
  symbol: string
  exchange: Exchange
  fundingRate: number
  timestamp: Date
}

// User settings
export interface UserSettings {
  id: string
  userId: string
  defaultCapital: number
  riskTolerance: number
  preferredExchanges: string
  alertEmail: boolean
  alertPush: boolean
}

// API response wrapper
export interface ApiResponse<T> {
  data?: T
  error?: string
  timestamp: string
}

// Exchange fee config
export interface ExchangeFees {
  exchange: Exchange
  spotMaker: number
  spotTaker: number
  perpMaker: number
  perpTaker: number
}

export const EXCHANGE_FEES: Record<Exchange, ExchangeFees> = {
  OKX: {
    exchange: 'OKX',
    spotMaker: 0.0008,
    spotTaker: 0.001,
    perpMaker: 0.0002,
    perpTaker: 0.0005,
  },
  BINANCE: {
    exchange: 'BINANCE',
    spotMaker: 0.001,
    spotTaker: 0.001,
    perpMaker: 0.0002,
    perpTaker: 0.0004,
  },
  BYBIT: {
    exchange: 'BYBIT',
    spotMaker: 0.001,
    spotTaker: 0.001,
    perpMaker: 0.0001,
    perpTaker: 0.0006,
  },
}

// Funding period (every 8 hours)
export const FUNDING_PERIODS_PER_DAY = 3
export const FUNDING_PERIODS_PER_YEAR = FUNDING_PERIODS_PER_DAY * 365

// ── EDGE VALIDATION TYPES ─────────────────────────────────────

export interface PersistenceStats {
  totalDetected: number
  alive30s: number
  alive1m: number
  alive5m: number
  alive30m: number
  percentages: {
    at30s: number
    at1m: number
    at5m: number
    at30m: number
  }
}

export interface FundingAccuracyStats {
  totalPredictions: number
  meanAbsoluteError: number
  withinThreshold: number
  bestPairs: { symbol: string; mae: number }[]
  worstPairs: { symbol: string; mae: number }[]
}

export interface PaperTradingStats {
  totalTrades: number
  openTrades: number
  closedTrades: number
  winRate: number
  avgWin: number
  avgLoss: number
  totalPnl: number
  sharpeRatio: number | null
  maxDrawdown: number
  profitFactor: number
  equityCurve: { date: string; equity: number }[]
}

export interface EdgeDecayAnalysis {
  trend: 'growing' | 'stable' | 'decaying'
  slope: number
  r2: number
  daysAnalyzed: number
}

export interface PairRanking {
  rank: number
  symbol: string
  avgEdge: number
  persistence1m: number
  winRate: number
  score: number
}

export type GoNoGoVerdict = 'GO' | 'CAUTION' | 'NO_GO' | 'COLLECTING'

export interface GoNoGoReport {
  verdict: GoNoGoVerdict
  daysCollected: number
  daysRequired: number
  criteria: {
    name: string
    threshold: string
    actual: string
    passed: boolean
  }[]
  recommendation: string
}

export interface ValidationDashboardData {
  persistence: PersistenceStats
  fundingAccuracy: FundingAccuracyStats
  paperTrading: PaperTradingStats
  edgeDecay: EdgeDecayAnalysis
  topPairs: PairRanking[]
  goNoGo: GoNoGoReport
  schedulerStatus: {
    running: boolean
    snapshotsToday: number
    lastSnapshot: string
  }
}
