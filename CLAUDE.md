# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

## Build & Test

```bash
npm install
npm run dev        # Starts Vite dev server + Fastify proxy concurrently
```

## Architecture Overview

Personal GitHub dashboard. React 19 + TypeScript + Vite frontend. TanStack Query for all GitHub API data. Fastify proxy server reads gh auth token server-side. Tailwind CSS v4 for styling.

## Conventions & Patterns

- Use TypeScript strictly. Prefer explicit types over inference for public APIs.
- Use TanStack Query for all remote data. Set appropriate staleTime and refetchInterval.
- Custom UI components in `src/components/ui/` — no external component library.
- Server-side proxy handles all GitHub API auth. Frontend never sees tokens.
- Pages in `src/pages/`, hooks in `src/hooks/`, shared lib in `src/lib/`.

---

<!-- BEGIN BEADS + HINDSIGHT INTEGRATION -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Hindsight Memory

This project uses **Hindsight** for persistent long-term agent memory.

> Hindsight server must be running on `localhost:8888`. Start with `./scripts/start-hindsight.sh` or `hindsight server start`.

### Session Start (MANDATORY)

Recall relevant memories before starting work:

```bash
hindsight memory recall jake-preferences "What are Jake coding preferences and conventions?"
hindsight memory recall gh-dashboard "What are the project architecture and recent decisions?"
```

Or via the MCP tool if available:
- `hindsight_recall` with bank `jake-preferences` or `gh-dashboard`

### Session End (MANDATORY)

Retain durable learnings:

```bash
hindsight memory retain gh-dashboard "Decision: <what> Rationale: <why>"
hindsight memory retain jake-preferences "Jake preference: <topic>"
```

### Safety

- NEVER store secrets, tokens, or credentials in Hindsight
- Prefer project bank for repo facts, personal bank for user preferences

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **Retain Hindsight memory** — Summarize learnings, decisions, pitfalls
2. **File issues for remaining work** — Create issues for anything that needs follow-up
3. **Run quality gates** (if code changed) — Tests, linters, builds
4. **Update issue status** — Close finished work, update in-progress items
5. **PUSH TO REMOTE** — This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
6. **Clean up** — Clear stashes, prune remote branches
7. **Verify** — All changes committed AND pushed
8. **Hand off** — Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

<!-- END BEADS + HINDSIGHT INTEGRATION -->
