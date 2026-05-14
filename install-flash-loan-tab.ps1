# ============================================================
# INSTALL FLASH LOAN TAB — PowerShell Script
# Execute na pasta E:\arbitragem
# ============================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Instalacao da aba Flash Loan Arbitrage" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ----------------------------------------------------------
# PASSO 1: Criar flash-loan-tab.tsx
# ----------------------------------------------------------
Write-Host "[1/5] Criando src\components\dashboard\flash-loan-tab.tsx ..." -ForegroundColor Yellow

$tabContent = @'
'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, AlertCircle, AlertTriangle, CheckCircle2, Zap, ArrowRightLeft } from 'lucide-react'
import { StrategyValidationPanel } from './strategy-validation-panel'

interface FlashLoanOpportunity {
  id: string
  pair: string
  buyDex: string
  sellDex: string
  grossSpreadBp: number
  aaveFeeBp: number
  gasCostUsd: number
  slippageBp: number
  dexFeesBp: number
  netEdgeBp: number
  capital: number
  estimatedProfitUsd: number
  chain: string
  timestamp: string
}

interface FlashLoanResult {
  opportunities?: FlashLoanOpportunity[]
  scannedAt?: string
  totalScanned?: number
  profitableCount?: number
  bestEdgeBp?: number
  error?: string
}

function EdgeBadge({ bp }: { bp: number }) {
  const color =
    bp >= 10 ? 'text-emerald-400 bg-emerald-400/10 border-emerald-500/30' :
    bp >= 5  ? 'text-yellow-400 bg-yellow-400/10 border-yellow-500/30' :
    bp >= 1  ? 'text-orange-400 bg-orange-400/10 border-orange-500/30' :
    'text-slate-400 bg-slate-400/10 border-slate-500/30'
  return (
    <span className={`font-mono text-xs px-2 py-0.5 rounded-full border ${color}`}>
      {bp > 0 ? '+' : ''}{bp.toFixed(1)} bp
    </span>
  )
}

function ProfitBadge({ usd }: { usd: number }) {
  const color =
    usd >= 50  ? 'text-emerald-400' :
    usd >= 10  ? 'text-yellow-400' :
    usd >= 1   ? 'text-orange-400' :
    'text-slate-400'
  return (
    <span className={`font-mono text-sm font-bold ${color}`}>
      ${usd.toFixed(2)}
    </span>
  )
}

