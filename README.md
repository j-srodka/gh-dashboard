# gh-dashboard

A personal, unified GitHub dashboard. View workflow runs, pull requests, issues, and repository health across multiple repos from a single interface.

**Inspired by**: [Port.io](https://port.io) (developer portal) and [OpsLevel](https://opslevel.com) (service catalog) design language.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| State/Data | TanStack Query — polling, caching, stale-while-revalidate |
| Styling | Tailwind CSS v4 (browser build) |
| Icons | Lucide React |
| Proxy | Fastify + `@fastify/cors` |
| Auth | GitHub CLI token (no OAuth setup) |

## Prerequisites

- Node.js ≥ 20
- `gh` CLI installed and authenticated (`gh auth login`)

## Quick Start

```bash
cd gh-dashboard
npm install
npm run dev
```

This starts:
- Vite dev server on **http://localhost:5173**
- API proxy on **http://localhost:3001**

## Project Structure

```
gh-dashboard/
├── server/
│   ├── index.ts          # Fastify proxy server
│   └── auth.ts           # gh CLI token resolution
├── src/
│   ├── components/
│   │   └── layout/
│   │       └── Layout.tsx    # Sidebar + top bar shell
│   ├── hooks/
│   │   └── useGitHubQuery.ts # TanStack Query wrappers
│   ├── pages/
│   │   ├── OverviewPage.tsx
│   │   ├── RepositoriesPage.tsx
│   │   ├── PullRequestsPage.tsx
│   │   ├── ActionsPage.tsx
│   │   ├── IssuesPage.tsx
│   │   ├── RulesPage.tsx
│   │   └── SettingsPage.tsx
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── github-dashboard.html   # Original HTML mock (reference)
└── AGENTS.md
```

## Authentication

The proxy reads `gh auth token` on startup. No OAuth app, no manual PAT copying.

```bash
# Verify you're logged in
gitHub auth status

# If not, log in
gitHub auth login
```

The token is **never exposed to the browser**. The proxy attaches it to all GitHub API requests server-side.

## Pages

| Page | Description |
|------|-------------|
| **Overview** | "Plan My Day" widget, scorecards, activity feed |
| **Repositories** | Catalog grid with language badges, CI status, PR previews |
| **Pull Requests** | Unified cross-repo list with review badges, CI dots |
| **Actions** | Workflow runs grouped by repo with live status |
| **Issues** | Cross-repo issue tracker with labels |
| **Rules & Agents** | Branch protection rulesets, reusable workflows, compliance scorecard |
| **Settings** | Auth status, auto-refresh toggle, notifications |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Concurrent dev: proxy + Vite |
| `npm run dev:client` | Vite only |
| `npm run dev:server` | Proxy only |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |

## License

MIT
