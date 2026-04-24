param(
    [string]$Server = "yc-user@93.77.185.161",
    [string]$RemotePath = "~/TrainingBAZA",
    [string]$Branch = "main"
)

Write-Host ""
Write-Host "┌─────────────────────────────────────────┐" -ForegroundColor DarkGray
Write-Host "│       Training BAZA — Deploy            │" -ForegroundColor Yellow
Write-Host "│  Server : $Server" -ForegroundColor Gray
Write-Host "│  Path   : $RemotePath" -ForegroundColor Gray
Write-Host "│  Branch : $Branch" -ForegroundColor Gray
Write-Host "└─────────────────────────────────────────┘" -ForegroundColor DarkGray
Write-Host ""

# ── Step 1: Pull latest code ──────────────────
Write-Host "▶ [1/4] Pulling latest code from GitHub..." -ForegroundColor Cyan
ssh $Server "cd $RemotePath && git fetch origin && git reset --hard origin/$Branch && echo '✓ Code updated'"
if ($LASTEXITCODE -ne 0) { Write-Host "✕ Failed at step 1" -ForegroundColor Red; exit 1 }

# ── Step 2: Stop current container ───────────
Write-Host ""
Write-Host "▶ [2/4] Stopping current container..." -ForegroundColor Cyan
ssh $Server "cd $RemotePath && docker compose down && echo '✓ Container stopped'"
if ($LASTEXITCODE -ne 0) { Write-Host "✕ Failed at step 2" -ForegroundColor Red; exit 1 }

# ── Step 3: Build new image ───────────────────
Write-Host ""
Write-Host "▶ [3/4] Building new Docker image..." -ForegroundColor Cyan
ssh $Server "cd $RemotePath && docker compose build --no-cache && echo '✓ Image built'"
if ($LASTEXITCODE -ne 0) { Write-Host "✕ Failed at step 3" -ForegroundColor Red; exit 1 }

# ── Step 4: Start container ───────────────────
Write-Host ""
Write-Host "▶ [4/4] Starting container..." -ForegroundColor Cyan
ssh $Server "cd $RemotePath && docker compose up -d && sleep 3 && docker compose ps"
if ($LASTEXITCODE -ne 0) { Write-Host "✕ Failed at step 4" -ForegroundColor Red; exit 1 }

# ── Done ──────────────────────────────────────
Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "  ✅ Deploy complete!" -ForegroundColor Green
Write-Host "  🌐 http://93.77.185.161:3000" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host ""
