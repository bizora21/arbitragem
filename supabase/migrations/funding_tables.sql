-- ============================================================
-- FUNDING CORE TABLES
-- Correr no SQL Editor do Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS "FundingRateSnapshot" (
  "id"              TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "symbol"          TEXT        NOT NULL,
  "exchange"        TEXT        NOT NULL,
  "fundingRate"     DOUBLE PRECISION NOT NULL,
  "markPrice"       DOUBLE PRECISION,
  "indexPrice"      DOUBLE PRECISION,
  "nextFundingTime" TIMESTAMPTZ,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "FundingRateSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FundingRateSnapshot_symbol_exchange_idx" ON "FundingRateSnapshot"("symbol", "exchange");
CREATE INDEX IF NOT EXISTS "FundingRateSnapshot_createdAt_idx"       ON "FundingRateSnapshot"("createdAt");

CREATE TABLE IF NOT EXISTS "Opportunity" (
  "id"                 TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "symbol"             TEXT        NOT NULL,
  "buyExchange"        TEXT        NOT NULL,
  "sellExchange"       TEXT        NOT NULL,
  "fundingRateDiff"    DOUBLE PRECISION NOT NULL,
  "annualizedReturn"   DOUBLE PRECISION NOT NULL,
  "riskScore"          INTEGER     NOT NULL,
  "netProfitPerPeriod" DOUBLE PRECISION NOT NULL,
  "positionSizeUSD"    DOUBLE PRECISION NOT NULL,
  "status"             TEXT        NOT NULL DEFAULT 'ACTIVE',
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "closedAt"           TIMESTAMPTZ,
  CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Opportunity_status_idx"          ON "Opportunity"("status");
CREATE INDEX IF NOT EXISTS "Opportunity_annualizedReturn_idx" ON "Opportunity"("annualizedReturn");

CREATE TABLE IF NOT EXISTS "FundingRateHistory" (
  "id"          TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "symbol"      TEXT        NOT NULL,
  "exchange"    TEXT        NOT NULL,
  "fundingRate" DOUBLE PRECISION NOT NULL,
  "timestamp"   TIMESTAMPTZ NOT NULL,
  CONSTRAINT "FundingRateHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FundingRateHistory_symbol_exchange_timestamp_idx"
  ON "FundingRateHistory"("symbol", "exchange", "timestamp");
