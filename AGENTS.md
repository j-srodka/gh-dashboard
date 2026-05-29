# Agent instructions (gh-dashboard)

Project-specific agent guidance lives in **`.cursor/rules/`** and in installed **Cursor plugins**. Do not duplicate long routing docs here.

| Topic | Where to look |
|-------|----------------|
| **context-mode** | context-mode Cursor plugin (MCP + hooks). Do not add a second `context-mode` entry in `~/.cursor/mcp.json`. |
| **codegraph** | `.cursor/rules/codegraph.mdc` — use `codegraph_*` MCP tools for structural queries. |
| **beads** | `.cursor/rules/beads.mdc` — use `bd` for tasks; `bd prime` for workflow. |
| **agentmemory** | `.cursor/rules/agentmemory.mdc` — `memory_*` MCP against `localhost:3111`; server config in `~/.agentmemory/.env` (`AGENTMEMORY_TOOLS=core` recommended). |
| **working backwards** | `@working-backwards` (`.cursor/rules/working-backwards.mdc`) before multi-step work or Task subagents — micro PR/FAQ + user approval. Paste `.cursor/rules/subagent-contract.mdc` into each dispatch. Example: `docs/prfaq-example.md`. After approval, follow **orchestrate** plugin guardrails for step graph and handoffs. |

## Stack (quick)

- **Frontend:** React 19, TypeScript, Vite, TanStack Query, Tailwind v4
- **Backend:** Fastify proxy (GitHub auth server-side)
- **Dev:** `npm install` then `npm run dev`

## OpenCode (this repo only)

`opencode.json` — agentmemory MCP + `plugins/agentmemory-capture.ts`. Not used by Cursor.
