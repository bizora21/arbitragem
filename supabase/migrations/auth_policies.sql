-- ============================================================
-- RLS (Row Level Security) — dados privados por utilizador
-- Correr manualmente no SQL Editor do Supabase
-- ============================================================

-- Activar RLS nas tabelas privadas
ALTER TABLE "Position"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Alert"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserSettings" ENABLE ROW LEVEL SECURITY;

-- Tabelas públicas (leitura de mercado) — sem RLS necessário
-- FundingRateSnapshot, Opportunity, FundingRateHistory

-- ── Policies para Position ────────────────────────────────────
DROP POLICY IF EXISTS "users_own_positions" ON "Position";
CREATE POLICY "users_own_positions" ON "Position"
  FOR ALL
  USING      (auth.uid()::text = "userId")
  WITH CHECK (auth.uid()::text = "userId");

-- ── Policies para Alert ───────────────────────────────────────
DROP POLICY IF EXISTS "users_own_alerts" ON "Alert";
CREATE POLICY "users_own_alerts" ON "Alert"
  FOR ALL
  USING      (auth.uid()::text = "userId")
  WITH CHECK (auth.uid()::text = "userId");

-- ── Policies para UserSettings ────────────────────────────────
DROP POLICY IF EXISTS "users_own_settings" ON "UserSettings";
CREATE POLICY "users_own_settings" ON "UserSettings"
  FOR ALL
  USING      (auth.uid()::text = "userId")
  WITH CHECK (auth.uid()::text = "userId");
