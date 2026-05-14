#!/usr/bin/env bash
set -euo pipefail

##############################################################################
#  Adobe Stock Mission Control — Complete Setup
#
#  Usage:  bash setup.sh
#
#  What it does:
#    1. Checks prerequisites (node, bun, npx)
#    2. Copies .env.example -> .env (won't overwrite existing)
#    3. Installs npm dependencies
#    4. Creates SQLite database & applies Prisma schema
#    5. Prompts for Telegram ID (for agent notifications)
#    6. Sets up the Super Agent cron (agent reuse, error handling, etc.)
#    7. Sets up the Dashboard Watchdog (auto-restart on crash)
#    8. Starts the dashboard
#    9. Prints post-setup instructions
##############################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }
info() { echo -e "${CYAN}[i]${NC} $1"; }

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     Adobe Stock Mission Control — Setup          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ── Prerequisites ──────────────────────────────────────────────────────────

PREREQ_OK=true

if ! command -v node &>/dev/null; then
    err "Node.js is not installed. Install it from https://nodejs.org (v18+)"
    PREREQ_OK=false
else
    NODE_VER=$(node -v)
    log "Node.js $NODE_VER"
fi

if ! command -v bun &>/dev/null; then
    warn "Bun not found. Will use npm instead."
    BUN_AVAIL=false
else
    BUN_VER=$(bun -v 2>/dev/null || bun --version)
    log "Bun $BUN_VER"
    BUN_AVAIL=true
fi

if ! command -v npx &>/dev/null; then
    err "npx is not available (should come with Node.js)"
    PREREQ_OK=false
else
    log "npx available"
fi

if [ "$PREREQ_OK" = false ]; then
    err "Fix the issues above and re-run setup.sh"
    exit 1
fi

# ── Environment File ───────────────────────────────────────────────────────

if [ -f .env ]; then
    warn ".env already exists — skipping (edit it directly to update keys)"
else
    if [ -f .env.example ]; then
        cp .env.example .env
        log "Created .env from .env.example"
        echo ""
        info "IMPORTANT: Open .env and add your API keys:"
        info "  Required: OPENCODE_GO_API_KEY from https://opencode.ai/auth"
        info "  Optional: OPENROUTER_API_KEY, TELEGRAM_BOT_TOKEN"
        echo ""
        echo "  nano $PROJECT_DIR/.env"
        echo "  (or use any text editor)"
        echo ""
        read -p "Press Enter after you've updated .env (or Ctrl+C to abort)... "
    else
        warn ".env.example not found — creating minimal .env"
        cat > .env << 'EOF'
DATABASE_URL="file:./prisma/db/custom.db"
HERMES_BASE_URL="http://localhost:8000"
OPENCODE_GO_API_KEY="***"
OPENROUTER_API_KEY="***"
EOF
        warn "OPEN .env and fill in your API keys before continuing!"
        read -p "Press Enter after you've updated .env..."
    fi
fi

# ── Install Dependencies ───────────────────────────────────────────────────

echo ""
info "Installing dependencies..."

if [ "$BUN_AVAIL" = true ]; then
    bun install 2>&1 | tail -5
    PKG_MGR="bun"
else
    npm install 2>&1 | tail -5
    PKG_MGR="npm"
fi

log "Dependencies installed"

# ── Database Setup ─────────────────────────────────────────────────────────

echo ""
info "Setting up database..."

mkdir -p prisma/db

npx prisma generate 2>&1 | tail -3
npx prisma db push 2>&1 | tail -5

log "Database ready at prisma/db/custom.db"

# ── Build ──────────────────────────────────────────────────────────────────

echo ""
info "Building production bundle..."
if [ "$BUN_AVAIL" = true ]; then
    bun run build 2>&1 | tail -10
else
    npm run build 2>&1 | tail -10
fi

log "Build complete"

# ── Agent Name Setup ──────────────────────────────────────────────────────

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     Agent Identity Setup                        ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo "What should your main agent be called?"
echo "(This is the name that appears in the dashboard and notifications)"
echo ""
read -p "Agent name [LIMURA]: " AGENT_NAME
AGENT_NAME="${AGENT_NAME:-LIMURA}"
log "Main agent will be called: $AGENT_NAME"
echo ""

# ── User Personality Setup ─────────────────────────────────────────────

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     Who You Are — Personality Profile           ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo "I need to know you to work smarter for you."
echo "This helps me adapt how I plan, communicate, and execute."
echo ""

read -p "Your name [Nazmul]: " USER_NAME
USER_NAME="${USER_NAME:-Nazmul}"

