# Validation Quickstart — Run These Now

The infrastructure is confirmed working:
- ✅ Hindsight server: `http://localhost:8888` (openrouter/owl-alpha)
- ✅ Beads workspace: `/Users/jsrodka/Github/gh-dashboard/.beads`
- ✅ Banks: `jake-preferences`, `gh-dashboard`
- ✅ MCP endpoints: responding on all banks
- ✅ Validation issue: `gh-dashboard-t3d`

---

## Step 1: Seed Test Memories (if not already done)

If `./scripts/hindsight-bootstrap.sh` completed, memories are already retained. If not, run:

```bash
export PATH="$HOME/.hindsight/bin:$PATH"
hindsight memory retain jake-preferences \
  "Jake prefers minimal involvement, durable project automation, repo-local enforcement where possible, and no secrets stored in memory."

hindsight memory retain gh-dashboard \
  "This repo uses Beads as source of truth for agent task state."
```

---

## Step 2: Validate Each Agent

Copy-paste the exact prompt below into each tool. Report back what each agent says.

### Universal Validation Prompt

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

---

## Per-Tool Launch

### Claude Code
```bash
cd /Users/jsrodka/Github/gh-dashboard
claude
```
- Hooks should fire automatically at session start (`bd prime` + `hindsight memory recall`).
- Paste the validation prompt.

### Cursor
- Open Cursor IDE → open `gh-dashboard` project.
- Open Agent/Chat panel.
- Paste the validation prompt.
- MCP tools `hindsight_recall` and `hindsight_retain` should appear in the tool list.

### OpenCode
```bash
cd /Users/jsrodka/Github/gh-dashboard
opencode
```
- Paste the validation prompt.
- MCP servers are configured in `~/.config/opencode/opencode.jsonc`.

### Codex
```bash
cd /Users/jsrodka/Github/gh-dashboard
codex
```
- Trigger skill first: `$beads-hindsight`
- Then paste the validation prompt.

### PI
```bash
cd /Users/jsrodka/Github/gh-dashboard
pi
```
- Paste the validation prompt with explicit CLI fallback:
```
Run these commands and report results:
1. hindsight memory recall jake-preferences "What are Jake coding preferences?"
2. bd show gh-dashboard-t3d
3. Update gh-dashboard-t3d with your validation result.
```

---

## Step 3: Report Results

After testing each agent, tell me:
- Which agents recalled Hindsight successfully
- Which agents found and updated the Beads issue
- Any errors or gaps

I'll update the acceptance matrix and finalize the report.
