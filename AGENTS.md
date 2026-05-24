# gh-dashboard

A personal, unified GitHub dashboard. View workflow runs, pull requests, issues, and repository health across multiple repos from a single interface. Inspired by the design language of Port.io (developer portal) and OpsLevel (service catalog).

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | React 19 + TypeScript + Vite | Modern, fast DX, huge ecosystem. Maps cleanly from our existing HTML mock. |
| **State/Data** | TanStack Query (React Query) | Built-in polling, caching, stale-while-revalidate. Perfect for real-time GitHub API data. Port.io uses this. |
| **UI Components** | shadcn/ui + Tailwind CSS | Premium, accessible components (table, command palette, dialog) with zero design-system maintenance. |
| **Icons** | Lucide React | Same icon set used in the HTML mock. Clean, consistent. |
| **Backend Proxy** | Node.js + Fastify (tiny) | Reads `gh auth token` and proxies GitHub API calls. Token stays server-side. |
| **Auth** | GitHub CLI token | Zero setup for users who already use `gh`. No OAuth apps, no manual PAT copying. |

## Why This Stack

1. **Minimal setup**: If you have `gh` installed and logged in, you're authenticated. One `npm run dev` starts everything.
2. **Real-time feel**: TanStack Query's `refetchInterval` gives live-updating CI status without manual refresh.
3. **Premium UI**: shadcn/ui components look like Linear/Vercel out of the box - no designer needed.
4. **Type-safe**: GitHub's REST API has `@octokit/rest` types. Full end-to-end TypeScript.

## Auth Strategy

The proxy server reads `gh auth token` on startup:

```typescript
// server/auth.ts
import { execSync } from 'child_process';

export function getGitHubToken(): string {
  // Priority: GH_TOKEN env var → gh CLI → error with helpful message
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  try {
    return execSync('gh auth token', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch {
    throw new Error(
      'No GitHub token found. Run "gh auth login" or set GH_TOKEN env var.'
    );
  }
}
```

The proxy attaches this token to all outgoing GitHub API requests. The browser never sees it.

## Project Structure

```
gh-dashboard/
├── src/
│   ├── components/
│   │   ├── layout/          # Sidebar, top bar, page shell
│   │   ├── overview/        # Plan My Day widget, scorecards, activity feed
│   │   ├── repositories/    # Repo catalog grid, filter bar
│   │   ├── pull-requests/   # Unified PR list, filters, inline actions
│   │   ├── actions/         # Workflow runs, grouped by repo
│   │   ├── issues/          # Cross-repo issue tracker
│   │   └── rules-agents/    # Rulesets, reusable workflows, compliance scorecard
│   ├── hooks/
│   │   └── useGitHubQuery.ts  # TanStack Query wrapper for GitHub API
│   ├── lib/
│   │   ├── api.ts           # Proxy API client (frontend → local server)
│   │   ├── github-types.ts  # Shared types from @octokit/rest
│   │   └── utils.ts         # Formatting, filtering helpers
│   ├── App.tsx
│   └── main.tsx
├── server/
│   ├── index.ts             # Fastify proxy server
│   ├── auth.ts              # gh CLI token resolution
│   └── github-proxy.ts      # API route handlers
├── github-dashboard.html    # Original HTML mock (reference only)
└── package.json
```

## Running Locally

```bash
cd gh-dashboard
npm install
npm run dev        # Starts Vite dev server + Fastify proxy concurrently
```

## What Port.io & OpsLevel Use

| Platform | Frontend | Notes |
|----------|----------|-------|
| **Port.io** | React 19 + TypeScript + TanStack React Query + Webpack 5 | Migrated core from Python to TypeScript. S3/CloudFront frontend. |
| **OpsLevel** | Vue.js (main app) + React/TypeScript (public plugins) | Ruby on Rails backend, GraphQL API, MySQL + Redis. MUI v6 + Emotion for Backstage plugin. |

Our stack aligns with Port.io's frontend choices while keeping the backend proxy minimal (their backend is much heavier).

## Agent Skills

### Issue tracker

Issues are tracked locally via Beads (bd), a Dolt-backed project-local tracker synced via git refs. See `docs/agents/issue-tracker.md`.

### Triage labels

Five roles mapped to default label strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo. One `CONTEXT.md` at the root + `docs/adr/` for architectural decisions. See `docs/agents/domain.md`.

### Installed skills

- `tdd` — Test-driven development for API layer

---

<!-- BEGIN CROSS-AGENT MEMORY AND TASK WORKFLOW -->
# Cross-Agent Memory & Task Workflow

## Overview

This repo uses two complementary systems for agent memory and task tracking:

1. **Hindsight** — Persistent long-term memory bank. Agents recall context at session start and retain durable learnings at session end.
2. **Beads (bd)** — Git-backed project-local issue tracker. Agents check beads before starting work and update them as task state changes.

## Safety Rules

- **NEVER store secrets, tokens, API keys, or credentials in Hindsight memory.**
- **NEVER use ad-hoc markdown TODOs as the source of truth** when Beads is available.
- Prefer the **project bank** for repo-specific facts and the **personal/global bank** for user preferences.

## Memory Tool Enforcement

- **Hindsight is the only memory tool for cross-session persistence.** Use `hindsight memory retain` and `hindsight memory recall` for all memory operations.
- **`ctx_memory` is FORBIDDEN for memory storage.** It is part of Magic Context's context-windowing system only.
  - Allowed: `ctx_reduce`, `ctx_expand`, `ctx_note`, `ctx_search` — these manage the session context window.
  - Forbidden: `ctx_memory write`, `ctx_memory delete` — these bypass Hindsight and fragment project memory.