echo ""
echo "What's your role? (e.g., Founder, Developer, Designer, Creator)"
read -p "Role [Creator]: " USER_ROLE
USER_ROLE="${USER_ROLE:-Creator}"

echo ""
echo "What are your top skills? (comma-separated, e.g., python, design, automation)"
read -p "Skills [python, design, automation, content creation]: " USER_SKILLS
USER_SKILLS="${USER_SKILLS:-python, design, automation, content creation}"

echo ""
echo "Choose your work style:"
echo "  1) Hands-on — I want detailed breakdowns and to review everything"
echo "  2) Hands-off — Just give me results, I trust the system"
echo "  3) Collaborative — Keep me in the loop but handle the heavy lifting"
read -p "Work style [3]: " WORK_STYLE_CHOICE
case "${WORK_STYLE_CHOICE}" in
  1) USER_WORK_STYLE="hands-on" ;;
  2) USER_WORK_STYLE="hands-off" ;;
  *) USER_WORK_STYLE="collaborative" ;;
esac

echo ""
echo "Experience level:"
echo "  1) Beginner — New to this space"
echo "  2) Intermediate — Some experience"
echo "  3) Advanced — Experienced"
echo "  4) Expert — I know my craft well"
read -p "Level [3]: " EXP_CHOICE
case "${EXP_CHOICE}" in
  1) USER_EXP="beginner" ;;
  2) USER_EXP="intermediate" ;;
  4) USER_EXP="expert" ;;
  *) USER_EXP="advanced" ;;
esac

echo ""
echo "Your Mission — what drives you? What's the core purpose you're working toward?"
echo "(e.g., Build automated income streams, Create halal digital products, Solve business problems with AI)"
read -p "Mission: " USER_MISSION
if [ -z "$USER_MISSION" ]; then
  USER_MISSION="Build automated income streams through halal micro SaaS and digital products"
fi

echo ""
echo "Your Vision — long-term, where do you see yourself?"
echo "(e.g., Build a portfolio of passive-income SaaS products, Run a fully AI-automated business)"
read -p "Vision: " USER_VISION
if [ -z "$USER_VISION" ]; then
  USER_VISION="Run a portfolio of automated micro SaaS businesses generating recurring revenue"
fi

echo ""
echo "Personality (brief) — how would you describe yourself?"
echo "(e.g., Pragmatic builder who values automation, Creative thinker focused on results)"
read -p "Personality: " USER_PERSONALITY
if [ -z "$USER_PERSONALITY" ]; then
  USER_PERSONALITY="Pragmatic builder who values automation and clean results over process"
fi

echo ""
echo "How do you prefer to receive updates?"
echo "  1) Telegram — quick notifications"
echo "  2) Dashboard — check when I want"
echo "  3) Both"
read -p "Preference [1]: " COMM_CHOICE
case "${COMM_CHOICE}" in
  2) USER_COMM="dashboard" ;;
  3) USER_COMM="both" ;;
  *) USER_COMM="telegram" ;;
esac

echo ""
echo "When are you most active? (e.g., 9am-11pm, mornings, evenings)"
read -p "Active hours [9am-11pm]: " USER_HOURS
USER_HOURS="${USER_HOURS:-9am-11pm}"

log "Personality profile captured!"
echo ""
echo -e "${YELLOW}── Your Profile Summary ──────────────────────────${NC}"
echo "  Name:         $USER_NAME"
echo "  Role:         $USER_ROLE"
echo "  Skills:       $USER_SKILLS"
echo "  Work Style:   $USER_WORK_STYLE"
echo "  Level:        $USER_EXP"
echo "  Mission:      $USER_MISSION"
echo "  Vision:       $USER_VISION"
echo "  Personality:  $USER_PERSONALITY"
echo "  Comm:         $USER_COMM"
echo "  Active:       $USER_HOURS"
echo ""

# ── Seed Profile via API ─────────────────────────────────────
# Start the dashboard briefly to seed the profile, then kill it
# If dashboard is already running, just use the API directly
info "Saving your profile..."
PROFILE_PAYLOAD=$(cat << JSONEOF
{
  "name": "${USER_NAME}",
  "role": "${USER_ROLE}",
  "skills": "${USER_SKILLS}",
  "workStyle": "${USER_WORK_STYLE}",
  "experienceLevel": "${USER_EXP}",
  "mission": "${USER_MISSION}",
  "vision": "${USER_VISION}",
  "personality": "${USER_PERSONALITY}",
  "communicationPref": "${USER_COMM}",
  "activeHours": "${USER_HOURS}",
  "preferences": {
    "reportFormat": "concise",
    "notificationStyle": "proactive",
    "timezone": "auto"
  },
  "setupComplete": true
}
JSONEOF
)

