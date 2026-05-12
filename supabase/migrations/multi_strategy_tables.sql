-- ============================================================
-- MULTI-STRATEGY SURVIVAL SCANNER — 3 novas tabelas
-- Correr no SQL Editor do Supabase
-- ============================================================

-- Estratégia 2: Stablecoin Depeg Detector
CREATE TABLE IF NOT EXISTS "DepegEvent" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "stablecoin"   TEXT NOT NULL,
  "exchange"     TEXT NOT NULL,
  "price"        DOUBLE PRECISION NOT NULL,
  "deviationPct" DOUBLE PRECISION NOT NULL,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "detectedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "resolvedAt"   TIMESTAMPTZ,
  CONSTRAINT "DepegEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DepegEvent_stablecoin_isActive_idx" ON "DepegEvent"("stablecoin", "isActive");
CREATE INDEX IF NOT EXISTS "DepegEvent_detectedAt_idx"           ON "DepegEvent"("detectedAt");

-- Estratégia 3: Yield Farming Rotation
CREATE TABLE IF NOT EXISTS "YieldRate" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "protocol"  TEXT NOT NULL,
  "chain"     TEXT NOT NULL,
  "asset"     TEXT NOT NULL,
  "apy"       DOUBLE PRECISION NOT NULL,
  "tvl"       DOUBLE PRECISION,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "YieldRate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "YieldRate_protocol_chain_asset_idx" ON "YieldRate"("protocol", "chain", "asset");
CREATE INDEX IF NOT EXISTS "YieldRate_createdAt_idx"            ON "YieldRate"("createdAt");

-- Estratégia 4: CEX-DEX Spread Monitor
CREATE TABLE IF NOT EXISTS "CexDexSpread" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "symbol"    TEXT NOT NULL,
  "cexName"   TEXT NOT NULL,
  "cexPrice"  DOUBLE PRECISION NOT NULL,
  "dexName"   TEXT NOT NULL,
  "dexPrice"  DOUBLE PRECISION NOT NULL,
  "spreadPct" DOUBLE PRECISION NOT NULL,
  "direction" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "CexDexSpread_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CexDexSpread_symbol_spreadPct_idx" ON "CexDexSpread"("symbol", "spreadPct" DESC);
CREATE INDEX IF NOT EXISTS "CexDexSpread_createdAt_idx"        ON "CexDexSpread"("createdAt");

-- ============================================================
-- RLS Policies (ajustar conforme o teu setup de auth)
-- ============================================================

-- DepegEvent: leitura pública, escrita via service role
ALTER TABLE "DepegEvent" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "DepegEvent select"         ON "DepegEvent";
DROP POLICY IF EXISTS "DepegEvent insert service" ON "DepegEvent";
CREATE POLICY "DepegEvent select"         ON "DepegEvent" FOR SELECT USING (true);
CREATE POLICY "DepegEvent insert service" ON "DepegEvent" FOR INSERT WITH CHECK (true);

-- YieldRate: leitura pública, escrita via service role
ALTER TABLE "YieldRate" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "YieldRate select"         ON "YieldRate";
DROP POLICY IF EXISTS "YieldRate insert service" ON "YieldRate";
CREATE POLICY "YieldRate select"         ON "YieldRate" FOR SELECT USING (true);
CREATE POLICY "YieldRate insert service" ON "YieldRate" FOR INSERT WITH CHECK (true);

-- CexDexSpread: leitura pública, escrita via service role
ALTER TABLE "CexDexSpread" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "CexDexSpread select"         ON "CexDexSpread";
DROP POLICY IF EXISTS "CexDexSpread insert service" ON "CexDexSpread";
CREATE POLICY "CexDexSpread select"         ON "CexDexSpread" FOR SELECT USING (true);
CREATE POLICY "CexDexSpread insert service" ON "CexDexSpread" FOR INSERT WITH CHECK (true);

-- ============================================================
-- Cleanup automático (opcional) — manter só últimas 48h
-- ============================================================
-- CREATE OR REPLACE FUNCTION cleanup_old_strategy_data()
-- RETURNS void LANGUAGE sql AS $$
--   DELETE FROM "DepegEvent"  WHERE "detectedAt"  < now() - interval '48 hours' AND "isActive" = false;
--   DELETE FROM "YieldRate"   WHERE "createdAt"   < now() - interval '48 hours';
--   DELETE FROM "CexDexSpread" WHERE "createdAt"  < now() - interval '48 hours';
-- $$;
