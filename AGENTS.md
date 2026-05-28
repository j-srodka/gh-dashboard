# context-mode — MANDATORY routing rules

context-mode MCP tools available. Rules protect context window from flooding. One unrouted command dumps 56 KB into context.

## Think in Code — MANDATORY

Analyze/count/filter/compare/search/parse/transform data: **write code** via `context-mode_ctx_execute(language, code)`, `console.log()` only the answer. Do NOT read raw data into context. PROGRAM the analysis, not COMPUTE it. Pure JavaScript — Node.js built-ins only (`fs`, `path`, `child_process`). `try/catch`, handle `null`/`undefined`. One script replaces ten tool calls.

## Sandbox Filesystem Isolation — CRITICAL

`ctx_execute` runs in an **isolated sandbox** with NO access to your project files. Do NOT use `fs.readFileSync()`, `fs.existsSync()`, `require('path').resolve()`, or any filesystem calls referencing project paths in `ctx_execute` — they will fail with ENOENT.

**Correct approaches:**
- **Check if file exists / list files**: Use `bash` (`ls`, `find`) or `grep` directly
- **Read file for analysis**: Use `ctx_execute_file(path, language, code)` — the file is loaded into `FILE_CONTENT` variable inside the sandbox
- **Process data you already have**: Pass it as a string in your code, or use `ctx_execute_file`

**Wrong approach (will fail):**
```javascript
// ❌ sandbox has no access to project filesystem
const fs = require('fs');
const exists = fs.existsSync('src/lib/auth.ts');
```

## BLOCKED — do NOT attempt

### curl / wget — BLOCKED
Shell `curl`/`wget` intercepted and blocked. Do NOT retry.
Use: `context-mode_ctx_fetch_and_index(url, source)` or `context-mode_ctx_execute(language: "javascript", code: "const r = await fetch(...)")`

### Inline HTTP — BLOCKED
`fetch('http`, `requests.get(`, `requests.post(`, `http.get(`, `http.request(` — intercepted. Do NOT retry.
Use: `context-mode_ctx_execute(language, code)` — only stdout enters context

### Direct web fetching — BLOCKED
Use: `context-mode_ctx_fetch_and_index(url, source)` then `context-mode_ctx_search(queries)`

## REDIRECTED — use sandbox

### Shell (>20 lines output)
Shell ONLY for: `git`, `mkdir`, `rm`, `mv`, `cd`, `ls`, `npm install`, `pip install`.
Otherwise: `context-mode_ctx_batch_execute(commands, queries)` or `context-mode_ctx_execute(language: "shell", code: "...")`

### File reading (for analysis)
Reading to **edit** → reading correct. Reading to **analyze/explore/summarize** → `context-mode_ctx_execute_file(path, language, code)`.

### grep / search (large results)
Use `context-mode_ctx_execute(language: "shell", code: "grep ...")` in sandbox.

## Tool selection

0. **MEMORY**: `context-mode_ctx_search(sort: "timeline")` — after resume, check prior context before asking user.
1. **GATHER**: `context-mode_ctx_batch_execute(commands, queries)` — runs all commands, auto-indexes, returns search. ONE call replaces 30+. Each command: `{label: "header", command: "..."}`.
2. **FOLLOW-UP**: `context-mode_ctx_search(queries: ["q1", "q2", ...])` — all questions as array, ONE call (default relevance mode).
3. **PROCESSING**: `context-mode_ctx_execute(language, code)` | `context-mode_ctx_execute_file(path, language, code)` — sandbox, only stdout enters context.
4. **WEB**: `context-mode_ctx_fetch_and_index(url, source)` then `context-mode_ctx_search(queries)` — raw HTML never enters context.
5. **INDEX**: `context-mode_ctx_index(content, source)` — store in FTS5 for later search.

## Parallel I/O batches

For multi-URL fetches or multi-API calls, **always** include `concurrency: N` (1-8):

