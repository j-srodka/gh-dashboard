# Agent Memory Setup

This document describes the Hindsight and Beads configuration across all AI coding tools.

## What Was Installed

### Beads (`bd`)
- Already installed via Homebrew: `bd version 1.0.4`
- Initialized in repo: `/Users/jsrodka/Github/gh-dashboard/.beads/`
- Backend: embedded Dolt
- Issue prefix: `gh-dashboard`

### Hindsight
- Running via **Docker Compose** (recommended)
- Server: `http://localhost:8888` (API + MCP)
- Control Plane: `http://localhost:9999` (Web UI)
- Config: `.env` (gitignored credentials)
- Persistent volume: `hindsight-data`

## Quick Start

### 1. Configure credentials

```bash
cp .env.example .env
# Edit .env and add your API key
```

### 2. Start the server

```bash
./scripts/start-hindsight.sh
```

Or manually:
```bash
docker compose up -d
```

### 3. Verify it's running

```bash
./scripts/start-hindsight.sh status
# or
curl http://localhost:8888/health
```

### 4. Create memory banks

```bash
# Install Hindsight CLI first (one-time)
curl -fsSL https://hindsight.vectorize.io/get-cli | bash

# Create banks
hindsight bank create jake-preferences
hindsight bank create gh-dashboard
```

### 5. Seed test memories

```bash
hindsight memory retain jake-preferences \
  "Jake prefers minimal involvement, durable project automation, repo-local enforcement where possible, and no secrets stored in memory."

hindsight memory retain gh-dashboard \
  "This repo uses Beads as source of truth for agent task state."
```

## Which Tools Are Configured

| Tool | Version | Hindsight Config | Beads Config |
|------|---------|-----------------|--------------|
| Claude Code | 2.1.143 | Repo hooks (`~/.claude/` + repo `.claude/settings.json`) | Hooks (`bd prime`) |
| Cursor | unknown | MCP server (`~/.cursor/mcp.json`) | Project rules (`.cursor/rules/beads-hindsight.mdc`) |
| OpenCode | 1.15.4 | MCP server (`~/.config/opencode/opencode.jsonc`) | AGENTS.md instructions |
| Codex | 0.131.0-alpha.9 | Skill (`~/.codex/skills/beads-hindsight/`) | Skill instructions |
| PI | 0.74.0 | Skill + CLI wrapper (no MCP) | Skill instructions |
| Zed | not installed | Via external agent config | Via external agent config |

## Which Config Files Were Changed

### Repo-level (travel with the repo)
- `AGENTS.md` — Unified cross-agent instructions (Hindsight + Beads workflow)
- `CLAUDE.md` — Project instructions with Hindsight + Beads rules
- `.claude/settings.json` — Claude Code hooks (SessionStart, PreCompact)
- `.cursor/rules/beads-hindsight.mdc` — Cursor project rules
- `.cursor/rules/beads.mdc` — Existing Beads rules (from `bd setup cursor`)
- `docker-compose.yml` — Hindsight Docker Compose definition
- `.env.example` — Template for Hindsight credentials
- `.beads/` — Beads workspace (Dolt DB, config, hooks)

### User-level (per-machine)
- `~/.cursor/mcp.json` — Cursor MCP servers (Hindsight + Beads)
- `~/.config/opencode/opencode.jsonc` — OpenCode MCP servers
- `~/.codex/skills/beads-hindsight/SKILL.md` — Codex skill
- `~/.codex/config.toml` — Codex skill auto-load reference
- `~/.pi/agent/extensions/beads-hindsight/README.md` — PI skill docs

## How Enforcement Works Per Tool

### Claude Code — Hard
- **SessionStart hook** runs `bd prime` + `hindsight memory recall` automatically at every session start.
- **PreCompact hook** runs `bd prime` + `hindsight memory retain` before compaction.
- Agent cannot skip these — they run as lifecycle hooks.

### Cursor — Medium
- **MCP tools**: `hindsight_recall` and `hindsight_retain` are available in chat/agent.
- **Project rules**: `.cursor/rules/beads-hindsight.mdc` instructs the agent to use them.
- Agent may forget — rules are soft enforcement via prompt injection.

### OpenCode — Medium
- **MCP servers**: Hindsight and Beads exposed via `opencode.jsonc`.
- **AGENTS.md**: Read at session start. Instructs agent to recall/retain.
- MCP availability depends on the server running.

### Codex — Medium
- **Skill**: `beads-hindsight` skill loaded from `~/.codex/skills/`.
- **Config**: `config.toml` references the skill path.
- Skill may need explicit `$beads-hindsight` trigger on first use.

### PI — Soft
- **No MCP support** — PI explicitly does not support MCP.
- **Skill**: Can be loaded as a PI skill/extension.
- **CLI wrapper**: Agents can run `bd` and `hindsight` CLI commands directly.
- Enforcement is manual — agent must be instructed to use them.

### Zed — Soft
- **Not installed** on this machine.
- When installed, configure via external agents (Claude Agent, Codex, etc.)
- The external agents will pick up their own Hindsight/Beads configs.

## Environment Variables

All Hindsight configuration lives in `.env` (gitignored):

| Variable | Description | Default |
|----------|-------------|---------|
| `HINDSIGHT_API_LLM_PROVIDER` | LLM provider | `openrouter` |
| `HINDSIGHT_API_LLM_API_KEY` | API key for provider | *(required)* |
| `HINDSIGHT_API_LLM_MODEL` | Model slug | `google/gemma-4-9b-it` |
| `HINDSIGHT_API_LLM_BASE_URL` | Custom base URL | *(provider default)* |
| `HINDSIGHT_API_RETAIN_MAX_COMPLETION_TOKENS` | Token limit for retain | `32000` |

## How to Add a New Harness Later

1. Check if the tool supports MCP:
   - Yes → Add MCP server entry pointing to `http://localhost:8888/mcp/{bank_id}/`
   - No → Add skill/rules/AGENTS.md instructions
2. Check if `bd setup <tool>` exists:
   - Yes → Run it
   - No → Add manual instructions to AGENTS.md
3. Update `docs/agent-memory-setup.md` and `AGENTS.md` with the new tool.

## Known Gaps

1. **Codex skill not always auto-loaded** — May need `$beads-hindsight` trigger on first use.
2. **PI has no MCP** — Integration is CLI-only or skill-based.
3. **Zed not installed** — configure once installed.
4. **OpenCode MCP for Hindsight** — Currently configured as a local command. If this doesn't work as an MCP server, switch to HTTP type pointing to `http://localhost:8888/mcp/`.