function DexBadge({ name }: { name: string }) {
  const colors: Record<string, string> = {
    'Aerodrome': 'text-purple-400 bg-purple-400/10 border-purple-500/30',
    'BaseSwap': 'text-blue-400 bg-blue-400/10 border-blue-500/30',
    'Uniswap V3': 'text-pink-400 bg-pink-400/10 border-pink-500/30',
    'SushiSwap': 'text-orange-400 bg-orange-400/10 border-orange-500/30',
  }
  const c = colors[name] ?? 'text-slate-400 bg-slate-400/10 border-slate-500/30'
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${c}`}>{name}</span>
  )
}

export function FlashLoanTab() {
  const [data, setData] = useState<FlashLoanResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchOpportunities = useCallback(async (isRefresh = false) => {
    if (isRefresh) setScanning(true)
    else setLoading(true)

    try {
      const res = await fetch('/api/flash-loan')
      const json = await res.json()
      setData(json)
    } catch {
      setData({ error: 'Falha ao conectar ao servidor' })
    }

    setLastUpdate(new Date())
    setLoading(false)
    setScanning(false)
  }, [])

  const triggerScan = useCallback(async () => {
    setScanning(true)
    try {
      const res = await fetch('/api/flash-loan', { method: 'POST' })
      const json = await res.json()
      setData(json)
    } catch {
      setData({ error: 'Falha ao iniciar scan' })
    }
    setLastUpdate(new Date())
    setScanning(false)
  }, [])

  useEffect(() => {
    fetchOpportunities()
    const iv = setInterval(() => fetchOpportunities(true), 60_000)
    return () => clearInterval(iv)
  }, [fetchOpportunities])

  const opportunities = data?.opportunities ?? []
  const profitable = opportunities.filter(o => o.netEdgeBp > 0)
  const hasError = !!data?.error

  const totalPotentialProfit = profitable.reduce((sum, o) => sum + o.estimatedProfitUsd, 0)
  const bestEdge = profitable.length > 0 ? Math.max(...profitable.map(o => o.netEdgeBp)) : 0

  return (
    <div className="space-y-6">
      <StrategyValidationPanel
        strategy="FLASH_LOAN"
        label="Flash Loan Arbitrage"
        icon="⚡"
        timestamp={data?.scannedAt ?? null}
        loading={loading}
        error={hasError}
        opportunityCount={profitable.length}
        bestValueLabel={bestEdge > 0 ? `${bestEdge.toFixed(1)} bp edge` : null}
        sources={['Aave V3', 'DexScreener', 'Base Chain']}
        dataSource={data?.scannedAt ? 'DexScreener API' : null}
        alerts={{
          urgent: profitable.filter(o => o.netEdgeBp >= 10).length,
          high: profitable.filter(o => o.netEdgeBp >= 5 && o.netEdgeBp < 10).length,
          medium: profitable.filter(o => o.netEdgeBp >= 1 && o.netEdgeBp < 5).length,
        }}
        dataConfidence={data?.scannedAt ? 'HIGH' : 'LOW'}
      />

      {/* Capital info banner */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-center gap-3">
        <Zap className="w-5 h-5 text-blue-400 flex-shrink-0" />
        <div>
          <p className="text-blue-400 font-semibold text-sm">Capital: $0 · Risco: $0</p>
          <p className="text-blue-300 text-xs mt-0.5">
            Flash Loans na Base chain: empresta do Aave V3, compra e vende em DEXes numa transaccao atomica. Sem capital proprio necessario.
          </p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-500 text-sm">A procurar oportunidades de Flash Loan na Base chain...</p>
            <p className="text-slate-600 text-xs mt-1">DexScreener → Aave V3 → Aerodrome · BaseSwap · Uniswap V3</p>
          </div>
        </div>
      )}

      {!loading && hasError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-semibold">Erro ao recolher dados</p>
            <p className="text-red-300 text-sm mt-1 font-mono">{data?.error}</p>
          </div>
        </div>
      )}

      {!loading && !hasError && (
        <>
          {/* Profitable opportunities alert */}
          {profitable.length > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-emerald-400 font-semibold">
                  {profitable.length} oportunidade{profitable.length > 1 ? 's' : ''} lucrativa{profitable.length > 1 ? 's' : ''} encontrada{profitable.length > 1 ? 's' : ''}
                </p>
                <p className="text-emerald-300 text-sm mt-1">
                  Lucro estimado total: ${totalPotentialProfit.toFixed(2)} · Melhor edge: {bestEdge.toFixed(1)} bp
                </p>
              </div>
            </div>
          )}

          {profitable.length === 0 && opportunities.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-yellow-400 font-semibold">Nenhuma oportunidade lucrativa agora</p>
                <p className="text-yellow-300 text-sm mt-1">
                  {opportunities.length} par{opportunities.length > 1 ? 'es' : ''} escaneado{opportunities.length > 1 ? 's' : ''}, mas o spread nao cobre taxas Aave + gas + slippage. O scanner continua a monitorizar.
                </p>
              </div>
            </div>
          )}

          {/* Stats strip */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Pares escaneados</p>
              <p className="text-2xl font-bold text-slate-200">{data?.totalScanned ?? opportunities.length}</p>
            </div>
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Oportunidades lucrativas</p>
              <p className={`text-2xl font-bold ${profitable.length > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                {profitable.length}
              </p>
            </div>
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Melhor edge liquido</p>
              <p className={`text-2xl font-bold ${bestEdge >= 10 ? 'text-emerald-400' : bestEdge >= 5 ? 'text-yellow-400' : 'text-slate-200'}`}>
                {bestEdge > 0 ? `${bestEdge.toFixed(1)} bp` : '—'}
              </p>
            </div>
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Lucro potencial</p>
              <p className={`text-2xl font-bold ${totalPotentialProfit >= 50 ? 'text-emerald-400' : totalPotentialProfit >= 10 ? 'text-yellow-400' : 'text-slate-200'}`}>
                ${totalPotentialProfit.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Opportunity cards */}
          {profitable.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {profitable.map((opp) => (
                <div key={opp.id} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 hover:border-emerald-500/30 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-slate-200 text-lg">{opp.pair}</h4>
                    <EdgeBadge bp={opp.netEdgeBp} />
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <DexBadge name={opp.buyDex} />
                    <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500" />
                    <DexBadge name={opp.sellDex} />
                  </div>

                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Spread bruto</span>
                      <span className="font-mono text-slate-300">{opp.grossSpreadBp.toFixed(1)} bp</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Taxa Aave (0.05%)</span>
                      <span className="font-mono text-red-400">-{opp.aaveFeeBp.toFixed(1)} bp</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Gas (Base)</span>
                      <span className="font-mono text-red-400">-${opp.gasCostUsd.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Slippage</span>
                      <span className="font-mono text-red-400">-{opp.slippageBp.toFixed(1)} bp</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Taxas DEX</span>
                      <span className="font-mono text-red-400">-{opp.dexFeesBp.toFixed(1)} bp</span>
                    </div>
                    <div className="border-t border-slate-700/50 pt-1.5 flex justify-between">
                      <span className="text-slate-400 font-semibold">Edge liquido</span>
                      <EdgeBadge bp={opp.netEdgeBp} />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-semibold">Capital sugerido</span>
                      <span className="font-mono text-slate-200">${opp.capital.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-semibold">Lucro estimado</span>
                      <ProfitBadge usd={opp.estimatedProfitUsd} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Full table */}
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-slate-700/50">
              <h3 className="font-semibold text-slate-200 text-sm">Todas as oportunidades escaneadas</h3>
              <button
                onClick={triggerScan}
                disabled={scanning}
                className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
                {scanning ? 'A escanear...' : 'Scan agora'}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50 bg-slate-900/50">
                    <th className="text-left p-3 text-slate-400 font-medium">Par</th>
                    <th className="text-left p-3 text-slate-400 font-medium">Compra</th>
                    <th className="text-left p-3 text-slate-400 font-medium">Vende</th>
                    <th className="text-right p-3 text-slate-400 font-medium">Spread</th>
                    <th className="text-right p-3 text-slate-400 font-medium">Aave</th>
                    <th className="text-right p-3 text-slate-400 font-medium">Gas</th>
                    <th className="text-right p-3 text-slate-400 font-medium">Edge liquido</th>
                    <th className="text-right p-3 text-slate-400 font-medium">Lucro</th>
                  </tr>
                </thead>
                <tbody>
                  {opportunities.map((opp, i) => (
                    <tr key={i} className={`border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors ${opp.netEdgeBp > 0 ? 'bg-emerald-500/5' : ''}`}>
                      <td className="p-3 font-semibold text-slate-200">{opp.pair}</td>
                      <td className="p-3"><DexBadge name={opp.buyDex} /></td>
                      <td className="p-3"><DexBadge name={opp.sellDex} /></td>
                      <td className="p-3 text-right font-mono text-slate-300">{opp.grossSpreadBp.toFixed(1)} bp</td>
                      <td className="p-3 text-right font-mono text-red-400">-{opp.aaveFeeBp.toFixed(1)}</td>
                      <td className="p-3 text-right font-mono text-red-400">${opp.gasCostUsd.toFixed(3)}</td>
                      <td className="p-3 text-right"><EdgeBadge bp={opp.netEdgeBp} /></td>
                      <td className="p-3 text-right"><ProfitBadge usd={opp.estimatedProfitUsd} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {opportunities.length === 0 && (
                <p className="p-8 text-center text-slate-500">Nenhum dado disponivel. Clique Scan agora para procurar oportunidades.</p>
              )}
            </div>
          </div>

          {/* How it works */}
          <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-4 text-xs text-slate-500">
            <p className="font-semibold text-slate-400 mb-1">Como funciona o Flash Loan Arbitrage</p>
            <p>
              1. Empresta do Aave V3 (Base) sem colateral - taxa 0.05% (5 bp).  2. Compra no DEX mais barato.  3. Vende no DEX mais caro - tudo numa transaccao atomica.  4. Se lucrativo: devolve emprestimo + fica com lucro. Se nao: tx reverte, zero perda.  Edge liquido = Spread bruto - Aave 5bp - Gas ($0.03-0.08) - Slippage - Taxas DEX.
            </p>
            <p className="mt-2">
              Pares monitorados: USDC/DAI, USDC/USDT, DAI/USDT, cbETH/weETH, cbETH/rETH, weETH/rETH, WETH/cbETH, WETH/AERO  ·  DEXes: Aerodrome, BaseSwap, Uniswap V3, SushiSwap  ·  Capital necessario: $0 (emprestimo atomico).
            </p>
          </div>

          {lastUpdate && (
            <p className="text-xs text-slate-700 text-right">
              Actualizado: {lastUpdate.toLocaleTimeString('pt-BR')} · Auto-refresh cada 60s
            </p>
          )}
        </>
      )}
    </div>
  )
}
'@

Set-Content -Path "src\components\dashboard\flash-loan-tab.tsx" -Value $tabContent -Encoding UTF8
Write-Host "  OK - flash-loan-tab.tsx criado" -ForegroundColor Green

# ----------------------------------------------------------
# PASSO 2: Modificar page.tsx - Adicionar import
# ----------------------------------------------------------
Write-Host ""
Write-Host "[2/5] Modificando src\app\page.tsx ..." -ForegroundColor Yellow

$pageFile = "src\app\page.tsx"
$content = Get-Content $pageFile -Raw -Encoding UTF8

# 2a: Adicionar import do FlashLoanTab (apos a linha do ValidationDashboard)
$oldImport = "import { ValidationDashboard } from '@/components/dashboard/validation-dashboard'"
$newImport = "import { ValidationDashboard } from '@/components/dashboard/validation-dashboard'`nimport { FlashLoanTab } from '@/components/dashboard/flash-loan-tab'"

if ($content -match "FlashLoanTab") {
    Write-Host "  Import FlashLoanTab ja existe - skip" -ForegroundColor DarkGray
} else {
    $content = $content.Replace($oldImport, $newImport)
    Write-Host "  Import adicionado" -ForegroundColor Green
}

# 2b: Adicionar 'flashloan' ao tipo Tab
$oldType = "type Tab = 'airdrop' | 'lp' | 'yield' | 'depeg' | 'funding' | 'spread' | 'validation'"
$newType = "type Tab = 'airdrop' | 'lp' | 'yield' | 'depeg' | 'funding' | 'spread' | 'flashloan' | 'validation'"

if ($content -match "'flashloan'") {
    Write-Host "  Tipo flashloan ja existe - skip" -ForegroundColor DarkGray
} else {
    $content = $content.Replace($oldType, $newType)
    Write-Host "  Tipo Tab atualizado" -ForegroundColor Green
}

# 2c: Adicionar entrada FLASH LOAN ao TABS array (antes de validacao)
$oldValidationTab = @"
  {
    id: 'validation',
    label: 'Validação',
    emoji: '📊',
    description: 'Edge Tracker · Persistência · Paper Trades · Veredicto GO/NO-GO',
  },
"@

$newValidationTab = @"
  {
    id: 'flashloan',
    label: 'Flash Loan',
    emoji: '⚡',
    description: 'Aave V3 Base · $0 capital · Arbitragem atómica · Aerodrome · BaseSwap',
  },
  {
    id: 'validation',
    label: 'Validação',
    emoji: '📊',
    description: 'Edge Tracker · Persistência · Paper Trades · Veredicto GO/NO-GO',
  },
"@

if ($content -match "id: 'flashloan'") {
    Write-Host "  TABS entry ja existe - skip" -ForegroundColor DarkGray
} else {
    $content = $content.Replace($oldValidationTab, $newValidationTab)
    Write-Host "  Entrada FLASH LOAN adicionada ao TABS" -ForegroundColor Green
}

# 2d: Adicionar render do FlashLoanTab (antes de validation)
$oldRender = "{activeTab === 'validation' && <ValidationDashboard />}"
$newRender = "{activeTab === 'flashloan'  && <FlashLoanTab />}`n          {activeTab === 'validation' && <ValidationDashboard />}"

if ($content -match "FlashLoanTab") {
    Write-Host "  Render FlashLoanTab ja existe - skip" -ForegroundColor DarkGray
} else {
    $content = $content.Replace($oldRender, $newRender)
    Write-Host "  Render FlashLoanTab adicionado" -ForegroundColor Green
}

# 2e: Atualizar subtitulo do header
$oldSubtitle = "6 estratégias · Airdrop + LP + Yield + Depeg + Funding + Spread"
$newSubtitle = "7 estratégias · Airdrop + LP + Yield + Depeg + Funding + Spread + Flash Loan"

$content = $content.Replace($oldSubtitle, $newSubtitle)
Write-Host "  Subtitulo atualizado" -ForegroundColor Green

Set-Content -Path $pageFile -Value $content -Encoding UTF8
Write-Host "  OK - page.tsx salvo" -ForegroundColor Green

# ----------------------------------------------------------
# PASSO 3: Modificar capital-analyzer.ts - Adicionar FLASH_LOAN
# ----------------------------------------------------------
Write-Host ""
Write-Host "[3/5] Modificando src\lib\strategies\capital-analyzer.ts ..." -ForegroundColor Yellow

$capFile = "src\lib\strategies\capital-analyzer.ts"
if (Test-Path $capFile) {
    $capContent = Get-Content $capFile -Raw -Encoding UTF8

    # Adicionar FLASH_LOAN aos CAPITAL_MINIMUMS
    $oldCapMin = "SPREAD: 0,"
    if ($capContent -match "FLASH_LOAN") {
        Write-Host "  FLASH_LOAN ja existe em capital-analyzer - skip" -ForegroundColor DarkGray
    } else {
        $capContent = $capContent.Replace($oldCapMin, "SPREAD: 0,`n  FLASH_LOAN: 0,")
        
        # Adicionar FLASH_LOAN ao CAPITAL_OPTIMAL
        $oldCapOpt = "SPREAD: 2000,"
        $capContent = $capContent.Replace($oldCapOpt, "SPREAD: 2000,`n  FLASH_LOAN: 5000,")
        
        Set-Content -Path $capFile -Value $capContent -Encoding UTF8
        Write-Host "  OK - FLASH_LOAN adicionado a capital-analyzer" -ForegroundColor Green
    }
} else {
    Write-Host "  Ficheiro nao encontrado - skip" -ForegroundColor Red
}

# ----------------------------------------------------------
# PASSO 4: Modificar chain-router.ts - Adicionar FLASH_LOAN
# ----------------------------------------------------------
Write-Host ""
Write-Host "[4/5] Modificando src\lib\strategies\chain-router.ts ..." -ForegroundColor Yellow

$chainFile = "src\lib\strategies\chain-router.ts"
if (Test-Path $chainFile) {
    $chainContent = Get-Content $chainFile -Raw -Encoding UTF8

    if ($chainContent -match "FLASH_LOAN") {
        Write-Host "  FLASH_LOAN ja existe em chain-router - skip" -ForegroundColor DarkGray
    } else {
        # Adicionar ao tipo Strategy
        $oldStrategy = "export type Strategy = 'YIELD' | 'AIRDROP' | 'LP' | 'FUNDING' | 'DEPEG'"
        $newStrategy = "export type Strategy = 'YIELD' | 'AIRDROP' | 'LP' | 'FUNDING' | 'DEPEG' | 'FLASH_LOAN'"
        $chainContent = $chainContent.Replace($oldStrategy, $newStrategy)
        
        Set-Content -Path $chainFile -Value $chainContent -Encoding UTF8
        Write-Host "  OK - FLASH_LOAN adicionado ao tipo Strategy" -ForegroundColor Green
    }
} else {
    Write-Host "  Ficheiro nao encontrado - skip" -ForegroundColor Red
}

# ----------------------------------------------------------
# PASSO 5: Modificar scheduler.ts - Adicionar ciclo flash loan
# ----------------------------------------------------------
Write-Host ""
Write-Host "[5/5] Modificando src\lib\strategies\scheduler.ts ..." -ForegroundColor Yellow

$schedFile = "src\lib\strategies\scheduler.ts"
if (Test-Path $schedFile) {
    $schedContent = Get-Content $schedFile -Raw -Encoding UTF8

    if ($schedContent -match "flashLoan") {
        Write-Host "  flashLoan ja existe em scheduler - skip" -ForegroundColor DarkGray
    } else {
        # Adicionar import do flash-loan-scanner
        $oldSchedImport = "import { scanLP } from './lp-scanner'"
        $newSchedImport = "import { scanLP } from './lp-scanner'`nimport { scanFlashLoanOpportunities } from './flash-loan-scanner'"
        $schedContent = $schedContent.Replace($oldSchedImport, $newSchedImport)
        
        # Adicionar ciclo flash loan (antes do fechamento de startScheduler)
        # Procurar pela ultima linha de setInterval e adicionar apos ela
        $oldLPInterval = "setInterval(() => lpCycle(), 2 * 60 * 60 * 1000)"
        $newLPInterval = "setInterval(() => lpCycle(), 2 * 60 * 60 * 1000)`n`n    // Flash Loan scan - cada 60s`n    const flashLoanCycle = async () => {`n      try { await scanFlashLoanOpportunities() } catch {} }`n    flashLoanCycle()`n    setInterval(() => flashLoanCycle(), 60 * 1000)"
        $schedContent = $schedContent.Replace($oldLPInterval, $newLPInterval)
        
        Set-Content -Path $schedFile -Value $schedContent -Encoding UTF8
        Write-Host "  OK - Ciclo flash loan adicionado ao scheduler" -ForegroundColor Green
    }
} else {
    Write-Host "  Ficheiro nao encontrado - skip" -ForegroundColor Red
}

# ----------------------------------------------------------
# FIM
# ----------------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Instalacao concluida!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Proximos passos:" -ForegroundColor Yellow
Write-Host "  1. Parar o dev server (Ctrl+C)"
Write-Host "  2. Correr: npm run dev"
Write-Host "  3. Abrir http://localhost:3000"
Write-Host "  4. A aba 'Flash Loan' deve aparecer no menu"
Write-Host ""
