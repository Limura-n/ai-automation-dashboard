<#
.SYNOPSIS
    Adobe Stock Mission Control — Complete Setup (PowerShell)
.DESCRIPTION
    Cross-platform setup for Windows, Linux, and macOS.
    Auto-detects OS and configures everything.
    Usage:  powershell -ExecutionPolicy Bypass -File setup.ps1
#>

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectDir

function Log($msg)  { Write-Host "[✓] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[!] $msg" -ForegroundColor Yellow }
function Err($msg)  { Write-Host "[✗] $msg" -ForegroundColor Red }
function Info($msg) { Write-Host "[i] $msg" -ForegroundColor Cyan }

$IsWindows = $env:OS -match "Windows"
$IsLinux = (Get-Process -Id $PID).SessionId -ne $null -and -not $IsWindows
# Simple check: if not Windows, assume Unix
if (-not $IsWindows) { $IsUnix = $true } else { $IsUnix = $false }

Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     Adobe Stock Mission Control — Setup          ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

if ($IsWindows) {
    Log "Detected: Windows"
} else {
    Log "Detected: Linux/macOS"
}

# ── Prerequisites ──────────────────────────────────────────────────────────

$PrereqOk = $true

try {
    $nodeVer = & node --version
    Log "Node.js $nodeVer"
} catch {
    Err "Node.js is not installed. Get it from https://nodejs.org (v18+)"
    $PrereqOk = $false
}

$BunAvail = $false
try {
    $bunVer = & bun --version
    if ($IsUnix) { $bunVer = & bun --version 2>/dev/null }
    Log "Bun $bunVer"
    $BunAvail = $true
} catch {
    Warn "Bun not found. Will use npm instead."
}

try {
    & npx --version | Out-Null
    Log "npx available"
} catch {
    Err "npx is not available (should come with Node.js)"
    $PrereqOk = $false
}

if (-not $PrereqOk) {
    Err "Fix the issues above and re-run setup.ps1"
    exit 1
}

# ── Environment File ───────────────────────────────────────────────────────

if (Test-Path ".env") {
    Warn ".env already exists — skipping (edit it directly to update keys)"
} else {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Log "Created .env from .env.example"
        Write-Host ""
        Info "IMPORTANT: Open .env and add your API keys:"
        Info "  Required: OPENCODE_GO_API_KEY from https://opencode.ai/auth"
        Info "  Optional: OPENROUTER_API_KEY, TELEGRAM_BOT_TOKEN"
        Write-Host ""
        if ($IsWindows) {
            Info "Edit with: notepad .env"
        } else {
            Info "Edit with: nano .env"
        }
        Write-Host ""
        Read-Host "Press Enter after you've updated .env (or Ctrl+C to abort)"
    } else {
        Warn ".env.example not found — creating minimal .env"
        @"
DATABASE_URL="file:./prisma/db/custom.db"
HERMES_BASE_URL="http://localhost:8000"
OPENCODE_GO_API_KEY="***"
OPENROUTER_API_KEY="***"
"@ | Set-Content ".env"
        Warn "OPEN .env and fill in your API keys!"
        Read-Host "Press Enter after you've updated .env..."
    }
}

# ── Install Dependencies ───────────────────────────────────────────────────

Write-Host ""
Info "Installing dependencies..."

if ($BunAvail) {
    & bun install 2>&1 | Select-Object -Last 5
    $Script:pkg = "bun"
} else {
    & npm install 2>&1 | Select-Object -Last 5
    $Script:pkg = "npm"
}

Log "Dependencies installed"

# ── Database Setup ─────────────────────────────────────────────────────────

Write-Host ""
Info "Setting up database..."

New-Item -ItemType Directory -Force -Path "prisma/db" | Out-Null

& npx prisma generate 2>&1 | Select-Object -Last 3
& npx prisma db push 2>&1 | Select-Object -Last 5

Log "Database ready at prisma/db/custom.db"

# ── Build ──────────────────────────────────────────────────────────────────

Write-Host ""
Info "Building production bundle..."
if ($BunAvail) {
    & bun run build 2>&1 | Select-Object -Last 10
} else {
    & npm run build 2>&1 | Select-Object -Last 10
}

Log "Build complete"

# ── Telegram Notification Setup ────────────────────────────────────────────

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     Agent Identity Setup                        ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "What should your main agent be called?" -ForegroundColor Yellow
Write-Host "(This is the name that appears in the dashboard and notifications)"
Write-Host ""
$AgentName = Read-Host "Agent name [LIMURA]"
if (-not $AgentName) { $AgentName = "LIMURA" }
Log "Main agent will be called: $AgentName"
Write-Host ""

