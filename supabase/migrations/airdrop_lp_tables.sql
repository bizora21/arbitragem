-- ============================================================
-- AIRDROP TRACKER + LP SCANNER — novas tabelas
-- Correr no SQL Editor do Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS "AirdropCandidate" (
  "id"                TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "protocol"          TEXT        NOT NULL,
  "chain"             TEXT        NOT NULL,
  "tvlUsd"            DOUBLE PRECISION,
  "hasToken"          BOOLEAN     NOT NULL DEFAULT false,
  "tier"              TEXT        NOT NULL DEFAULT 'C',
  "confidenceScore"   DOUBLE PRECISION DEFAULT 50,
  "estimatedValueMin" DOUBLE PRECISION DEFAULT 0,
  "estimatedValueMax" DOUBLE PRECISION DEFAULT 0,
  "probability"       DOUBLE PRECISION DEFAULT 0.3,
  "category"          TEXT,
  "website"           TEXT,
  "twitter"           TEXT,
  "aiAnalysis"        TEXT,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("id"),
  UNIQUE ("protocol", "chain")
);
CREATE INDEX IF NOT EXISTS "AirdropCandidate_tier_tvl_idx" ON "AirdropCandidate"("tier", "tvlUsd" DESC);
ALTER TABLE "AirdropCandidate" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "AirdropCandidate service role" ON "AirdropCandidate";
CREATE POLICY "AirdropCandidate service role"
  ON "AirdropCandidate" FOR ALL USING (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS "LPPool" (
  "id"          TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "protocol"    TEXT        NOT NULL,
  "chain"       TEXT        NOT NULL,
  "pair"        TEXT        NOT NULL,
  "tvlUsd"      DOUBLE PRECISION,
  "feeAPY"      DOUBLE PRECISION,
  "emissionAPY" DOUBLE PRECISION,
  "realAPY"     DOUBLE PRECISION,
  "volume24h"   DOUBLE PRECISION,
  "rewardToken" TEXT,
  "poolId"      TEXT,
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("id"),
  UNIQUE ("protocol", "chain", "pair")
);
CREATE INDEX IF NOT EXISTS "LPPool_chain_realAPY_idx" ON "LPPool"("chain", "realAPY" DESC);
ALTER TABLE "LPPool" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "LPPool service role" ON "LPPool";
CREATE POLICY "LPPool service role"
  ON "LPPool" FOR ALL USING (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS "AirdropClaim" (
  "id"                TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "candidateId"       TEXT        NOT NULL,
  "walletAddress"     TEXT        NOT NULL,
  "tokenSymbol"       TEXT,
  "amount"            DOUBLE PRECISION,
  "valueUsd"          DOUBLE PRECISION,
  "claimedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "verified"          BOOLEAN     NOT NULL DEFAULT false,
  "verificationScore" DOUBLE PRECISION,
  PRIMARY KEY ("id")
);
ALTER TABLE "AirdropClaim" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "AirdropClaim service role" ON "AirdropClaim";
CREATE POLICY "AirdropClaim service role"
  ON "AirdropClaim" FOR ALL USING (auth.role() = 'service_role');