- `context-mode_ctx_batch_execute(commands: [3+ network commands], concurrency: 5)` — gh, curl, dig, docker inspect, multi-region cloud queries
- `context-mode_ctx_fetch_and_index(requests: [{url, source}, ...], concurrency: 5)` — multi-URL batch fetch

**Use concurrency 4-8** for I/O-bound work (network calls, API queries). **Keep concurrency 1** for CPU-bound (npm test, build, lint) or commands sharing state (ports, lock files, same-repo writes).

GitHub API rate-limit: cap at 4 for `gh` calls.

## Output

Write artifacts to FILES — never inline. Return: file path + 1-line description.
Descriptive source labels for `search(source: "label")`.

## Session Continuity

Skills, roles, and decisions persist for the entire session. Do not abandon them as the conversation grows.

## Memory

Session history is persistent and searchable. On resume, search BEFORE asking the user:

| Need | Command |
|------|---------|
| What did we decide? | `context-mode_ctx_search(queries: ["decision"], source: "decision", sort: "timeline")` |
| What constraints exist? | `context-mode_ctx_search(queries: ["constraint"], source: "constraint")` |

DO NOT ask "what were we working on?" — SEARCH FIRST.
If search returns 0 results, proceed as a fresh session.

## ctx commands

| Command | Action |
|---------|--------|
| `ctx stats` | Call `stats` MCP tool, display full output verbatim |
| `ctx doctor` | Call `doctor` MCP tool, run returned shell command, display as checklist |
| `ctx upgrade` | Call `upgrade` MCP tool, run returned shell command, display as checklist |
| `ctx purge` | Call `purge` MCP tool with confirm: true. Warns before wiping knowledge base. |

After /clear or /compact: knowledge base and session stats preserved. Use `ctx purge` to start fresh.

## agentmemory

This project uses **agentmemory** (port 3111) for persistent cross-session memory. It replaces the previous Hindsight setup.

### Start the server

```bash
./scripts/start-agentmemory.sh    # starts agentmemory (native CLI or Docker fallback)
```

Or run directly:

```bash
agentmemory                       # start the memory server
agentmemory demo                  # seed sample data
```

### Available via MCP

When agentmemory is running, the following tools are available to agents via MCP:

| Tool | Description |
|------|-------------|
| `memory_health` | Check server connectivity |
| `memory_smart_search` | Hybrid semantic + keyword search across all sessions |
| `memory_save` | Save a durable fact, decision, or convention |
| `memory_sessions` | List recent sessions |
| `memory_profile` | Project intelligence (concepts, files, patterns) |

Full set: 53 tools (requires `AGENTMEMORY_TOOLS=all` in `~/.agentmemory/.env`).

### Viewer

Open http://localhost:3113 to see the real-time memory viewer.

### Configuration

Config file: `~/.agentmemory/.env`

- `EMBEDDING_PROVIDER=local` — free offline embeddings (requires `@xenova/transformers`)
- `AGENTMEMORY_AUTO_COMPRESS=true` — LLM compresses observations into structured facts
- `AGENTMEMORY_INJECT_CONTEXT=true` — auto-inject relevant memories into session start
- `AGENTMEMORY_TOOLS=all` — expose all 53 MCP tools (default: 7 core tools only)
- `AGENTMEMORY_SECRET=...` — bearer token for protected access

### Per-agent wiring

| Agent | Method |
|-------|--------|
| **Claude Code** | `/plugin marketplace add rohitg00/agentmemory` then `/plugin install agentmemory` |
| **Codex CLI** | `codex plugin marketplace add rohitg00/agentmemory` then `codex plugin add agentmemory@agentmemory` |
| **pi** | auto-discovers extension at `~/.pi/agent/extensions/agentmemory/` |
| **Cursor** | MCP server in `~/.cursor/mcp.json` |
| **Gemini CLI** | `gemini mcp add agentmemory npx -y @agentmemory/mcp --scope user` |
| **OpenCode** | MCP + plugin in `opencode.json` |
| **Hermes** | MCP server in `~/.hermes/config.yaml` |

<!-- CODEGRAPH_START -->
## CodeGraph (via MCP proxy)