# ── Telegram Notification Setup ────────────────────────────────────────────

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     Notification Setup                          ║" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Create a bot via @BotFather on Telegram"
Write-Host "2. Get your personal Telegram User ID (message @userinfobot on Telegram)"
Write-Host ""
$TelegramId = Read-Host "Enter your Telegram User ID (or press Enter to skip)"

if ($TelegramId) {
    $DeliverTarget = "telegram:${TelegramId}"
    Log "Notifications will go to Telegram user $TelegramId"
} else {
    $DeliverTarget = "local"
    Warn "Skipping Telegram setup — notifications saved locally only"
}

# ── Install Watchdog Script ───────────────────────────────────────────────

Write-Host ""
Info "Installing Dashboard Watchdog..."

$WatchdogDir = "$HOME\.hermes\scripts"
if ($IsUnix) {
    $WatchdogDir = "$HOME/.hermes/scripts"
}
New-Item -ItemType Directory -Force -Path $WatchdogDir | Out-Null

# Install the right watchdog for each platform
if ($IsWindows) {
    $WatchdogScript = "$WatchdogDir\dashboard_watchdog.ps1"
    @"
`<#
.SYNOPSIS
    Dashboard Watchdog for Windows — auto-restarts dashboard if it crashes.
#>
`$ProjectDir = "$ProjectDir"
`$Port = 3000
`$HealthUrl = "http://localhost:`$Port/api/missions"
`$DevLog = Join-Path `$ProjectDir "dev.log"
`$NextDir = Join-Path `$ProjectDir ".next"

try {
    `$response = Invoke-WebRequest -Uri `$HealthUrl -TimeoutSec 5 -UseBasicParsing
    if (`$response.StatusCode -eq 200) { exit 0 }
} catch {}

Write-Host "[WATCHDOG] Dashboard not responding on port `$Port"

`$processes = Get-NetTCPConnection -LocalPort `$Port -ErrorAction SilentlyContinue
foreach (`$conn in `$processes) {
    try {
        `$proc = Get-Process -Id `$conn.OwningProcess -ErrorAction SilentlyContinue
        if (`$proc -and `$proc.ProcessName -match "node") {
            Stop-Process -Id `$conn.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    } catch {}
}
Start-Sleep -Seconds 2

if (Test-Path `$NextDir) {
    Remove-Item -Path `$NextDir -Recurse -Force -ErrorAction SilentlyContinue
}

`$env:Path = "`$ProjectDir\node_modules\.bin;" + `$env:Path
Start-Process -FilePath "npx.cmd" -ArgumentList @("next", "dev", "-p", `$Port) -WorkingDirectory `$ProjectDir -NoNewWindow
Write-Host "[WATCHDOG] Started dashboard"
"@ | Set-Content $WatchdogScript
    Log "Windows watchdog installed at $WatchdogScript"
} else {
    $WatchdogScript = "$WatchdogDir/dashboard_watchdog.py"
    @"
#!/usr/bin/env python3
import subprocess, sys, os, time, urllib.request, shutil
from pathlib import Path
DASHBOARD_DIR = Path("$ProjectDir")
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
if __name__ == "__main__":
    try: check()
    except Exception as e: print(f"[WATCHDOG] Error: {e}", file=sys.stderr)
"@ | Set-Content $WatchdogScript
    & chmod +x $WatchdogScript 2>$null
    Log "Linux watchdog installed at $WatchdogScript"
}

# ── Write Super Agent Skill ────────────────────────────────────────────────

$SkillDir = "$HOME\.hermes\skills\productivity\dashboard-command-center"
if ($IsUnix) {
    $SkillDir = "$HOME/.hermes/skills/productivity/dashboard-command-center"
}
New-Item -ItemType Directory -Force -Path $SkillDir | Out-Null

@"
---
name: dashboard-command-center
description: Next.js Dashboard as commanding center for AI agent - tasks, sub-agents, heartbeat
---

# Dashboard Command Center

## Production Behavior

### Core Agent Identity
The main orchestrator is called **$AgentName**.

### Core Principle: REUSE Agents First
The Super Agent NEVER creates a new sub-agent if an existing idle agent can handle the task.
Agents gain experience the more tasks they complete — this is by design.

### Stuck Mission Recovery (auto-run every 2 min)
1. Missions stuck in `analyzing`/`assigning` for >4 min → auto-failed
2. Missions `in_progress` for >30 min with 0 tasks → auto-failed
3. Orphaned tasks stuck `in_progress` → auto-failed, agent freed
4. Agents stuck `busy` for >30 min → reset to idle

### Error Handling
- If delegate_task fails → task marked `failed`, agent freed
- Never leaves a task `in_progress` forever
- If any task fails → mission marked `failed` with error summary

### Silent Mode
If nothing to do, the agent outputs `[SILENT]` — no spam notifications.

### Cron Schedule
- Every 2 minutes, forever
- Max 2 tasks delegated per run
- Delivery: Telegram DM (if configured) or local

### Max Tasks Per Run
2 tasks per 2-minute cycle. If a mission has more, it completes over multiple cycles.
"@ | Set-Content "$SkillDir/SKILL.md"

Log "Super Agent skill installed"

# ── Setup Cron Jobs via Hermes ─────────────────────────────────────────────

Write-Host ""
Info "============================================" -ForegroundColor Yellow
Info "MANUAL STEP: Configure Cron Jobs" -ForegroundColor Yellow
Info "============================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Now register two cron jobs using the Hermes CLI:" -ForegroundColor Yellow
Write-Host ""
Write-Host "STEP 1: Create the Super Agent Orchestrator"
Write-Host ""
Write-Host "hermes cron create \"
Write-Host "  --name `"Super Agent Orchestrator`" \"
Write-Host "  --schedule `"every 2m`" \"
Write-Host "  --deliver `"$DeliverTarget`" \"
Write-Host "  --skill dashboard-command-center \"
Write-Host '  --prompt "You are '"$AgentName"', the Super Agent. REUSE existing agents first. Agents gain experience. Stuck recovery, error handling, silent mode."'
Write-Host ""
Write-Host "STEP 2: Create the Dashboard Watchdog"
Write-Host ""

if ($IsWindows) {
    Write-Host "hermes cron create \"
    Write-Host "  --name `"Dashboard Watchdog`" \"
    Write-Host "  --schedule `"every 2m`" \"
    Write-Host "  --deliver `"local`" \"
    Write-Host '  --script dashboard_watchdog.ps1 \'
    Write-Host '  --prompt "You are the Dashboard Watchdog. Report issues found by the script."'
} else {
    Write-Host "hermes cron create \"
    Write-Host "  --name `"Dashboard Watchdog`" \"
    Write-Host "  --schedule `"every 2m`" \"
    Write-Host "  --deliver `"local`" \"
    Write-Host '  --script dashboard_watchdog.py \'
    Write-Host '  --prompt "You are the Dashboard Watchdog. Report issues found by the script."'
}

Write-Host ""
Write-Host "STEP 3: Verify"
Write-Host ""
Write-Host "hermes cron list"
Write-Host ""

# ── Start Dashboard ────────────────────────────────────────────────────────

Write-Host ""
Info "Starting Dashboard..."
Write-Host ""

if ($IsWindows) {
    $env:Path = "$ProjectDir\node_modules\.bin;" + $env:Path
    $proc = Start-Process -FilePath "npx.cmd" -ArgumentList @("next", "dev", "-p", "3000") -WorkingDirectory $ProjectDir -NoNewWindow -PassThru
    Log "Dashboard starting (PID $($proc.Id)) on http://localhost:3000"
} else {
    # Linux/macOS — use background process
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = "npx"
    $startInfo.Arguments = "next dev -p 3000"
    $startInfo.WorkingDirectory = $ProjectDir
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $proc = [System.Diagnostics.Process]::Start($startInfo)
    Log "Dashboard starting (PID $($proc.Id)) on http://localhost:3000"
}

# ── Done ───────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Setup Complete!                                  ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "Dashboard:      http://localhost:3000" -ForegroundColor Green
Write-Host "API Base:       http://localhost:3000/api" -ForegroundColor Green
Write-Host ""
Write-Host "── Agent Behavior Summary ─────────────────────────" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Your main agent \"$AgentName\" will:" -ForegroundColor Green
Write-Host "  [Y] REUSES existing agents — never creates new if idle match exists"
Write-Host "  [Y] Agents gain experience through repetition"
Write-Host "  [Y] Auto-recovery from stuck missions (every 10 min check)"
Write-Host "  [Y] Error handling — failed tasks don't freeze the system"
Write-Host "  [Y] Silent mode — no spam when idle"
Write-Host "  [Y] Dashboard watchdog — auto-restarts if crashes"
Write-Host ""
Write-Host "── Required to complete ───────────────────────────" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. Add your API keys to .env"
Write-Host "  2. Install Hermes Agent: https://github.com/NazmulsTech/Hermes"
Write-Host "  3. Run the two 'hermes cron create' commands shown above"
Write-Host "  4. Open http://localhost:3000 and create your first mission!"
Write-Host ""
