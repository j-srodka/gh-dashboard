# Agent Memory Validation Guide

This document provides step-by-step instructions to validate that each configured agent can access Hindsight memory and Beads issues.

## Prerequisites

1. Hindsight server is running:
   ```bash
   ./scripts/start-hindsight.sh status
   ```
2. Hindsight CLI is installed and banks are created:
   ```bash
   ./scripts/hindsight-bootstrap.sh
   ```
3. Test memory is retained (done by bootstrap script):
   - Bank `jake-preferences`: "Jake prefers minimal involvement, durable project automation, repo-local enforcement where possible, and no secrets stored in memory."
   - Bank `gh-dashboard`: "This repo uses Beads as source of truth for agent task state."

## Known Issues

### Claude Code PATH

**Symptom:** Claude Code reports "Hindsight API at localhost:8888 is down" or "hindsight command not found".

**Fix:** Hooks now use full binary path `/Users/jsrodka/.local/bin/hindsight` + `HINDSIGHT_API_URL=http://127.0.0.1:8888`. Restart Claude Code for changes to take effect.

### Codex Localhost Resolution

**Symptom:** Codex reports "Hindsight API at localhost:8888 is down" even though the server is running.

**Root cause:** Codex may run in a sandboxed process where `localhost:8888` does not resolve to the host machine.

**Fix:** Use `127.0.0.1:8888` explicitly with the `HINDSIGHT_API_URL` env var. The Codex skill, hooks, and AGENTS.md have all been updated with this workaround.

**Re-test Codex:**
```bash
cd /Users/jsrodka/Github/gh-dashboard
codex
```
Then type `$beads-hindsight` and paste the validation prompt.

### OpenCode MCP

**Symptom:** OpenCode fails to start with `Configuration is invalid` or MCP errors.

**Fix:** OpenCode only supports `local`/`remote` MCP types, not `http`. Hindsight MCP entry removed from `opencode.jsonc`. Use CLI fallback.

## Test Data

### Hindsight Test Memory

**Bank: `jake-preferences`**
- Content: "Jake prefers minimal involvement, durable project automation, repo-local enforcement where possible, and no secrets stored in memory."

**Bank: `gh-dashboard`**
- Content: "This repo uses Beads as source of truth for agent task state."

### Beads Test Issue

Created by `bd init`. ID: `gh-dashboard-t3d`
- Title: "Validate cross-agent memory and task workflow"
- Description: "Each configured agent must recall Hindsight context, inspect/update this Beads issue, and report whether enforcement works."

---

## Validation Prompt

Use this exact prompt in each tool:

```
Before doing any work, recall relevant Hindsight memory for this repo and user.
Then inspect Beads for ready or active issues.
Find the issue titled "Validate cross-agent memory and task workflow".
Report:
1. What Hindsight memories you recalled (bank names + content summaries)
2. What Beads issue you found (ID + title)
3. What integration path you used (MCP, hooks, skill, or manual CLI)
4. Whether you were able to update the Beads issue
5. Any gaps or errors encountered
Do not make code changes.
```

## Per-Tool Validation

### Claude Code

**Launch:**
```bash
cd /Users/jsrodka/Github/gh-dashboard
claude
```

Hooks should fire automatically at session start. If Hindsight fails, restart Claude Code completely.

### Cursor

**Launch:** Open Cursor IDE → open `gh-dashboard` → paste validation prompt.

MCP panel should show `hindsight` server. Use explicit `bank_id` in tool calls.

### OpenCode

**Launch:**
```bash
cd /Users/jsrodka/Github/gh-dashboard
opencode
```

Use explicit CLI fallback — OpenCode does not support HTTP-type MCP:
```
Run these commands and report the output:
1. /Users/jsrodka/.local/bin/hindsight memory recall jake-preferences "What are Jake coding preferences?"
2. /Users/jsrodka/.local/bin/hindsight memory recall gh-dashboard "What are recent project decisions?"
3. bd ready
4. bd show gh-dashboard-t3d
Then update gh-dashboard-t3d with your validation result.
```

### Codex

**Launch:**
```bash
cd /Users/jsrodka/Github/gh-dashboard
codex
```

**Trigger skill:**
```
$beads-hindsight
```

Then paste the validation prompt.

**If Hindsight fails:** The skill now uses `127.0.0.1:8888` explicitly. If it still fails, Codex may be fully network-isolated. Use the manual fallback:
```
Run these commands and report the output:
1. HINDSIGHT_API_URL=http://127.0.0.1:8888 /Users/jsrodka/.local/bin/hindsight memory recall jake-preferences "What are Jake coding preferences?"
2. HINDSIGHT_API_URL=http://127.0.0.1:8888 /Users/jsrodka/.local/bin/hindsight memory recall gh-dashboard "What are recent project decisions?"
3. bd ready
4. bd show gh-dashboard-t3d
Then update gh-dashboard-t3d with your validation result.
```

### PI

**Launch:**
```bash
cd /Users/jsrodka/Github/gh-dashboard
pi
```

Paste the validation prompt with explicit CLI instructions.

---

## Troubleshooting

### Hindsight server not responding
- Check: `curl http://127.0.0.1:8888/health`
- Start: `./scripts/start-hindsight.sh`
- Logs: `./scripts/start-hindsight.sh logs`

### MCP connection refused
- Ensure server is running before launching agent.
- Cursor MCP URL: `http://localhost:8888/mcp/` (multi-bank)
- OpenCode: does not support HTTP MCP — use CLI

### Beads workspace not found
- Ensure you are in repo root.
- Run `bd init` if `.beads/` is missing.

### beads.role warning
- Set: `git config beads.role maintainer`
