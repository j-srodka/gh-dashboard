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

## Integrations

Issue tracking, memory, code intelligence, and context routing are documented in `.cursor/rules/` (`beads.mdc`, `agentmemory.mdc`, `codegraph.mdc`). Use those files instead of repeating setup here.

## Shell commands

Prefix shell, git, and GitHub CLI commands with `rtk` when available. Cursor rewrites `Shell` tool calls via `~/.cursor/hooks/rtk-rewrite.sh`.

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** — Create issues for anything that needs follow-up (`bd create` — see `.cursor/rules/beads.mdc`)
2. **Run quality gates** (if code changed) — Tests, linters, builds
3. **Update issue status** — Close finished work, update in-progress items
4. **PUSH TO REMOTE** — This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** — Clear stashes, prune remote branches
6. **Verify** — All changes committed AND pushed
7. **Hand off** — Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