# Try to hit the API — dashboard might be running already
API_OK=false
if command -v curl &>/dev/null; then
  PROFILE_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:3000/api/profile" \
    -H 'Content-Type: application/json' \
    -d "$PROFILE_PAYLOAD" 2>/dev/null || echo "000")
  if [ "$PROFILE_RESPONSE" = "200" ]; then
    API_OK=true
    log "Profile saved to dashboard!"
  fi
fi

if [ "$API_OK" = false ]; then
  # Dashboard not running yet — save to a temp file for later seeding
  echo "$PROFILE_PAYLOAD" > "$PROJECT_DIR/.profile-seed.json"
  log "Profile saved to .profile-seed.json — will be loaded when dashboard starts"
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Great! I'll remember this about you.      ${NC}"
echo -e "${GREEN}  Every task and mission will adapt to you.  ${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ── Telegram Notification Setup ────────────────────────────────────────────

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     Notification Setup                          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo "To receive mission completion notifications on Telegram:"
echo ""
echo "1. Create a bot via @BotFather on Telegram"
echo "2. Get your personal Telegram User ID (message @userinfobot on Telegram)"
echo ""
read -p "Enter your Telegram User ID (or press Enter to skip): " TELEGRAM_ID

if [ -n "$TELEGRAM_ID" ]; then
    DELIVER_TARGET="telegram:${TELEGRAM_ID}"
    log "Notifications will go to Telegram user $TELEGRAM_ID"
else
    DELIVER_TARGET="local"
    warn "Skipping Telegram setup — notifications will be saved locally only"
fi

# ── Create Skill Directory ─────────────────────────────────────────────────

SKILL_DIR="$HOME/.hermes/skills/productivity/dashboard-command-center"
mkdir -p "$SKILL_DIR"

# ── Install Watchdog Script ───────────────────────────────────────────────

WATCHDOG_SCRIPT="$HOME/.hermes/scripts/dashboard_watchdog.py"
mkdir -p "$HOME/.hermes/scripts"

cat > "$WATCHDOG_SCRIPT" << 'WATCHDOG'
#!/usr/bin/env python3
"""Dashboard Watchdog — auto-restarts Next.js dev server if it crashes."""

import subprocess
import sys
import os
import time
import urllib.request
import shutil
from pathlib import Path

DASHBOARD_DIR = Path(__file__).resolve().parents[1]
PORT = 3000
HEALTH_URL = f"http://localhost:{PORT}/api/missions"

def check():
    try:
        req = urllib.request.Request(HEALTH_URL)
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status == 200:
                return
    except Exception:
        pass

    print(f"[WATCHDOG] Dashboard not responding on port {PORT}")

    result = subprocess.run(
        ["pgrep", "-f", f"next dev.*{PORT}"],
        capture_output=True, text=True, timeout=5
    )
    if result.stdout.strip():
        print(f"[WATCHDOG] Killing stale process(es)")
        subprocess.run(["pkill", "-f", f"next dev.*{PORT}"], timeout=5)
        time.sleep(2)

    next_dir = DASHBOARD_DIR / ".next"
    if next_dir.exists():
        shutil.rmtree(next_dir)
        print(f"[WATCHDOG] Cleared .next cache")

    env = os.environ.copy()
    env["PATH"] = f"{DASHBOARD_DIR}/node_modules/.bin:" + env.get("PATH", "")
    
    log_file = open(DASHBOARD_DIR / "dev.log", "a")
    proc = subprocess.Popen(
        ["npx", "next", "dev", "-p", str(PORT)],
        cwd=str(DASHBOARD_DIR),
        stdout=log_file,
        stderr=subprocess.STDOUT,
        env=env
    )
    print(f"[WATCHDOG] Started dashboard (PID {proc.pid})")

    time.sleep(5)
    try:
        req = urllib.request.Request(HEALTH_URL)
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status == 200:
                print(f"[WATCHDOG] SUCCESS: Dashboard running on port {PORT}")
    except Exception as e:
        print(f"[WATCHDOG] Started but not yet responding: {e}")

if __name__ == "__main__":
    try:
        check()
    except Exception as e:
        print(f"[WATCHDOG] Error: {e}", file=sys.stderr)
WATCHDOG

chmod +x "$WATCHDOG_SCRIPT"
log "Watchdog script installed at $WATCHDOG_SCRIPT"

