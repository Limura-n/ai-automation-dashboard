#!/usr/bin/env bash
set -euo pipefail

# Adobe Stock Mission Control — Package for Distribution
# Creates a clean zip with everything except personal data.

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_NAME="AdobeStockMissionControl"
OUTPUT_FILE="${PROJECT_DIR}/${OUTPUT_NAME}.zip"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }
info() { echo -e "${CYAN}[i]${NC} $1"; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Packaging Mission Control for Distribution      ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

if ! command -v zip &>/dev/null; then
    err "zip is not installed"
    exit 1
fi

cd "$PROJECT_DIR"

# Clean up old artifacts
rm -f "$OUTPUT_FILE"
rm -rf "/tmp/${OUTPUT_NAME}" 2>/dev/null || true

# Create temp staging directory
STAGING="/tmp/${OUTPUT_NAME}"
mkdir -p "$STAGING"

# ── Copy project files (excluding personal/generated data) ───────────────

info "Collecting project files..."

# Use find with exclusion to copy files
find . \
  -not -path './node_modules/*' \
  -not -path './.next/*' \
  -not -path './.git/*' \
  -not -path './prisma/db/*' \
  -not -path './upload/*' \
  -not -path './download/*' \
  -not -path './examples/*' \
  -not -name '*.log' \
  -not -name '.env' \
  -not -name '.env.*' \
  -not -name 'dev.log' \
  -not -name 'server.log' \
  -not -name 'bun.lock' \
  -not -name 'package-lock.json' \
  -not -name 'next-env.d.ts' \
  -not -name 'local-*' \
  -not -name '*.db' \
  -not -name '*.db-journal' \
  -not -name "$OUTPUT_NAME.zip" \
  -not -name "package.sh" \
  -type f \
  | while read file; do
      # Strip leading ./
      clean="${file#./}"
      mkdir -p "$STAGING/$(dirname "$clean")"
      cp "$file" "$STAGING/$clean"
    done

log "Project files copied (code only, no personal data)"

# ── Copy watchdog scripts (Linux + Windows) ──────────────────────────────

mkdir -p "$STAGING/scripts"

# Linux/macOS watchdog (Python)
WATCHDOG_SRC="$HOME/.hermes/scripts/dashboard_watchdog.py"
if [ -f "$WATCHDOG_SRC" ]; then
    cp "$WATCHDOG_SRC" "$STAGING/scripts/dashboard_watchdog.py"
    log "Linux watchdog script included"
else
    warn "Linux watchdog not found — creating default"
    cat > "$STAGING/scripts/dashboard_watchdog.py" << 'WATCHDOG'
#!/usr/bin/env python3
"""Dashboard Watchdog — auto-restarts dashboard if it crashes."""
import subprocess, sys, os, time, urllib.request, shutil
from pathlib import Path
DASHBOARD_DIR = Path(__file__).resolve().parents[1]
PORT = 3000
HEALTH_URL = f"http://localhost:{PORT}/api/missions"
def check():
    try:
        with urllib.request.urlopen(HEALTH_URL, timeout=5) as resp:
            if resp.status == 200: return
    except: pass
    print(f"[WATCHDOG] Dashboard down on port {PORT}")
    r = subprocess.run(["pgrep","-f",f"next dev.*{PORT}"], capture_output=True, text=True)
    if r.stdout.strip():
        subprocess.run(["pkill","-f",f"next dev.*{PORT}"])
        time.sleep(2)
    nd = DASHBOARD_DIR/".next"
    if nd.exists(): shutil.rmtree(nd)
    env = os.environ.copy()
    env["PATH"] = f"{DASHBOARD_DIR}/node_modules/.bin:" + env.get("PATH","")
    proc = subprocess.Popen(["npx","next","dev","-p",str(PORT)], cwd=str(DASHBOARD_DIR), stdout=open(DASHBOARD_DIR/"dev.log","a"), stderr=subprocess.STDOUT, env=env)
    print(f"[WATCHDOG] Started dashboard (PID {proc.pid})")
    time.sleep(5)
    try:
        with urllib.request.urlopen(HEALTH_URL, timeout=5) as resp:
            if resp.status == 200: print(f"[WATCHDOG] SUCCESS: Dashboard running")
    except: pass
if __name__ == "__main__":
    try: check()
    except Exception as e: print(f"[WATCHDOG] Error: {e}", file=sys.stderr)
WATCHDOG
    chmod +x "$STAGING/scripts/dashboard_watchdog.py"
fi

# Windows watchdog (PowerShell)
WATCHDOG_PS1_SRC="$HOME/.hermes/scripts/dashboard_watchdog.ps1"
if [ -f "$WATCHDOG_PS1_SRC" ]; then
    cp "$WATCHDOG_PS1_SRC" "$STAGING/scripts/dashboard_watchdog.ps1"
    log "Windows watchdog script included"
else
    warn "Windows watchdog not found — creating default"
    cat > "$STAGING/scripts/dashboard_watchdog.ps1" << 'WATCHDOGPS1'
<#
.SYNOPSIS
    Dashboard Watchdog for Windows — auto-restarts dashboard if it crashes.
#>
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Port = 3000
$HealthUrl = "http://localhost:$Port/api/missions"
$DevLog = Join-Path $ProjectDir "dev.log"
$NextDir = Join-Path $ProjectDir ".next"
try {
    $response = Invoke-WebRequest -Uri $HealthUrl -TimeoutSec 5 -UseBasicParsing
    if ($response.StatusCode -eq 200) { exit 0 }
} catch {}
Write-Host "[WATCHDOG] Dashboard not responding on port $Port"
$processes = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
foreach ($conn in $processes) {
    try {
        $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
        if ($proc -and $proc.ProcessName -match "node") { Stop-Process -Id $conn.OwningProcess -Force }
    } catch {}
}
Start-Sleep -Seconds 2
if (Test-Path $NextDir) { Remove-Item -Path $NextDir -Recurse -Force }
$env:Path = "$ProjectDir\node_modules\.bin;" + $env:Path
Start-Process -FilePath "npx.cmd" -ArgumentList @("next", "dev", "-p", $Port) -WorkingDirectory $ProjectDir -NoNewWindow
Write-Host "[WATCHDOG] Started dashboard"
WATCHDOGPS1
fi

# ── Create deployment README ──────────────────────────────────────────────

cat > "$STAGING/DEPLOY.md" << 'DEPLOY'
# Deploying Mission Control

This package contains everything you need to run your own AI Mission Control dashboard.
It has ZERO personal data — your missions, agents, and tasks start fresh.

## Quick Start

### Linux / macOS
```bash
cd AdobeStockMissionControl
bash setup.sh
```

### Windows
```powershell
cd AdobeStockMissionControl
.\setup.bat
```
Or double-click `setup.bat` in File Explorer.

The setup script will guide you through:
1. Installing dependencies
2. Setting up the database
3. Configuring Telegram notifications (optional)
4. Setting up the Super Agent cron jobs
5. Starting the dashboard

## Prerequisites

- **Node.js** v18+ (required) — https://nodejs.org
- **Hermes Agent** (required for AI features)
  - Install: https://github.com/NazmulsTech/Hermes
  - Get API key: https://opencode.ai/auth
- **Telegram** (optional, for mobile notifications)

## System Architecture

```
Telegram You ◄──────────────────────────┐
        │                                │
        ▼                                │
  [Super Agent Orchestrator] ◄───────────┤ (notifications)
   (every 2min, forever)                 │
        │                                │
        ├── REUSE existing agents ───────┤
        ├── Stuck mission recovery ──────┤
        ├── Error handling ──────────────┤
        │                                │
        ▼                                │
  [Dashboard :3000] ◄─── [Watchdog] ─────┘
   (auto-restarts if crashed)
```

## Agent Behavior

The Super Agent follows these rules:

1. **REUSE Agents First** — Never creates a new agent if an existing idle agent can handle the task. Agents gain experience with each task they complete.

2. **Auto Recovery** — Every 2 minutes, checks for stuck missions and cleans them up.

3. **Error Handling** — Failed tasks are marked as failed, never left hanging.

4. **Silent Mode** — No spam notifications when idle.

## Files

```
AdobeStockMissionControl/
├── setup.sh                    → Linux/macOS setup script
├── setup.ps1                   → Windows PowerShell setup
├── setup.bat                   → Windows double-click entry point
├── DEPLOY.md                   → This file
├── scripts/
│   ├── dashboard_watchdog.py   → Linux/macOS auto-restarter
│   └── dashboard_watchdog.ps1  → Windows auto-restarter
├── src/                        → Dashboard code
├── prisma/                     → Database schema
└── package.json                → Dependencies
```

Open http://localhost:3000 after starting.
DEPLOY

log "Deployment guide created"

# ── Zip it up ─────────────────────────────────────────────────────────────

info "Creating zip package..."
cd /tmp
ZIP_TMP="/tmp/${OUTPUT_NAME}.zip"
zip -r "$ZIP_TMP" "$OUTPUT_NAME" > /dev/null 2>&1
mv "$ZIP_TMP" "$OUTPUT_FILE"

# Cleanup staging
rm -rf "$STAGING"

SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)

echo ""
log "Package created: ${CYAN}${OUTPUT_FILE}${NC}"
info "Size: ${SIZE}"
echo ""
echo -e "${YELLOW}── What's included ────────────────────────────${NC}"
echo "  ✅ Dashboard code (Next.js + all APIs)"
echo "  ✅ Database schema (fresh — no data)"
echo "  ✅ Super Agent behavior (reuse, recovery, silent mode)"
echo "  ✅ Dashboard Watchdog (Linux + Windows)"
echo "  ✅ setup.sh / setup.ps1 / setup.bat — cross-platform"
echo "  ✅ Auto-detects OS — zero config"
echo ""
echo -e "${YELLOW}── What's NOT included (your data stays) ─────${NC}"
echo "  ❌ .env with API keys"
echo "  ❌ SQLite database (missions, agents, history)"
echo "  ❌ Telegram user ID"
echo "  ❌ node_modules (reinstalled on setup)"
echo "  ❌ .next build cache (rebuilt on setup)"
echo "  ❌ Logs, uploads, downloads, git history"
echo ""
echo -e "${GREEN}Ready to share!${NC}"
echo ""
