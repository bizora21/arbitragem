# ============================================================
# FLASH LOAN ARBITRAGE - Instalador v2
# Estrategia 1: $0 capital, $0 risco
#
# COMO USAR:
#   1. Descarrega o ZIP "flash-loan-arbitrage.zip"
#   2. Extrai para E:\arbitragem\flash-loan-files\
#   3. Abre PowerShell em E:\arbitragem\
#   4. Corre: .\install-flash-loan.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$Root = "E:\arbitragem"
$Src = "$Root\flash-loan-files"

if (!(Test-Path $Src)) {
    Write-Host "ERRO: Pasta $Src nao encontrada!" -ForegroundColor Red
    Write-Host "Extrai o ZIP primeiro" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  FLASH LOAN ARBITRAGE - Instalador v2" -ForegroundColor Cyan
Write-Host "  Estrategia 1: Capital 0, Risco 0" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

function CopyNewFile {
    param([string]$RelativePath)
    $src = Join-Path $Src $RelativePath
    $dst = Join-Path $Root $RelativePath
    $dir = Split-Path $dst -Parent
    if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    Copy-Item $src $dst -Force
    Write-Host ("  NOVO: " + $RelativePath) -ForegroundColor Green
}

function CopyEditedFile {
    param([string]$RelativePath)
    $src = Join-Path $Src $RelativePath
    $dst = Join-Path $Root $RelativePath
    if (Test-Path $dst) {
        $backup = "$dst.bak-flashloan"
        Copy-Item $dst $backup -Force
        Write-Host ("  BACKUP: " + $RelativePath + " -> .bak-flashloan") -ForegroundColor Yellow
    }
    Copy-Item $src $dst -Force
    Write-Host ("  EDITADO: " + $RelativePath) -ForegroundColor Cyan
}

# -- 1. Ficheiros NOVOS --
Write-Host "1/2 Copiando ficheiros NOVOS..." -ForegroundColor White
CopyNewFile "src\lib\strategies\flash-loan-scanner.ts"
CopyNewFile "src\app\api\flash-loan\route.ts"
CopyNewFile "src\components\dashboard\flash-loan-tab.tsx"
CopyNewFile "scripts\github-actions\flash-loan-scan.mjs"
CopyNewFile ".github\workflows\flash-loan-scan.yml"
CopyNewFile "supabase\migrations\flash_loan_tables.sql"

Write-Host ""

# -- 2. Ficheiros EDITADOS --
Write-Host "2/2 Substituindo ficheiros EDITADOS (com backup)..." -ForegroundColor White
CopyEditedFile "src\app\page.tsx"
CopyEditedFile "src\lib\dex\price-monitor.ts"
CopyEditedFile "src\lib\contracts.ts"
CopyEditedFile "src\lib\dex\arbitrage-detector.ts"
CopyEditedFile "src\lib\strategies\capital-analyzer.ts"
CopyEditedFile "src\lib\strategies\chain-router.ts"
CopyEditedFile "src\lib\strategies\scheduler.ts"
CopyEditedFile "src\components\dashboard\strategy-validation-panel.tsx"
CopyEditedFile "src\components\CapitalBadge.tsx"
CopyEditedFile "src\components\ReturnSimulator.tsx"

# -- Resumo --
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  INSTALACAO CONCLUIDA!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Agora tens uma nova aba FLASH LOAN no dashboard!" -ForegroundColor White
Write-Host ""
Write-Host "PROXIMOS PASSOS:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Correr a migration no Supabase:" -ForegroundColor White
Write-Host "   Supabase Dashboard -> SQL Editor -> colar o SQL"
Write-Host "   (ve a mensagem anterior do chat com o SQL completo)"
Write-Host ""
Write-Host "2. Build e Test:" -ForegroundColor White
Write-Host "   npm run build"
Write-Host "   npm run dev"
Write-Host ""
Write-Host "3. Abre http://localhost:3000 e clica na aba Flash Loan" -ForegroundColor White
Write-Host ""
Write-Host "4. Push para GitHub:" -ForegroundColor White
Write-Host "   git add ."
Write-Host '   git commit -m "feat: flash loan arbitrage scanner - estrategia 1"'
Write-Host "   git push origin main"
Write-Host ""
