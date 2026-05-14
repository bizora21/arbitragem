# ============================================================
# FLASH LOAN ARBITRAGE - Instalador
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
Write-Host "  FLASH LOAN ARBITRAGE - Instalador" -ForegroundColor Cyan
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
CopyNewFile "scripts\github-actions\flash-loan-scan.mjs"
CopyNewFile ".github\workflows\flash-loan-scan.yml"
CopyNewFile "supabase\migrations\flash_loan_tables.sql"

Write-Host ""

# -- 2. Ficheiros EDITADOS --
Write-Host "2/2 Substituindo ficheiros EDITADOS (com backup)..." -ForegroundColor White
CopyEditedFile "src\lib\dex\price-monitor.ts"
CopyEditedFile "src\lib\contracts.ts"
CopyEditedFile "src\lib\dex\arbitrage-detector.ts"
CopyEditedFile "src\lib\strategies\capital-analyzer.ts"
CopyEditedFile "src\lib\strategies\chain-router.ts"
CopyEditedFile "src\lib\strategies\scheduler.ts"

# -- Resumo --
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  INSTALACAO CONCLUIDA!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "PROXIMOS PASSOS:" -ForegroundColor White
Write-Host ""
Write-Host "1. Correr a migration no Supabase:" -ForegroundColor Yellow
Write-Host "   Supabase Dashboard -> SQL Editor -> colar conteudo de:"
Write-Host "   supabase\migrations\flash_loan_tables.sql"
Write-Host ""
Write-Host "2. Adicionar GitHub Secrets:" -ForegroundColor Yellow
Write-Host "   GitHub repo -> Settings -> Secrets and variables -> Actions -> New secret:"
Write-Host "   NEXT_PUBLIC_SUPABASE_URL  = (URL do teu Supabase)"
Write-Host "   SUPABASE_SERVICE_ROLE_KEY = (Service Role Key do Supabase)"
Write-Host ""
Write-Host "3. Build e Test:" -ForegroundColor Yellow
Write-Host "   npm run build"
Write-Host "   npm run dev"
Write-Host "   curl -X POST http://localhost:3000/api/flash-loan"
Write-Host ""
Write-Host "4. Push para GitHub:" -ForegroundColor Yellow
Write-Host "   git add ."
Write-Host '   git commit -m "feat: flash loan arbitrage scanner - estrategia 1"'
Write-Host "   git push origin main"
Write-Host ""
Write-Host "5. Testar GitHub Actions:" -ForegroundColor Yellow
Write-Host "   GitHub -> Actions -> Flash Loan Scanner -> Run workflow"
Write-Host ""
