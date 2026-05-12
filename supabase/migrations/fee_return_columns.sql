-- ============================================================
-- FEE ENGINE + RETURN CALCULATOR — novas colunas
-- Correr no SQL Editor do Supabase
-- ============================================================

-- Opportunity
ALTER TABLE "Opportunity"
  ADD COLUMN IF NOT EXISTS "feeBreakdown"   TEXT,
  ADD COLUMN IF NOT EXISTS "grossEdge"      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "netEdge"        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "capitalMin"     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "capitalOptimal" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "adjustedReturn" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "grossReturn"    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "decayFactor"    DOUBLE PRECISION;

-- YieldRate
ALTER TABLE "YieldRate"
  ADD COLUMN IF NOT EXISTS "gasCostEstimate"    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "bridgeCostEstimate" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "netAPY"             DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "capitalMin"         DOUBLE PRECISION;

-- CexDexSpread
ALTER TABLE "CexDexSpread"
  ADD COLUMN IF NOT EXISTS "netEdge"        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "grossEdge"      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "feeBreakdown"   TEXT,
  ADD COLUMN IF NOT EXISTS "adjustedReturn" DOUBLE PRECISION;

-- UserSettings
ALTER TABLE "UserSettings"
  ADD COLUMN IF NOT EXISTS "availableCapital" DOUBLE PRECISION NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS "preferredChain"   TEXT             NOT NULL DEFAULT 'Base';

-- DepegEvent
ALTER TABLE "DepegEvent"
  ADD COLUMN IF NOT EXISTS "adjustedReturn" DOUBLE PRECISION;

-- ConfidenceScore (nova tabela)
CREATE TABLE IF NOT EXISTS "ConfidenceScore" (
  "id"         TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "pairKey"    TEXT        NOT NULL,
  "strategy"   TEXT        NOT NULL,
  "score"      DOUBLE PRECISION NOT NULL,
  "level"      TEXT        NOT NULL,
  "sampleSize" INTEGER     NOT NULL DEFAULT 0,
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("id"),
  UNIQUE ("pairKey", "strategy")
);
CREATE INDEX IF NOT EXISTS "ConfidenceScore_strategy_score_idx" ON "ConfidenceScore"("strategy", "score");

ALTER TABLE "ConfidenceScore" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ConfidenceScore service role full access" ON "ConfidenceScore";
CREATE POLICY "ConfidenceScore service role full access"
  ON "ConfidenceScore" FOR ALL USING (auth.role() = 'service_role');
