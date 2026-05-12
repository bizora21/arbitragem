-- StrategyAlert: persists auto-detected alerts from all 4 strategies
-- Run this after multi_strategy_tables.sql

CREATE TABLE IF NOT EXISTS "StrategyAlert" (
  "id"         TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "strategy"   TEXT        NOT NULL, -- FUNDING | DEPEG | YIELD | SPREAD
  "priority"   TEXT        NOT NULL, -- URGENT | HIGH | MEDIUM | LOW
  "title"      TEXT        NOT NULL,
  "detail"     TEXT        NOT NULL,
  "value"      TEXT,
  "isActive"   BOOLEAN     NOT NULL DEFAULT TRUE,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "resolvedAt" TIMESTAMPTZ,
  PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StrategyAlert_strategy_isActive_idx" ON "StrategyAlert"("strategy", "isActive");
CREATE INDEX IF NOT EXISTS "StrategyAlert_priority_isActive_idx" ON "StrategyAlert"("priority", "isActive");
CREATE INDEX IF NOT EXISTS "StrategyAlert_createdAt_idx"          ON "StrategyAlert"("createdAt");

ALTER TABLE "StrategyAlert" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "StrategyAlert service role full access" ON "StrategyAlert";
CREATE POLICY "StrategyAlert service role full access"
  ON "StrategyAlert"
  FOR ALL
  USING (auth.role() = 'service_role');
