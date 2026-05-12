-- ============================================================
-- DEX ARBITRAGE — 4 novas tabelas
-- Correr no SQL Editor do Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS "DEXPriceSnapshot" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "timestamp"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "chain"         TEXT NOT NULL,
  "dexName"       TEXT NOT NULL,
  "tokenA"        TEXT NOT NULL,
  "tokenB"        TEXT NOT NULL,
  "priceAtoB"     DOUBLE PRECISION NOT NULL,
  "priceBtoA"     DOUBLE PRECISION NOT NULL,
  "liquidityUSD"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "slippage100"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "slippage1000"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "feeTier"       DOUBLE PRECISION NOT NULL,
  "amountIn"      DOUBLE PRECISION NOT NULL,
  "amountOut"     DOUBLE PRECISION NOT NULL,
  CONSTRAINT "DEXPriceSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DEXPriceSnapshot_chain_dex_ts_idx"    ON "DEXPriceSnapshot"("chain","dexName","timestamp");
CREATE INDEX IF NOT EXISTS "DEXPriceSnapshot_tokenPair_chain_idx" ON "DEXPriceSnapshot"("tokenA","tokenB","chain","timestamp");

CREATE TABLE IF NOT EXISTS "DEXArbitrageOpportunity" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "tokenPair"       TEXT NOT NULL,
  "chain"           TEXT NOT NULL,
  "dexA"            TEXT NOT NULL,
  "dexB"            TEXT NOT NULL,
  "priceA"          DOUBLE PRECISION NOT NULL,
  "priceB"          DOUBLE PRECISION NOT NULL,
  "spreadPct"       DOUBLE PRECISION NOT NULL,
  "gasCostUSD"      DOUBLE PRECISION NOT NULL,
  "slippageEst"     DOUBLE PRECISION NOT NULL,
  "totalCostPct"    DOUBLE PRECISION NOT NULL,
  "edgeNet"         DOUBLE PRECISION NOT NULL,
  "profitUSD100"    DOUBLE PRECISION NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'PENDING',
  "reason"          TEXT,
  CONSTRAINT "DEXArbitrageOpportunity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DEXArbitrageOpportunity_createdAt_idx" ON "DEXArbitrageOpportunity"("createdAt","status");
CREATE INDEX IF NOT EXISTS "DEXArbitrageOpportunity_edge_idx"       ON "DEXArbitrageOpportunity"("edgeNet" DESC);

CREATE TABLE IF NOT EXISTS "DEXExecution" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "opportunityId"   TEXT NOT NULL,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completedAt"     TIMESTAMPTZ,
  "tokenPair"       TEXT NOT NULL,
  "chain"           TEXT NOT NULL,
  "dexA"            TEXT NOT NULL,
  "dexB"            TEXT NOT NULL,
  "amountUSD"       DOUBLE PRECISION NOT NULL,
  "txHashA"         TEXT,
  "txHashB"         TEXT,
  "gasUsedUSD"      DOUBLE PRECISION,
  "slippageReal"    DOUBLE PRECISION,
  "pnlGross"        DOUBLE PRECISION,
  "pnlNet"          DOUBLE PRECISION,
  "roiPct"          DOUBLE PRECISION,
  "status"          TEXT NOT NULL DEFAULT 'PENDING',
  "errorMsg"        TEXT,
  CONSTRAINT "DEXExecution_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DEXExecution_createdAt_status_idx" ON "DEXExecution"("createdAt","status");

CREATE TABLE IF NOT EXISTS "DEXDailyMetrics" (
  "id"                    TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "date"                  TIMESTAMPTZ NOT NULL,
  "opportunitiesDetected" INTEGER NOT NULL DEFAULT 0,
  "opportunitiesExecuted" INTEGER NOT NULL DEFAULT 0,
  "tradeSuccessful"       INTEGER NOT NULL DEFAULT 0,
  "tradeFailed"           INTEGER NOT NULL DEFAULT 0,
  "pnlTotal"              DOUBLE PRECISION NOT NULL DEFAULT 0,
  "pnlGasTotal"           DOUBLE PRECISION NOT NULL DEFAULT 0,
  "pnlLiquido"            DOUBLE PRECISION NOT NULL DEFAULT 0,
  "winRate"               DOUBLE PRECISION NOT NULL DEFAULT 0,
  "avgEdgeReal"           DOUBLE PRECISION NOT NULL DEFAULT 0,
  "topTokenPair"          TEXT,
  "topDex"                TEXT,
  "topChain"              TEXT,
  CONSTRAINT "DEXDailyMetrics_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DEXDailyMetrics_date_unique" UNIQUE ("date")
);
