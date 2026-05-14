-- ============================================================
-- FLASH LOAN ARBITRAGE — Base Chain
-- Estratégia 1: $0 capital, $0 risco
-- Correr no SQL Editor do Supabase
-- ============================================================

-- Oportunidades detectadas pelo scanner
CREATE TABLE IF NOT EXISTS "FlashLoanOpportunity" (
  "id"                TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "borrowToken"       TEXT NOT NULL,
  "intermediateToken" TEXT NOT NULL,
  "dexBuy"            TEXT NOT NULL,
  "dexSell"           TEXT NOT NULL,
  "spreadPct"         DOUBLE PRECISION NOT NULL,
  "loanAmountUSD"     DOUBLE PRECISION NOT NULL,
  "aaveFeeUSD"        DOUBLE PRECISION NOT NULL,
  "gasCostUSD"        DOUBLE PRECISION NOT NULL,
  "slippageEstPct"    DOUBLE PRECISION NOT NULL,
  "netEdgePct"        DOUBLE PRECISION NOT NULL,
  "netProfitUSD"      DOUBLE PRECISION NOT NULL,
  "confidence"        TEXT NOT NULL DEFAULT 'LOW',
  "status"            TEXT NOT NULL DEFAULT 'DETECTED',
  "reason"            TEXT,
  CONSTRAINT "FlashLoanOpportunity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FlashLoanOpportunity_createdAt_idx"       ON "FlashLoanOpportunity"("createdAt","status");
CREATE INDEX IF NOT EXISTS "FlashLoanOpportunity_netProfitUSD_idx"   ON "FlashLoanOpportunity"("netProfitUSD" DESC);
CREATE INDEX IF NOT EXISTS "FlashLoanOpportunity_borrowToken_idx"     ON "FlashLoanOpportunity"("borrowToken","intermediateToken");

-- Paper trades — simulação de execução flash loan
CREATE TABLE IF NOT EXISTS "FlashLoanPaperTrade" (
  "id"                  TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "detectedAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "expiredAt"           TIMESTAMPTZ,
  "borrowToken"         TEXT NOT NULL,
  "intermediateToken"   TEXT NOT NULL,
  "dexBuy"              TEXT NOT NULL,
  "dexSell"             TEXT NOT NULL,
  "spreadPct"           DOUBLE PRECISION NOT NULL,
  "loanAmountUSD"       DOUBLE PRECISION NOT NULL,
  "netEdgePct"          DOUBLE PRECISION NOT NULL,
  "netProfitUSD"        DOUBLE PRECISION NOT NULL,
  "simulatedProfitUSD"  DOUBLE PRECISION,
  "status"              TEXT NOT NULL DEFAULT 'detected',
  CONSTRAINT "FlashLoanPaperTrade_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FlashLoanPaperTrade_status_idx"    ON "FlashLoanPaperTrade"("status");
CREATE INDEX IF NOT EXISTS "FlashLoanPaperTrade_detectedAt_idx" ON "FlashLoanPaperTrade"("detectedAt");

-- Métricas diárias do flash loan scanner
CREATE TABLE IF NOT EXISTS "FlashLoanDailyMetrics" (
  "id"                      TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "date"                    TIMESTAMPTZ NOT NULL,
  "opportunitiesDetected"   INTEGER NOT NULL DEFAULT 0,
  "profitableDetected"      INTEGER NOT NULL DEFAULT 0,
  "avgNetEdgePct"           DOUBLE PRECISION NOT NULL DEFAULT 0,
  "avgProfitUSD"            DOUBLE PRECISION NOT NULL DEFAULT 0,
  "bestProfitUSD"           DOUBLE PRECISION NOT NULL DEFAULT 0,
  "topPair"                 TEXT,
  "topDexCombo"             TEXT,
  "paperTradesSimulated"    INTEGER NOT NULL DEFAULT 0,
  "paperWinRate"            DOUBLE PRECISION NOT NULL DEFAULT 0,
  CONSTRAINT "FlashLoanDailyMetrics_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FlashLoanDailyMetrics_date_unique" UNIQUE ("date")
);

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE "FlashLoanOpportunity" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "FlashLoanOpportunity select"         ON "FlashLoanOpportunity";
DROP POLICY IF EXISTS "FlashLoanOpportunity insert service" ON "FlashLoanOpportunity";
CREATE POLICY "FlashLoanOpportunity select"         ON "FlashLoanOpportunity" FOR SELECT USING (true);
CREATE POLICY "FlashLoanOpportunity insert service" ON "FlashLoanOpportunity" FOR INSERT WITH CHECK (true);

ALTER TABLE "FlashLoanPaperTrade" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "FlashLoanPaperTrade select"         ON "FlashLoanPaperTrade";
DROP POLICY IF EXISTS "FlashLoanPaperTrade insert service" ON "FlashLoanPaperTrade";
CREATE POLICY "FlashLoanPaperTrade select"         ON "FlashLoanPaperTrade" FOR SELECT USING (true);
CREATE POLICY "FlashLoanPaperTrade insert service" ON "FlashLoanPaperTrade" FOR INSERT WITH CHECK (true);

ALTER TABLE "FlashLoanDailyMetrics" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "FlashLoanDailyMetrics select"         ON "FlashLoanDailyMetrics";
DROP POLICY IF EXISTS "FlashLoanDailyMetrics insert service" ON "FlashLoanDailyMetrics";
CREATE POLICY "FlashLoanDailyMetrics select"         ON "FlashLoanDailyMetrics" FOR SELECT USING (true);
CREATE POLICY "FlashLoanDailyMetrics insert service" ON "FlashLoanDailyMetrics" FOR INSERT WITH CHECK (true);

-- ============================================================
-- Cleanup automático (opcional) — manter só últimas 72h
-- ============================================================
-- CREATE OR REPLACE FUNCTION cleanup_flash_loan_data()
-- RETURNS void LANGUAGE sql AS $$
--   DELETE FROM "FlashLoanOpportunity" WHERE "createdAt" < now() - interval '72 hours';
--   DELETE FROM "FlashLoanPaperTrade"  WHERE "detectedAt" < now() - interval '72 hours' AND "status" = 'expired';
-- $$;