# ── Write Super Agent Skill ────────────────────────────────────────────────

cat > "$SKILL_DIR/SKILL.md" << SKILLEOF
---
name: dashboard-command-center
description: Next.js Dashboard as commanding center for AI agent - tasks, sub-agents, heartbeat
---

# Dashboard Command Center

## Production Behavior

### Core Agent Identity
The main orchestrator is called **${AGENT_NAME}**.

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
SKILLEOF

log "Super Agent skill installed"

# ── Setup Cron Jobs via Hermes ─────────────────────────────────────────────

info "============================================"
info "MANUAL STEP: Configure Cron Jobs"
info "============================================"
echo ""
echo "Now you need to register two cron jobs using the Hermes CLI."
echo "If you're reading this in the terminal, follow these steps:"
echo ""
echo "---"
echo ""
echo "STEP 1: Create the Super Agent Orchestrator"
echo ""
echo 'hermes cron create \'
echo '  --name "Super Agent Orchestrator" \'
echo '  --schedule "every 2m" \'
echo '  --deliver "'"$DELIVER_TARGET"'" \'
echo '  --skill dashboard-command-center \'
echo '  --prompt "$(cat << '\''PROMPT'\''"'
echo ''
echo 'You are '"$AGENT_NAME"', the Super Agent. Your core principle: REUSE existing agents instead of creating new ones.'
echo ''
echo 'TOOLS: terminal (curl), delegate_task.'
echo ''
echo '## CORE RULE - Agent Reuse First'
echo 'NEVER create a new agent if an existing idle agent can handle the task.'
echo 'Match agents by name, role, and skills. Agents gain experience through repetition.'
echo ''
echo '## STUCK MISSION RECOVERY'
echo '- Check missions stuck in analyzing/assigning/in_progress'
echo '- Free agents stuck as busy for >30 min'
echo '- Fail orphaned tasks'
echo ''
echo '## WORKFLOW'
echo 'Phase A: Find pending mission'
echo 'Phase B: Analyze & REUSE existing agents'
echo 'Phase C: Create tasks for reused agents'
echo 'Phase D: Execute max 2 tasks via delegate_task'
echo 'Phase E: Complete mission with summary'
echo ''
echo '## SILENT MODE'
echo 'If nothing happened, output [SILENT]'
echo '\'\''PROMPT'\'''" 
echo ''
echo "---"
echo ""
echo "STEP 2: Create the Dashboard Watchdog"
echo ""
echo 'hermes cron create \'
echo '  --name "Dashboard Watchdog" \'
echo '  --schedule "every 2m" \'
echo '  --deliver "local" \'
echo '  --script dashboard_watchdog.py \'
echo '  --prompt "You are the Dashboard Watchdog. Report if the script shows issues."'
echo ""
echo "---"
echo ""
echo "STEP 3: Verify"
echo ""
echo "hermes cron list"
echo ""
echo "---"

# ── Start Dashboard ────────────────────────────────────────────────────────

echo ""
info "Starting Dashboard..."
echo ""

if command -v npx &>/dev/null; then
    cd "$PROJECT_DIR"
    nohup npx next dev -p 3000 > dev.log 2>&1 &
    DASH_PID=$!
    log "Dashboard starting (PID $DASH_PID) on http://localhost:3000"
else
    warn "npx not available — start the dashboard manually:"
    echo "  cd $PROJECT_DIR && npm run dev"
fi

# ── Done ───────────────────────────────────────────────────────────────────

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Setup Complete!                                  ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Dashboard:${NC}      http://localhost:3000"
echo -e "${GREEN}API Base:${NC}       http://localhost:3000/api"
echo ""
echo -e "${YELLOW}── Agent Behavior Summary ─────────────────────────${NC}"
echo ""
echo "  Your main agent \"$AGENT_NAME\" will:"
echo "  ✅ REUSES existing agents — never creates new if idle match exists"
echo "  ✅ Agents gain experience through repetition"
echo "  ✅ Auto-recovery from stuck missions (every 10 min check)"
echo "  ✅ Error handling — failed tasks don't freeze the system"
echo "  ✅ Silent mode — no spam when idle"
echo "  ✅ Dashboard watchdog — auto-restarts if crashes"
echo ""
echo -e "${YELLOW}── Required to complete ───────────────────────────${NC}"
echo ""
echo "  1. Add your API keys to .env"
echo "  2. Install Hermes Agent: https://github.com/NazmulsTech/Hermes"
echo "  3. Run the two 'hermes cron create' commands shown above"
echo "  4. Open http://localhost:3000 and create your first mission!"
echo ""
