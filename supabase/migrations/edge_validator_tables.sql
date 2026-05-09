-- ============================================================
-- VALIDADOR DE EDGE — 5 novas tabelas
-- Correr no SQL Editor do Supabase após auth_policies.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS "EdgeSnapshot" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "timestamp"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "symbol"        TEXT NOT NULL,
  "exchangeA"     TEXT NOT NULL,
  "exchangeB"     TEXT NOT NULL,
  "fundingRateA"  DOUBLE PRECISION NOT NULL,
  "fundingRateB"  DOUBLE PRECISION NOT NULL,
  "spreadRaw"     DOUBLE PRECISION NOT NULL,
  "feesEstimated" DOUBLE PRECISION NOT NULL,
  "slippageEst"   DOUBLE PRECISION NOT NULL,
  "edgeNet"       DOUBLE PRECISION NOT NULL,
  "volumeA24h"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "volumeB24h"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  CONSTRAINT "EdgeSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "EdgeSnapshot_symbol_timestamp_idx" ON "EdgeSnapshot"("symbol","timestamp");
CREATE INDEX IF NOT EXISTS "EdgeSnapshot_timestamp_idx"        ON "EdgeSnapshot"("timestamp");

CREATE TABLE IF NOT EXISTS "OpportunityLife" (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "detectedAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "symbol"         TEXT NOT NULL,
  "exchangeA"      TEXT NOT NULL,
  "exchangeB"      TEXT NOT NULL,
  "initialSpread"  DOUBLE PRECISION NOT NULL,
  "spreadAt30s"    DOUBLE PRECISION,
  "spreadAt1m"     DOUBLE PRECISION,
  "spreadAt5m"     DOUBLE PRECISION,
  "spreadAt30m"    DOUBLE PRECISION,
  "alive30s"       BOOLEAN,
  "alive1m"        BOOLEAN,
  "alive5m"        BOOLEAN,
  "alive30m"       BOOLEAN,
  "edgeNetInitial" DOUBLE PRECISION NOT NULL,
  "edgeNetAt5m"    DOUBLE PRECISION,
  "resolved"       BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "OpportunityLife_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OpportunityLife_symbol_detectedAt_idx" ON "OpportunityLife"("symbol","detectedAt");
CREATE INDEX IF NOT EXISTS "OpportunityLife_detectedAt_idx"        ON "OpportunityLife"("detectedAt");

CREATE TABLE IF NOT EXISTS "FundingRealization" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "symbol"          TEXT NOT NULL,
  "exchange"        TEXT NOT NULL,
  "predictedRate"   DOUBLE PRECISION NOT NULL,
  "realizedRate"    DOUBLE PRECISION,
  "predictionTime"  TIMESTAMPTZ NOT NULL,
  "realizationTime" TIMESTAMPTZ,
  "error"           DOUBLE PRECISION,
  "resolved"        BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "FundingRealization_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FundingRealization_symbol_exchange_predictionTime_idx"
  ON "FundingRealization"("symbol","exchange","predictionTime");

CREATE TABLE IF NOT EXISTS "PaperTrade" (
  "id"               TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "openedAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "closedAt"         TIMESTAMPTZ,
  "symbol"           TEXT NOT NULL,
  "exchangeLong"     TEXT NOT NULL,
  "exchangeShort"    TEXT NOT NULL,
  "spreadAtEntry"    DOUBLE PRECISION NOT NULL,
  "spreadAtExit"     DOUBLE PRECISION,
  "edgeNetEntry"     DOUBLE PRECISION NOT NULL,
  "fundingCollected" DOUBLE PRECISION,
  "feesTotal"        DOUBLE PRECISION,
  "pnlGross"         DOUBLE PRECISION,
  "pnlNet"           DOUBLE PRECISION,
  "positionSize"     DOUBLE PRECISION NOT NULL,
  "status"           TEXT NOT NULL DEFAULT 'open',
  "closeReason"      TEXT,
  CONSTRAINT "PaperTrade_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PaperTrade_symbol_openedAt_idx" ON "PaperTrade"("symbol","openedAt");
CREATE INDEX IF NOT EXISTS "PaperTrade_status_idx"          ON "PaperTrade"("status");

CREATE TABLE IF NOT EXISTS "ValidationMetrics" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "date"            TIMESTAMPTZ NOT NULL DEFAULT now(),
  "totalDetected"   INTEGER NOT NULL,
  "aliveAfter30s"   INTEGER NOT NULL,
  "aliveAfter1m"    INTEGER NOT NULL,
  "aliveAfter5m"    INTEGER NOT NULL,
  "avgEdgeTheory"   DOUBLE PRECISION NOT NULL,
  "avgEdgeReal"     DOUBLE PRECISION NOT NULL,
  "fundingAccuracy" DOUBLE PRECISION NOT NULL,
  "paperPnl"        DOUBLE PRECISION NOT NULL,
  "paperWinRate"    DOUBLE PRECISION NOT NULL,
  "paperSharpe"     DOUBLE PRECISION,
  "paperDrawdown"   DOUBLE PRECISION NOT NULL,
  CONSTRAINT "ValidationMetrics_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ValidationMetrics_date_idx" ON "ValidationMetrics"("date");
