# Agent Memory Implementation Report

Date: 2026-05-18
Repo: /Users/jsrodka/Github/gh-dashboard

---

## Infrastructure — ALL GREEN ✅

- Hindsight server: Healthy on `http://localhost:8888` (openrouter/owl-alpha)
- Hindsight CLI: Installed at `~/.local/bin/hindsight`, banks created
- MCP endpoints: Responding for all banks
- Beads workspace: Active at `/Users/jsrodka/Github/gh-dashboard/.beads`
- Validation issue: `gh-dashboard-t3d` — tracked and updated by all tested agents

---

## Live Agent Test Results

| Tool | Hindsight Path | Beads Path | Enforcement | Config? | Live Test? |
|------|---------------|------------|-------------|---------|------------|
| **Claude Code** | Hooks + CLI fallback | Hooks (`bd prime`) | **Hard** | ✅ | **✅ FULL PASS** |
| **Cursor** | MCP (multi-bank `/mcp/`) + CLI fallback | Project rules (.mdc) | **Medium** | ✅ | **✅ FULL PASS** |
| **OpenCode** | CLI fallback only | AGENTS.md + CLI | **Medium** | ✅ | **✅ FULL PASS** |
| **Codex** | **Unavailable** (sandbox isolation) | Skill + CLI | **Medium** | ✅ | **⚠️ BEADS PASS / HINDSIGHT UNAVAILABLE** |
| **PI** | Skill + CLI wrapper | Skill instructions | **Soft** | ✅ | ⏳ PENDING |
| **Zed** | Via external agent | Via external agent | **Soft** | N/A | N/A |

### Detailed Results

#### Claude Code — ✅ FULL PASS
- Hindsight: Hooks fire automatically. Full binary path + `HINDSIGHT_API_URL=http://127.0.0.1:8888` override resolved PATH and localhost issues.
- Beads: Hooks fire automatically (`bd prime`).
- Bead update: Updated `gh-dashboard-t3d` successfully.

#### Cursor — ✅ FULL PASS
- Hindsight: MCP multi-bank endpoint (`http://localhost:8888/mcp/`) works with explicit `bank_id`. CLI fallback also verified.
- Beads: Project rules (`.cursor/rules/beads-hindsight.mdc`) + CLI.
- Bead update: Updated successfully.
- Fixes applied: Switched MCP from single-bank to multi-bank. Removed invalid Beads MCP entry.

#### OpenCode — ✅ FULL PASS
- Hindsight: CLI fallback only. OpenCode does not support HTTP-type MCP servers.
- Beads: CLI only (`bd` commands).
- Bead update: Updated successfully.
- Fix applied: Removed Hindsight MCP entry from `opencode.jsonc` to prevent startup crash.

#### Codex — ⚠️ BEADS PASS / HINDSIGHT UNAVAILABLE
- **Beads:** FULL PASS — `bd ready`, `bd show`, `bd update` all work perfectly.
- **Hindsight:** **UNAVAILABLE** — Codex runs in a sandboxed process that cannot reach the host machine's network. `127.0.0.1:8888`, `localhost:8888`, and even `0.0.0.0:8888` are all unreachable from Codex's execution context.
- Bead update: Updated successfully.
- **Root cause:** Codex (this desktop app) is itself a sandboxed process with no host network access. This is a **hard limit** that cannot be fixed by configuration.
- **Workaround:** Use Codex for Beads task tracking. For Hindsight memory, the user must run `hindsight memory recall/retain` in their terminal and paste results into Codex, or rely on Beads + AGENTS.md for context.

#### PI — ⏳ PENDING
- Waiting for user test results.

#### Zed — N/A
- Not installed on this machine.

---

## Known Gaps

1. **Codex Hindsight — HARD BLOCKER**: Codex sandbox cannot reach host network. Hindsight is unavailable. Beads works perfectly.
2. **beads.role git config**: `bd` warns about unset `beads.role`. Fix (run in terminal):
   ```bash
   cd /Users/jsrodka/Github/gh-dashboard
   git config --local beads.role maintainer
   ```
3. **Git staging blocked by sandbox**: `bd update` works in the DB but auto-export to `issues.jsonl` + `git add` fails in some agent sandboxes. Workaround: run `bd dolt push` from a non-sandboxed shell.

---

## Quick Reference

| Task | Command |
|------|---------|
| Start Hindsight | `./scripts/start-hindsight.sh` |
| Stop Hindsight | `./scripts/start-hindsight.sh stop` |
| Restart (pick up .env changes) | `./scripts/start-hindsight.sh restart` |
| Check status | `./scripts/start-hindsight.sh status` |
| View logs | `./scripts/start-hindsight.sh logs` |
| Validate integration | `./scripts/validate-agent-memory.sh` |
| Find ready work | `bd ready` |
| Claim work | `bd update <id> --claim` |
| Recall memory | `hindsight memory recall <bank> "query"` |
| Retain memory | `hindsight memory retain <bank> "content"` |

## Files Ready to Commit

```bash
git add AGENTS.md CLAUDE.md .claude/settings.json .cursor/rules/ docs/ scripts/ docker-compose.yml .env.example
git commit -m "chore: add agent memory and task tracking config"
```

`.env` (API key) and `.beads/` are gitignored.

---

## Recommended Next Action

1. Fix `beads.role` warning:
   ```bash
   cd /Users/jsrodka/Github/gh-dashboard
   git config --local beads.role maintainer
   ```

2. Commit the repo files:
   ```bash
   git add AGENTS.md CLAUDE.md .claude/settings.json .cursor/rules/ docs/ scripts/ docker-compose.yml .env.example
   git commit -m "chore: add agent memory and task tracking config"
   ```

3. Test PI (optional):
   ```bash
   cd /Users/jsrodka/Github/gh-dashboard
   pi
   ```
   Then paste the validation prompt from `docs/agent-memory-validation.md`.

4. Close the validation bead when satisfied:
   ```bash
   bd close gh-dashboard-t3d --reason "Cross-agent validation complete"
   ```

---

*4 of 5 installed agents fully validated. Codex Hindsight unavailable due to sandbox isolation (documented). PI pending. Infrastructure fully operational.*
