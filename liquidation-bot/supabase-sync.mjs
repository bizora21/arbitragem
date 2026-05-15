/**
 * Supabase sync for the Aave V3 Liquidation Bot.
 * Uses raw fetch (no SDK) to push state after each cycle.
 */

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY

function supaHeaders(extra = {}) {
  return {
    'Content-Type':  'application/json',
    'apikey':        SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    ...extra,
  }
}

// Generic REST call — throws on HTTP error
async function supaRequest(path, method, body, queryString = '') {
  const url = `${SUPABASE_URL}/rest/v1/${path}${queryString}`
  const res  = await fetch(url, {
    method,
    headers: supaHeaders({ Prefer: 'return=minimal,resolution=merge-duplicates' }),
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => String(res.status))
    throw new Error(`Supabase ${method} ${path}: ${text.slice(0, 200)}`)
  }
  return res.status === 204 ? null : res.json()
}

// Safe JSON conversion — BigInt → string
function safe(v) {
  return JSON.parse(JSON.stringify(v, (_, val) =>
    typeof val === 'bigint' ? val.toString() : val
  ))
}

function watchlistStatus(hf) {
  if (hf < 1.0)  return 'liquidatable'
  if (hf < 1.1)  return 'hot'
  return 'watching'
}

// ── Main sync function ────────────────────────────────────────────────────────

export async function syncToSupabase(state, ethPrice) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_KEY not set')
  }

  const watchlist = state.watchlist || {}
  const borrowers = state.borrowers || {}
  const stats     = state.stats     || {}

  const now = new Date().toISOString()

  // ── 1. Upsert aave_bot_stats (single row, id = 1) ────────────────────────
  const watchValues   = Object.values(watchlist)
  const hotCount      = watchValues.filter(w => w.hf < 1.1 && w.hf >= 1.0).length
  const liquidatable  = watchValues.filter(w => w.hf < 1.0).length
  const totalDebt     = watchValues.reduce((s, w) => s + (w.debt || 0), 0)

  await supaRequest('aave_bot_stats', 'POST', [{
    id:                 1,
    total_borrowers:    Object.keys(borrowers).length,
    watchlist_count:    watchValues.length,
    hot_count:          hotCount,
    liquidatable_count: liquidatable,
    total_debt_at_risk: Math.round(totalDebt * 100) / 100,
    eth_price:          Math.round(ethPrice * 100) / 100,
    simulations:        stats.simulated   || 0,
    executions:         stats.executed    || 0,
    total_profit_usd:   Math.round((stats.profit || 0) * 100) / 100,
    last_block:         state.lastIndexedBlock || 0,
    updated_at:         now,
  }])

  // ── 2. Upsert aave_watchlist ──────────────────────────────────────────────
  if (watchValues.length > 0) {
    const rows = Object.entries(watchlist).map(([address, w]) => ({
      address,
      health_factor:   Math.round((w.hf  || 0) * 10000) / 10000,
      debt_usd:        Math.round((w.debt || 0) * 100)   / 100,
      collateral_usd:  Math.round((w.col  || 0) * 100)   / 100,
      priority:        Math.round((w.priority || 0) * 100) / 100,
      status:          watchlistStatus(w.hf || 999),
      updated_at:      now,
    }))

    // Upsert in batches of 50
    for (let i = 0; i < rows.length; i += 50) {
      await supaRequest('aave_watchlist', 'POST', rows.slice(i, i + 50))
    }
  }

  // ── 3. Upsert aave_positions (per reserve per address) ───────────────────
  const posRows = []
  for (const [address, w] of Object.entries(watchlist)) {
    for (const p of (w.positions || [])) {
      posRows.push({
        address,
        reserve:           p.reserve   || 'UNKNOWN',
        collateral_amount: safe(p.collateral  || 0),
        collateral_usd:    Math.round((p.collateralUsd || 0) * 100) / 100,
        debt_amount:       safe(p.debt         || 0),
        debt_usd:          Math.round((p.debtUsd      || 0) * 100) / 100,
        updated_at:        now,
      })
    }
  }
  if (posRows.length > 0) {
    for (let i = 0; i < posRows.length; i += 50) {
      await supaRequest('aave_positions', 'POST', posRows.slice(i, i + 50))
    }
  }

  // ── 4. Create alerts for critical / warning positions ────────────────────
  const alertRows = []
  for (const [address, w] of Object.entries(watchlist)) {
    const hf = w.hf || 999
    if (hf < 1.0) {
      alertRows.push({
        type:         'liquidatable',
        message:      `HF ${hf.toFixed(4)} — liquidatable now! Debt: $${(w.debt || 0).toFixed(0)}`,
        address,
        health_factor: Math.round(hf * 10000) / 10000,
        severity:      'critical',
        created_at:    now,
      })
    } else if (hf < 1.05) {
      alertRows.push({
        type:         'warning',
        message:      `HF ${hf.toFixed(4)} — approaching liquidation. Debt: $${(w.debt || 0).toFixed(0)}`,
        address,
        health_factor: Math.round(hf * 10000) / 10000,
        severity:      'warning',
        created_at:    now,
      })
    }
  }
  if (alertRows.length > 0) {
    await supaRequest('aave_alerts', 'POST', alertRows,
      // Don't upsert — INSERT only (alerts are append-only log)
    )
  }

  // ── 5. Remove stale watchlist entries from Supabase ──────────────────────
  const activeAddrs = Object.keys(watchlist)
  if (activeAddrs.length > 0) {
    // Delete rows whose address is NOT in the current watchlist
    const encoded = activeAddrs.map(a => encodeURIComponent(a)).join(',')
    await supaRequest(
      'aave_watchlist',
      'DELETE',
      undefined,
      `?address=not.in.(${encoded})`,
    )
  } else {
    // Watchlist is empty — clear all
    await supaRequest('aave_watchlist', 'DELETE', undefined, '?id=gte.0')
  }
}

// ── Log a completed liquidation ───────────────────────────────────────────────

export async function logLiquidation(params, txHash, status) {
  if (!SUPABASE_URL || !SERVICE_KEY) return

  try {
    await supaRequest('aave_liquidations', 'POST', [{
      user_address:         params.user,
      collateral_symbol:    params.collateralSymbol || '',
      debt_symbol:          params.debtSymbol       || '',
      debt_covered:         params.debtPaid          || 0,
      collateral_received:  params.colReceived       || 0,
      profit_usd:           Math.round((params.estimatedProfitUsd || 0) * 100) / 100,
      tx_hash:              txHash,
      status,
      created_at:           new Date().toISOString(),
    }], '?on_conflict=tx_hash')
  } catch (e) {
    // Non-fatal — don't crash the bot on log failure
    console.log('  [Supabase] logLiquidation error: ' + e.message?.slice(0, 80))
  }
}
