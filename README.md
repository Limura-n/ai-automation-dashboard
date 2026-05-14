# Adobe Stock Mission Control

Multi-agent AI orchestration dashboard for automating Adobe Stock content production. Built with Next.js 16, Bun, Prisma + SQLite, shadcn/ui, and Hermes Agent integration.

![Stack](https://img.shields.io/badge/Next.js-16-000?logo=next.js)
![Bun](https://img.shields.io/badge/Bun-1.2-000?logo=bun)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite)

---

## Features

- **Mission Control Dashboard** — Glassmorphic dark UI with KPIs, charts, task management
- **Super Agent Orchestration** — AI-powered sub-agent hiring and delegation
- **Terminal Chat** — Talk to the Super Agent through a built-in terminal
- **Telegram Bot** — Manage missions from Telegram (@limura_n_bot)
- **File Upload** — Attach reference files to missions
- **SQLite Database** — Zero-config, portable, backed up with everything else

## Quick Start

### Linux / macOS

```bash
# 1. Unzip & enter
cd AdobeStockMissionControl

# 2. Run setup (checks deps, installs, builds DB)
bash setup.sh

# 3. Edit your API keys
nano .env

# 4. Start
bun run dev
# -> http://localhost:3000
```

### Windows (PowerShell)

```powershell
# 1. Unzip & enter
cd AdobeStockMissionControl

# 2. Run setup (checks deps, installs, builds DB)
powershell -ExecutionPolicy Bypass -File setup.ps1

# 3. Edit your API keys
notepad .env

# 4. Start
bun run dev
# -> http://localhost:3000
```

> **No PowerShell?** Use Git Bash or WSL and follow the Linux steps with `bash setup.sh`.

## Prerequisites

| Tool | Version | Why |
|------|---------|-----|
| **Node.js** | v18+ | Next.js runtime |
| **Bun** | 1.2+ | Package manager & worker runner (faster, optional but recommended) |
| **npx** | ships with Node | Prisma CLI |

Check with:

```bash
node -v   # need v18+
bun -v    # optional but recommended
```

## Architecture

```
┌──────────────────────────────────────────┐
│          Browser (http://localhost:3000) │
└─────────────────┬────────────────────────┘
                  │
┌─────────────────▼────────────────────────┐
│        Next.js Dashboard (port 3000)     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ Missions │ │ Terminal │ │ Reports  │ │
│  │ Dashboard│ │ Chat     │ │ & Stats  │ │
│  └────┬─────┘ └────┬─────┘ └──────────┘ │
└───────┼────────────┼─────────────────────┘
        │            │
┌───────▼────────────▼─────────────────────┐
│         Prisma + SQLite Database         │
│  Missions │ AgentTasks │ SubAgents       │
└──────────────────────────────────────────┘

        ┌─────────────────────────┐
        │  Hermes Gateway (port  │
        │  8000) — AI Backend    │
        └────────────────────────┘

        ┌─────────────────────────┐
        │  Telegram Bot           │
        │  (optional)             │
        └─────────────────────────┘

        ┌─────────────────────────┐
        │  Super Agent Cron       │
        │  (every 2 min)          │
        └─────────────────────────┘
```

## What's Portable

Everything in this folder is a standard Next.js app. Any developer can:

```bash
cp .env.example .env
# paste their own API keys
bun install
npx prisma db push
bun run dev
```

Or use the setup script:

- **Linux/macOS:** `bash setup.sh`
- **Windows:** `powershell -ExecutionPolicy Bypass -File setup.ps1`

The dashboard, database schema, API routes, and UI are all self-contained.

## What Needs Reconfiguration

### 1. API Keys (`.env`)

| Variable | Where to Get It |
|----------|----------------|
| `OPENCODE_GO_API_KEY` | https://opencode.ai/auth |
| `OPENROUTER_API_KEY` | https://openrouter.ai (optional) |
| `TELEGRAM_BOT_TOKEN` | @BotFather on Telegram (optional) |

### 2. Hermes Gateway (AI Backend)

The Terminal Chat and Super Agent talk to a local Hermes Agent instance via HTTP.

**To set up your own:**

```bash
# Clone Hermes Agent
git clone https://github.com/NazmulsTech/Hermes ~/Hermes
cd ~/Hermes

# Install & start the gateway
# (Refer to Hermes docs — the gateway listens on port 8000)
```

Then update `HERMES_BASE_URL` in `.env` if your gateway runs on a different port.

### 3. Super Agent Cron

The worker (`mini-services/task-worker/`) polls for new missions and dispatches them to AI sub-agents. It needs to run every 2 minutes.

**To set up the cron job:**

```bash
# Edit crontab
crontab -e

# Add this line (adjust paths as needed):
*/2 * * * * cd /path/to/AdobeStockMissionControl && bun run worker >> worker.log 2>&1
```

This requires:
- The Hermes Gateway to be running
- Valid API keys in `.env`

### 4. Telegram Bot

The dashboard can receive commands from Telegram. To make your own:

1. Open Telegram, search for **BotFather**
2. Send `/newbot` and follow the prompts
3. Copy the token it gives you
4. Add `TELEGRAM_BOT_TOKEN="your:token"` to `.env`
5. Restart the dashboard

### 5. WebSocket Service (optional)

For real-time dashboard updates:

```bash
# In a separate terminal:
bun run ws-service
```

## Project Structure

```
Adobe Stock Mission Control/
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── db/                # SQLite database files
├── src/
│   ├── app/               # Next.js pages & API routes
│   │   ├── api/           # All REST endpoints
│   │   └── (dashboard)/   # Dashboard pages
│   ├── components/        # React components
│   └── lib/               # Utilities, hooks
├── mini-services/
│   ├── task-worker/       # Super Agent task dispatcher
│   └── ws-service/        # WebSocket for real-time updates
├── skills/                # Sub-agent skill definitions
├── public/                # Static assets
├── upload/                # File uploads
├── download/              # Generated content
├── setup.sh               # One-command setup
├── .env.example           # Environment template
├── hermes-bridge.js       # Hermes HTTP bridge (port 8000)
└── Caddyfile              # Optional reverse proxy config
```

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/missions` | GET | List all missions |
| `/api/missions` | POST | Create a mission |
| `/api/missions/:id` | GET | Mission details |
| `/api/missions/:id` | DELETE | Delete a mission |
| `/api/agent/tasks` | GET | List agent tasks |
| `/api/agent/tasks` | POST | Create/assign a task |
| `/api/stats` | GET | Dashboard statistics |
| `/api/chart-data` | GET | Chart data series |
| `/api/recent-activity` | GET | Recent activity feed |

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev server (port 3000) |
| `bun run build` | Production build |
| `bun run start` | Start production server |
| `bun run worker` | Run Super Agent task worker |
| `bun run ws-service` | Start WebSocket service |
| `npx prisma studio` | Open DB browser |
| `npx prisma db push` | Sync schema to DB |

## FAQ

**Q: Can I use npm instead of Bun?**
Yes. The setup script detects Bun and falls back to npm. All `bun run` commands work as `npm run` too.

**Q: Does the dashboard work without Hermes/Telegram?**
Yes. It functions as a standalone task management UI. The Terminal Chat and Super Agent features simply won't connect.

**Q: How do I reset the database?**
```bash
rm -rf prisma/db/
npx prisma db push
```

**Q: Can I use Postgres instead of SQLite?**
Yes. Update `DATABASE_URL` in `.env` and run `npx prisma db push`.
