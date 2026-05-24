# gh-dashboard

![screenshot](https://img.shields.io/badge/status-active-brightgreen)

A personal, unified GitHub dashboard. View workflow runs, pull requests, issues, repository health, CI status, and engineering metrics across multiple repos from a single interface.

**Inspired by**: [Port.io](https://port.io) (developer portal) and [OpsLevel](https://opslevel.com) (service catalog).

---

## Quick Start

```bash
npm install
npm run dev
```

This starts:
- **Vite dev server** → [http://localhost:5173](http://localhost:5173)
- **API proxy** → [http://localhost:3001](http://localhost:3001)

> Requires `gh` CLI authenticated: `gh auth login`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Data | TanStack Query — polling, caching, stale-while-revalidate |
| Styling | Tailwind CSS v4 (Vite plugin) |
| Icons | Lucide React |
| Server | Fastify + `@fastify/cors` (dev proxy) |
| Auth | GitHub CLI token via `gh auth token` |

---

## Pages

| Page | Route | What it does |
|------|-------|-------------|
| **Overview** | `/` | "Plan My Day" widget, pinned repos, scorecards, activity feed |
| **CI Health** | `/ci-health` | Workflow pass/fail rates, flaky detection, run times |
| **Review Queue** | `/review-queue` | PRs pending your review with inline diffs and urgency scoring |
| **Pull Requests** | `/pull-requests` | Cross-repo PR list with review badges, CI status dots, filters |
| **Issues** | `/issues` | Cross-repo issue tracker with labels and create dialog |
| **Notifications** | `/notifications` | Scored inbox with multi-account thread grouping |
| **Actions** | `/actions` | Workflow runs grouped by repo with live status + AI diagnose |
| **Repositories** | `/repositories` | Catalog grid with language badges, CI status, PR previews |
| **Security** | `/security` | Dependabot alerts across repos with severity breakdown |
| **Insights** | `/insights` | Engineering metrics — PR cycle time, deploy frequency, review turnaround |
| **Kanban** | `/kanban` | GitHub Projects v2 boards with drag-free column view |
| **Digest** | `/digest` | Daily/weekly diff — new PRs, merged, opened issues |
| **Settings** | `/settings` | Auth status, auto-refresh, AI assistant config, desktop notifications |

---

## Project Structure

```
gh-dashboard/
├── server/                  # Fastify proxy (dev only)
│   ├── index.ts             # Routes, CORS, startup
│   ├── auth.ts              # gh CLI token resolution
│   ├── accountStore.ts      # Multi-account management
│   ├── ai-troubleshooter.ts # AI-powered workflow diagnosis
│   ├── digests.ts           # Daily/weekly delta computation
│   ├── metrics.ts           # Engineering metrics (cycle time, etc.)
│   └── snapshots.ts         # Daily state snapshots
├── src/
│   ├── components/
│   │   ├── layout/          # Sidebar + top bar shell, desktop notifications
│   │   ├── repositories/    # Repo detail modal with 8 tabs
│   │   ├── triage/          # Notification preview panel
│   │   ├── insights/        # Health pill, insight cards
│   │   ├── ui/              # AuthorAvatar, Badge, StatCard, StatusDot
│   │   ├── CommandPalette.tsx
│   │   └── KeyboardShortcutsHelp.tsx
│   ├── hooks/               # TanStack Query wrappers, localStorage, keyboard shortcuts
│   ├── lib/                 # API client, scoring, insights, digests, utils
│   ├── contexts/            # Account provider
│   ├── pages/               # 13 route pages
│   ├── App.tsx
│   └── main.tsx
├── docs/                    # Agent memory setup, validation guides
├── validation/              # Browser tests, type-check reports
├── tools/                   # Audit scripts
├── scripts/                 # Hindsight/beads bootstrap helpers
├── .cursor/                 # Cursor agent config + hooks
├── AGENTS.md                # Agent routing rules (context-mode)
├── CLAUDE.md                # Agent project instructions
└── GEMINI.md                # Antigravity routing rules
```

---

## Authentication

The proxy reads `gh auth token` on startup. No OAuth app, no manual PAT copying.

```bash
# Verify you're logged in
gh auth status

# If not, log in
gh auth login
```

The token is **never exposed to the browser**. The proxy attaches it to all GitHub API requests server-side.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Concurrent: proxy + Vite |
| `npm run dev:client` | Vite only |
| `npm run dev:server` | Proxy only |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |

---

## Agent Setup

This repo is configured for AI coding agents (Claude Code, Cursor, OpenCode, Pi, Gemini/Antigravity):

- **context-mode** — context-window protection across all agents (`AGENTS.md`, `GEMINI.md`, `.cursor/rules/context-mode.mdc`)
- **Beads** (`bd`) — local issue tracker at `.beads/`
- **Hindsight** — cross-session agent memory (server on `localhost:8888`)

See `docs/agent-memory-setup.md` for full configuration details.

---

## License

MIT
