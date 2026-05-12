# GitHub Actions — Colecta Automática de Snapshots

Recolhe funding rates de OKX, Binance e Bybit a cada 5 minutos, 24/7, sem precisar
de manter o computador ligado. Gratuito até 2000 minutos/mês (plano Free do GitHub).

---

## 1. Criar repositório no GitHub

```bash
git init
git remote add origin https://github.com/SEU_USERNAME/arbitragem.git
git add .
git commit -m "feat: edge validator with GitHub Actions"
git push -u origin main
```

---

## 2. Configurar GitHub Secrets

**GitHub → repositório → Settings → Secrets and variables → Actions → New repository secret**

Adicionar estes 2 secrets (são os únicos necessários para o script):

| Secret | Valor |
|--------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://kfcrzjftcymdyqhecmwl.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...` (service role key do Supabase) |

> Os restantes secrets (OPENAI, DATABASE_URL, etc.) não são necessários para o script
> de colecta — só o Supabase é usado.

---

## 3. Verificar que o workflow está activo

1. Vai ao separador **Actions** no repositório
2. Deves ver "Collect Funding Snapshots" na lista
3. Clica → **Run workflow** → **Run workflow** (teste manual)
4. Abre a execução e verifica os logs

Logs de sucesso esperados:
```
[2026-05-09T10:00:01.234Z] ━━━ Colecta de Snapshot Iniciada ━━━
📡 A buscar funding rates (Binance + OKX + Bybit)...
✅ 312 snapshots gravados | 47 com edge positivo
🔍 A verificar novas oportunidades...
✅ 3 novas oportunidades em tracking
⏱️  A verificar persistência...
✅ 8 oportunidades actualizadas
✅ Concluído em 4823ms
```

---

## 4. Verificar dados no Supabase

**Supabase → Table Editor → EdgeSnapshot**

Após 5 minutos deves ver as primeiras linhas. Após 24h tens ~288 snapshots.

---

## 5. Monitorizar

- **Actions tab** → vê histórico de todas as execuções
- **Supabase → Logs** → vê queries em tempo real
- **Dashboard Validação** (localhost:3000) → mostra dados recolhidos

---

## 6. Pausar / Retomar

Para pausar: **Actions → Collect Funding Snapshots → ⋯ → Disable workflow**

Para retomar: **Enable workflow**

---

## Limitações conhecidas

| Limitação | Detalhe |
|-----------|---------|
| Intervalo mínimo | 5 min (GitHub não suporta < 5 min) |
| Latência | +10-30s entre trigger e execução real |
| Quota Free | 2000 min/mês ≈ 66 min/dia — **insuficiente para 5 em 5 min** |
| Quota necessária | ~288 runs × 1 min/run = 288 min/dia × 30 = 8640 min/mês |

### Solução para a quota

O plano Free (2000 min/mês) **não chega** para runs de 5 em 5 minutos.
Opções:

1. **GitHub Pro** ($4/mês) — 3000 min/mês — também não chega
2. **GitHub Team** ($4/user/mês) — 3000 min/mês
3. **Self-hosted runner** (gratuito, corre no teu PC quando ligado)
4. **VPS** (€3-5/mês, Railway, Render, Fly.io) — **recomendado para produção**

### Alternativa recomendada: Self-hosted runner

Se tens o PC ligado durante o dia, um self-hosted runner é gratuito e sem limite:

```bash
# No teu PC:
# GitHub → Settings → Actions → Runners → New self-hosted runner
# Seguir as instruções para Windows
```

### Alternativa para VPS (pós-validação)

Quando o GO/NO-GO der GO, migra para um VPS com cron de 30 segundos:

```bash
# crontab -e
*/1 * * * * /usr/bin/node /app/scripts/github-actions/collect-snapshot.mjs >> /var/log/snapshot.log 2>&1
```

---

## Troubleshooting

**"Error: Cannot find package '@supabase/supabase-js'"**
→ O `npm ci` não correu. Verifica se `package.json` tem `@supabase/supabase-js` nas dependências.

**"❌ Faltam variáveis de ambiente"**
→ Os secrets não estão configurados. Vai ao passo 2.

**"Supabase insert falhou: relation EdgeSnapshot does not exist"**
→ As tabelas não foram criadas. Corre o SQL em `supabase/migrations/edge_validator_tables.sql` no SQL Editor do Supabase.

**Workflow não aparece na tab Actions**
→ O ficheiro `.github/workflows/collect-snapshots.yml` tem de estar no branch `main` (ou `master`).