- **PI agents**: The `ctx_memory` tool is available but must NOT be called. Use the `hindsight` CLI for all memory operations.
- **All agents**: If you see `ctx_memory` calls from a previous session, ignore and delete those memories — they are stale.

---

## Hindsight Workflow

### At Session Start (MANDATORY)

1. **Recall** relevant Hindsight memory for:
   - User: Jake Srodka — preferences, conventions, past decisions
   - Repo: gh-dashboard — project facts, architecture, pitfalls
   - Current task — context from previous sessions
   - Active Beads issue — if working on one

2. **Integration paths by tool:**
   - **Claude Code**: Hooks run `hindsight memory recall` at SessionStart (full binary path + `HINDSIGHT_API_URL=http://127.0.0.1:8888`)
   - **Cursor**: MCP tool `hindsight_recall` with explicit `bank_id` (multi-bank endpoint at `http://localhost:8888/mcp/`)
   - **OpenCode**: CLI fallback only (`hindsight memory recall`). OpenCode does not support HTTP-type MCP.
   - **Codex**: Skill `$beads-hindsight` + CLI fallback with explicit `HINDSIGHT_API_URL=http://127.0.0.1:8888` and full binary path. Codex may run in a sandboxed process where `localhost:8888` does not resolve.
   - **PI**: CLI fallback only (`hindsight memory recall`). No MCP support.

### During Work

- Retain durable learnings **only when** they are likely useful later:
  - Architecture decisions and their rationale
  - Successful commands, build steps, or config patterns
  - Pitfalls encountered and how they were resolved
  - User preferences expressed during the session

### At Session End (MANDATORY)

1. Retain a summary of the session to Hindsight:
   - What was accomplished
   - Key decisions made
   - Open questions or blockers
   - Commands/patterns that worked
2. Close or update the active Beads issue.

### Hindsight Server

- **Local mode** (default): runs on `http://localhost:8888`
- **Startup**: run `./scripts/start-hindsight.sh` (requires LLM API key in `.env`)
- **Control Plane**: `http://localhost:9999`
- **Banks**:
  - `jake-preferences` — personal user bank
  - `gh-dashboard` — project/repo bank

---

## Beads (bd) Workflow

### At Session Start (MANDATORY)

1. Run `bd ready` to find unblocked work.
2. If you find a relevant bead, claim it: `bd update <id> --claim`
3. If no relevant bead exists, create one before starting nontrivial work.

### During Work

- **Discover new work?** Create a linked issue:
  ```bash
  bd create "Found bug" --description="Details" -p 1 --deps discovered-from:<parent-id>
  ```
- **Blocked?** Mark the bead blocked and add dependencies:
  ```bash
  bd update <id> --set-state blocked --reason "Waiting on API review"
  bd dep add <id> <blocks-on-id>
  ```

### At Session End (MANDATORY)

1. Update all beads you touched.
2. Close completed beads: `bd close <id> --reason "Done"`
3. Push beads sync if needed: `bd dolt push`

### Quick Reference

```bash
bd ready                          # Find unblocked work
bd show <id>                      # View issue details
bd update <id> --claim            # Claim work atomically
bd create "Title" -p 1 -t task    # Create new issue
bd close <id>                     # Mark complete
bd list --status=open             # List all open issues
bd prime                          # Full workflow context
```

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export.

---

## Tool-Specific Notes

| Tool | Hindsight Path | Beads Path | Enforcement |
|------|---------------|------------|-------------|
| Claude Code | Hooks (SessionStart/PreCompact) | Hooks (bd prime) | Hard |
| Cursor | MCP server (multi-bank) + CLI fallback | Project rules (.mdc) | Medium |
| OpenCode | CLI fallback only | AGENTS.md instructions | Medium |
| Codex | Skill + CLI fallback | Skill instructions | Medium |
| PI | Skill + CLI wrapper + AGENTS.md rules | Skill instructions + AGENTS.md rules | Medium |
| Zed | Via external agent | Via external agent | Soft |

### Known Gaps

1. **Codex localhost resolution**: Codex may run in a sandboxed process where `localhost:8888` does not resolve to the host. **Fix:** Always use `127.0.0.1:8888` with explicit `HINDSIGHT_API_URL` env var and full binary path (`/Users/jsrodka/.local/bin/hindsight`).
2. **OpenCode MCP**: OpenCode only supports `local` and `remote` MCP types, not `http`. Hindsight must be accessed via CLI.
3. **beads.role git config**: `bd` warns about unset `beads.role`. Set with: `git config beads.role maintainer`
4. **PI `ctx_memory` availability**: PI has `ctx_memory` via the `@cortexkit/pi-magic-context` package, which can bypass Hindsight. **Fix:** AGENTS.md rules forbid its use for memory. If it persists, consider removing the package (`pi remove npm:@cortexkit/pi-magic-context`) — but this also removes `ctx_reduce`/`ctx_expand`/`ctx_note`.

---

## Session Completion Checklist

**When ending a work session, complete ALL steps below.**

1. **Retain Hindsight memory** — Summarize learnings, decisions, pitfalls
2. **Update Beads** — Close finished work, update in-progress items
3. **Run quality gates** — Tests, linters, builds (if code changed)
4. **PUSH TO REMOTE** — This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Verify** — All changes committed AND pushed
6. **Hand off** — Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing
- NEVER say "ready to push when you are" — YOU must push
- If push fails, resolve and retry until it succeeds

<!-- END CROSS-AGENT MEMORY AND TASK WORKFLOW -->
