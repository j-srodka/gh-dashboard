# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CLAUDE.md`** at the repo root — project instructions and conventions
- **`README.md`** — pages, tech stack, project structure

## File structure

```
/
├── CLAUDE.md
├── AGENTS.md
├── README.md
├── GEMINI.md
├── docs/
│   └── agents/
├── src/
└── server/
```

## Use the project's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis), use the term as defined in the codebase. Don't drift to synonyms the existing code avoids.
