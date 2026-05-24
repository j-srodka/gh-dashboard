# Progress

## Status
In Progress

## Tasks
- [x] TypeScript type check (`npx tsc --noEmit`) — zero errors
- [x] Vite production build (`npx vite build`) — clean, 1663 modules, 0.86s
- [x] Attention score logic verification (`src/lib/scoring.ts`) — all edge cases correct
- [x] Test infrastructure audit — no test framework installed; suggested test cases written to `validation/tests-and-types.md`
- [x] Browser validation — Settings page AI Agent section (6 options) ✅; Actions page (CI Health, Workflows, Runs) ✅; Diagnose buttons implemented (conditional on failures) ⚠️
- [x] Slice 5: Repo Detail Modal Tabs (Traffic, Dependents, Mentions) — implemented ✅

## Files Changed
- `validation/tests-and-types.md` — comprehensive validation report with 40+ suggested test cases
- `validation/browser-validation.md` — browser validation report with Playwright screenshots
- `validation/settings-screenshot.png` — Settings page viewport screenshot
- `validation/settings-full.png` — Settings page full-page screenshot
- `validation/actions-screenshot.png` — Actions page viewport screenshot
- `validation/actions-full.png` — Actions page full-page screenshot
- `progress.md` — this file
- `src/hooks/useGitHubQuery.ts` — Added 4 new hooks: `useTrafficClones`, `useTrafficViews`, `useDependents`, `useMentions`
- `src/components/repositories/RepoDetailModal.tsx` — Added 3 new tab components: `TrafficTab`, `DependentsTab`, `MentionsTab`

## Slice 5 Summary

### What was implemented
Three new tabs added to the RepoDetailModal:

1. **Traffic tab** — Fetches clone and view data from GitHub's traffic API (`repos/:owner/:repo/traffic/clones` and `/traffic/views`). Displays 14-day bar charts for clones and views with total/unique counts. Shows graceful degradation message when token lacks push access (403 error). Uses `retry: false` to avoid hammering on auth failures. States: loading → skeleton, forbidden → access message, empty → "No data yet", data → bar charts.

2. **Dependents tab** — Fetches dependent repos by combining top forks (`repos/:owner/:repo/forks?sort=stargazers&per_page=10`) with code references from search (`search/code?q="{owner}/{repo}"`). Merges and deduplicates results, capping at 20. Shows repo name, description, star count, and source icon (fork vs reference). States: loading → skeleton, error → error message with detail, empty → empty state, data → repo list with external links.

3. **Mentions tab** — Searches for cross-repo mentions using GitHub search API (`search/issues?q="{owner}/{repo}"+-repo:owner/repo`), excluding self-repo results. Shows PR/issue icon, title, source repo, author, state, date, and external link. States: loading → skeleton, error → error message, empty → "No cross-repo mentions", data → sorted mention list.

### API access notes
- **Traffic API** requires push access — gracefully degrades on 403. Both `useTrafficClones` and `useTrafficViews` use `retry: false`.
- **Dependents** uses `Promise.allSettled` so one API failure doesn't block the other (e.g., forks endpoint may work even if code search is rate-limited).
- **Mentions** excludes the target repo itself from search results to avoid self-references.
- All new hooks use `enabled: !!owner && !!repo` matching existing patterns.

### Visual notes
- Traffic tab uses simple CSS horizontal bars (var(--color-brand) for clones, var(--color-success) for views) with 2% minimum width so zero-height bars are never invisible.
- Bar charts show the last 14 days sliced from the API response.
- Dependents and Mentions tabs follow existing modal list item patterns (rounded border cards with icons, hover states, external link buttons).
- All tabs use the existing `LoadingState` and `EmptyState` shared components.

### Quality gates
- `npx tsc --noEmit` — ✅ zero errors
- `npx vite build` — ✅ clean, 1663 modules, 0.86s

## Notes
- Discovered 2 potential edge-case issues: `daysSince()` produces NaN on empty string input; `parseSubjectUrl()` returns non-nil for non-pr/issue subjects
- Recommended test framework: vitest (natural fit with Vite ecosystem)
- Report includes test cases for `scoring.ts` (20 for `computeAttentionScore`, plus helpers), `useInboxItems.ts` pure helpers, and integration scenarios
- Browser validation: Settings page shows all 6 AI Agent options correctly; Actions page CI Health/Available Workflows/Recent Runs all render. Diagnose buttons only appear for failing runs (none present in test data). Console warning: `useLocalStorage` cross-component render warning (low severity, non-breaking).

## Slice 2: Scored Inbox UI

### Status
Completed

### Files Changed
- `src/pages/NotificationsPage.tsx` — Complete rewrite: scored inbox with filter pills, attention score badges, reason chips, author avatars, loading skeleton, and error state. (+503/-141 lines)

### Changes Summary
- Replaced mailbox-based notification list with unified scored inbox powered by `useInboxItems`
- **Filter pills**: All, Needs Attention (red), Awaiting Review, Assigned to Me, Mentioned, Stale — each shows count badge
- **Item card layout**: Source type icon → Title (linked) + score badge (colored: red≥60, amber≥30, green<30) → Meta row (repo, author avatar+name, comment count, relative timestamp, source tag) → Reason chips (with semantic variant colors) → Actions (mark-read on hover, external link)
- **Score badge**: Uses existing `Badge` component with `error`/`warning`/`success` variants mapped from red/amber/green tones
- **Reason chips**: Each attention reason rendered as a color-coded chip (warning for review/change requests, error for CI/security/stale-critical, info for assigned)
- **Bulk Mark All Read**: Calls existing `useMarkAllNotificationsRead` mutation; disabled when no notification-sourced items are present
- **Per-item mark-read**: Hover-revealed check button; only shown for notification-sourced items (detected via `getNotifThreadId` helper)
- **Loading skeleton**: Animated placeholder pills + 5 item cards
- **Error state**: Alert icon with friendly message
- **Empty state**: Contextual message — "All caught up" for all-filter, "No matching items" for filtered views
- Active filter persisted in localStorage via `useLocalStorage('notificationsFilter', 'all')`

### Validation
- `npx tsc --noEmit` — zero errors ✅
- `npx vite build` — clean build, 1665 modules, 864ms ✅
- No modifications to `useInboxItems.ts` or `scoring.ts` (per constraint)
- Existing `useMarkNotificationRead` / `useMarkAllNotificationsRead` mutations preserved