This project has a CodeGraph MCP server configured. CodeGraph is a tree-sitter-parsed knowledge graph of every symbol, edge, and file. Reads are sub-millisecond and return structural information grep cannot.

**Pi accesses CodeGraph through the `mcp` proxy tool** — not as direct tools. Use `mcp({ server: "codegraph", tool: "...", args: "..." })` where `args` is a JSON string.

### Discover CodeGraph tools

Before calling a specific tool, list what CodeGraph exposes:

```
mcp({ server: "codegraph" })
```

Or search by name/description:

```
mcp({ search: "codegraph", server: "codegraph" })
```

### When to prefer CodeGraph over native search

Use CodeGraph for **structural** questions — what calls what, what would break, where is X defined, what is X's signature. Use native grep/read only for **literal text** queries (string contents, comments, log messages) or after you already have a specific file open.

| Question | Proxy call |
|---|---|
| "Where is X defined?" / "Find symbol named X" | `mcp({ server: "codegraph", tool: "codegraph_search", args: '{"query": "X"}' })` |
| "What calls function Y?" | `mcp({ server: "codegraph", tool: "codegraph_callers", args: '{"symbol": "Y"}' })` |
| "What does Y call?" | `mcp({ server: "codegraph", tool: "codegraph_callees", args: '{"symbol": "Y"}' })` |
| "How does X reach/become Y?" | `mcp({ server: "codegraph", tool: "codegraph_trace", args: '{"from": "X", "to": "Y"}' })` |
| "What would break if I changed Z?" | `mcp({ server: "codegraph", tool: "codegraph_impact", args: '{"symbol": "Z"}' })` |
| "Show me Y's signature / source / docstring" | `mcp({ server: "codegraph", tool: "codegraph_node", args: '{"symbol": "Y", "includeCode": true}' })` |
| "Give me focused context for a task/area" | `mcp({ server: "codegraph", tool: "codegraph_context", args: '{"task": "...", "maxNodes": 20, "includeCode": true}' })` |
| "See several related symbols' source at once" | `mcp({ server: "codegraph", tool: "codegraph_explore", args: '{"symbols": ["A","B"], "includeCode": true}' })` |
| "What files exist under path/" | `mcp({ server: "codegraph", tool: "codegraph_files", args: '{"path": "src/"}' })` |
| "Is the index healthy?" | `mcp({ server: "codegraph", tool: "codegraph_status" })` |

### Rules of thumb

- **Answer directly — don't delegate exploration.** For "how does X work" / architecture questions, answer with 2-3 proxy calls: `codegraph_context` first, then ONE `codegraph_explore` for the source of the symbols it surfaces. For a specific **flow** ("how does X reach Y") start with `codegraph_trace` from→to — one call returns the whole path with dynamic hops bridged — then ONE `codegraph_explore` for the bodies; don't rebuild the path with `codegraph_search` + `codegraph_callers`. CodeGraph IS the pre-built index, so spawning a separate file-reading sub-task/agent — or running a grep + read loop — repeats work CodeGraph already did and costs more for the same answer.
- **Trust CodeGraph results.** They come from a full AST parse. Do NOT re-verify them with grep — that's slower, less accurate, and wastes context.
- **Don't grep first** when looking up a symbol by name. `codegraph_search` is faster and returns kind + location + signature in one call.
- **Don't chain `codegraph_search` + `codegraph_node`** when you just want context — `codegraph_context` is one call.
- **Don't loop `codegraph_node` over many symbols** — one `codegraph_explore` call returns several symbols' source grouped in a single capped call, while each separate node/Read call re-reads the whole context and costs far more.
- **Index lag**: the file watcher debounces ~500ms behind writes; don't re-query immediately after editing a file in the same turn.

### If `.codegraph/` doesn't exist

The MCP server returns "not initialized." Ask the user: *"I notice this project doesn't have CodeGraph initialized. Want me to run `codegraph init -i` to build the index?"*
<!-- CODEGRAPH_END -->
