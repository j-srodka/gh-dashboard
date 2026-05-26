import { useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { githubGet, githubGetResponse, githubPost, githubPatch, githubPut, githubDelete, githubGraphQL } from '@/lib/api';
import { computeMetrics } from '@/lib/metrics';
import type { MetricsResult } from '@/lib/metrics';
import type { EngineeringMetrics } from '@/lib/insights';

export function useRepos() {
  return useQuery({
    queryKey: ['repos'],
    queryFn: () => githubGet<any>('user/repos?sort=updated&per_page=100'),
  });
}

export function usePullRequests(monitoredRepos?: string[]) {
  const repoFilter = monitoredRepos && monitoredRepos.length > 0
    ? monitoredRepos.map((r) => `+repo:${r}`).join('')
    : '';
  return useQuery({
    queryKey: ['pulls', 'all', monitoredRepos],
    queryFn: () => githubGet<any>(`search/issues?q=is:pr+is:open${repoFilter}&sort=updated&per_page=100`),
    select: (data: any) => data.items || [],
  });
}

export function useReviewRequests(monitoredRepos?: string[]) {
  const repoFilter = monitoredRepos && monitoredRepos.length > 0
    ? monitoredRepos.map((r) => `+repo:${r}`).join('')
    : '';
  return useQuery({
    queryKey: ['pulls', 'review-requested', monitoredRepos],
    queryFn: () => githubGet<any>(`search/issues?q=is:pr+is:open+review-requested:@me${repoFilter}&sort=updated&per_page=100`),
    select: (data: any) => data.items || [],
  });
}

export function useIssues(monitoredRepos?: string[]) {
  return useQuery<any, Error, any[]>({
    queryKey: ['issues', monitoredRepos],
    queryFn: () => githubGet<any>('issues?filter=assigned&state=open&per_page=100'),
    select: (data: any) => {
      if (!monitoredRepos || monitoredRepos.length === 0) return data;
      return data.filter((item: any) => {
        const repoName = item.repository_url?.split('/').slice(-2).join('/');
        return monitoredRepos.includes(repoName);
      });
    },
  });
}

export function useWorkflowRuns(owner: string, repo: string) {
  return useQuery({
    queryKey: ['workflows', owner, repo],
    queryFn: () => githubGet<any>(`repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs?per_page=20`),
    enabled: !!owner && !!repo,
    select: (data: any) => data.workflow_runs || [],
  });
}

const DEFAULT_POLL_MS = 60_000;

export function useNotifications() {
  const pollIntervalRef = useRef<number>(DEFAULT_POLL_MS);

  return useQuery({
    queryKey: ['notifications', 'all'],
    queryFn: async () => {
      const response = await githubGetResponse('notifications?per_page=50&all=true');
      if (!response.ok) {
        throw new Error(`GitHub API ${response.status}: ${response.statusText}`);
      }
      const headerVal = response.headers.get('x-poll-interval');
      if (headerVal) {
        const seconds = parseInt(headerVal, 10);
        if (!isNaN(seconds) && seconds > 0) {
          // Clamp to 10s min, 10min max to prevent DoS from malicious proxy/compromised response
          pollIntervalRef.current = Math.min(Math.max(seconds, 10), 600) * 1000;
        } else {
          pollIntervalRef.current = DEFAULT_POLL_MS;
        }
      } else {
        pollIntervalRef.current = DEFAULT_POLL_MS;
      }
      return response.json();
    },
    refetchInterval: () => pollIntervalRef.current,
  });
}

export function useEvents() {
  return useQuery({
    queryKey: ['events'],
    queryFn: () => githubGet<any>('users/j-srodka/events?per_page=30'),
  });
}

export function useSearch(query: string, monitoredRepos?: string[]) {
  const repoQualifier = monitoredRepos && monitoredRepos.length > 0
    ? ' ' + monitoredRepos.map((r) => `repo:${r}`).join(' ')
    : '';
  const q = `${query} ${repoQualifier}`.trim();
  return useQuery({
    queryKey: ['search', query, monitoredRepos],
    queryFn: () => githubGet<any>(`search/issues?q=${encodeURIComponent(q)}&sort=updated&per_page=20`),
    enabled: query.length > 2,
    select: (data: any) => data.items || [],
  });
}

export function useRecentMerges(monitoredRepos?: string[]) {
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);
  const dateStr = lastWeek.toISOString().split('T')[0];
  const repoFilter = monitoredRepos && monitoredRepos.length > 0
    ? monitoredRepos.map((r) => `+repo:${r}`).join('')
    : '';

  return useQuery({
    queryKey: ['merges', dateStr, monitoredRepos],
    queryFn: () => githubGet<any>(`search/issues?q=is:pr+is:merged+author:@me+merged:>${dateStr}${repoFilter}&sort=updated&per_page=100`),
    select: (data: any) => data.items || [],
  });
}

export function useFailingWorkflows(monitoredRepos: string[]) {
  return useQuery({
    queryKey: ['failing-workflows', monitoredRepos],
    queryFn: async () => {
      if (monitoredRepos.length === 0) return [];
      const results: any[] = [];
      for (const fullName of monitoredRepos.slice(0, 10)) {
        const [owner, repo] = fullName.split('/');
        if (!owner || !repo) continue;
        try {
          const data = await githubGet<any>(`repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs?per_page=10`);
          const runs = (data.workflow_runs || []).filter((r: any) => r.conclusion === 'failure');
          results.push(...runs.map((r: any) => ({ ...r, repo: fullName })));
        } catch {}
      }
      return results;
    },
    enabled: monitoredRepos.length > 0,
  });
}

export function useBulkWorkflowRuns(monitoredRepos?: string[], status?: string) {
  return useQuery({
    queryKey: ['bulk-workflows', monitoredRepos, status],
    queryFn: async () => {
      if (!monitoredRepos || monitoredRepos.length === 0) return [];
      const results: any[] = [];
      for (const fullName of monitoredRepos.slice(0, 10)) {
        const [owner, repo] = fullName.split('/');
        if (!owner || !repo) continue;
        try {
          const data = await githubGet<any>(`repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs?per_page=5`);
          let runs = (data.workflow_runs || []).map((run: any) => ({ ...run, repo: fullName }));
          if (status) {
            runs = runs.filter((run: any) => run.conclusion === status || run.status === status);
          }
          results.push(...runs);
        } catch {}
      }
      return results;
    },
    enabled: monitoredRepos !== undefined && monitoredRepos.length > 0,
  });
}

export function useReviewPullRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      owner,
      repo,
      number,
      event,
      body,
    }: {
      owner: string;
      repo: string;
      number: number;
      event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
      body?: string;
    }) =>
      githubPost<any>(`repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${encodeURIComponent(String(number))}/reviews`, { event, body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pulls'] });
    },
  });
}

export function useCreateIssue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      owner,
      repo,
      title,
      body,
      labels,
    }: {
      owner: string;
      repo: string;
      title: string;
      body?: string;
      labels?: string[];
    }) => githubPost<any>(`repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`, { title, body, labels }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
    },
  });
}

export function useDispatchWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      owner,
      repo,
      workflow_id,
      ref,
    }: {
      owner: string;
      repo: string;
      workflow_id: string | number;
      ref: string;
    }) =>
      githubPost<any>(`repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${workflow_id}/dispatches`, { ref }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bulk-workflows'] });
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });
}

export function useCreatePullRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      owner,
      repo,
      title,
      head,
      base,
      body,
    }: {
      owner: string;
      repo: string;
      title: string;
      head: string;
      base: string;
      body?: string;
    }) => githubPost<any>(`repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`, { title, head, base, body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pulls'] });
    },
  });
}

export function useUser() {
  return useQuery({
    queryKey: ['user'],
    queryFn: () => githubGet<any>('user'),
  });
}

export function useRepoWorkflows(owner: string, repo: string) {
  return useQuery({
    queryKey: ['workflows-list', owner, repo],
    queryFn: () => githubGet<any>(`repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows`),
    enabled: !!owner && !!repo,
    select: (data: any) => data.workflows || [],
  });
}

export function useRepoPullRequests(owner: string, repo: string) {
  return useQuery({
    queryKey: ['repo-pulls', owner, repo],
    queryFn: () =>
      githubGet<any>(`repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=open&sort=updated&direction=desc&per_page=20`),
    enabled: !!owner && !!repo,
  });
}

export function useRepoIssues(owner: string, repo: string) {
  return useQuery({
    queryKey: ['repo-issues', owner, repo],
    queryFn: () =>
      githubGet<any>(`repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?state=open&sort=updated&direction=desc&per_page=20`),
    enabled: !!owner && !!repo,
  });
}

export function useRepoReleases(owner: string, repo: string) {
  return useQuery({
    queryKey: ['repo-releases', owner, repo],
    queryFn: () =>
      githubGet<any>(`repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases?per_page=10`),
    enabled: !!owner && !!repo,
  });
}

// ── Snapshots / Digests ────────────────────────────────────────────────────

export function useRecordSnapshots() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (repos: { full_name: string; stargazers_count: number; forks_count: number; open_issues_count: number }[]) => {
      const today = new Date().toISOString().split('T')[0];
      const snapshots = JSON.parse(localStorage.getItem('gh_snapshots') || '{}') as Record<string, { date: string; stars: number; forks: number; openIssues: number }[]>;
      for (const repo of repos) {
        const key = repo.full_name;
        const entries = snapshots[key] || [];
        entries.push({ date: today, stars: repo.stargazers_count, forks: repo.forks_count, openIssues: repo.open_issues_count });
        snapshots[key] = entries;
      }
      localStorage.setItem('gh_snapshots', JSON.stringify(snapshots));
      void queryClient.invalidateQueries({ queryKey: ['snapshots'] });
      return snapshots;
    },
  });
}

export function useSnapshots() {
  return useQuery({
    queryKey: ['snapshots'],
    queryFn: () => {
      const raw = localStorage.getItem('gh_snapshots');
      return raw ? JSON.parse(raw) as Record<string, { date: string; stars: number; forks: number; openIssues: number }[]> : {};
    },
  });
}

export function useDigest(period: 'daily' | 'weekly') {
  return useQuery({
    queryKey: ['digests', period],
    queryFn: () => {
      const raw = localStorage.getItem('gh_snapshots');
      const snapshots = raw ? JSON.parse(raw) as Record<string, { date: string; stars: number; forks: number; openIssues: number }[]> : {};
      const days = period === 'daily' ? 1 : 7;
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceStr = since.toISOString().split('T')[0];
      const entries: { repo: string; stars: number; forks: number; openIssues: number }[] = [];
      for (const [repo, data] of Object.entries(snapshots)) {
        const matching = data.filter((d) => d.date >= sinceStr);
        if (matching.length > 0) {
          const latest = matching[matching.length - 1];
          entries.push({ repo, stars: latest.stars, forks: latest.forks, openIssues: latest.openIssues });
        }
      }
      return { period, from: sinceStr, to: new Date().toISOString().split('T')[0], entries };
    },
  });
}

// ── Notifications ────────────────────────────────────────────────────────────

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (threadId: string) => {
      await githubPatch(`notifications/threads/${threadId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await githubPut('notifications', { read: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// ── Security Alerts ────────────────────────────────────────────────────────

export function useSecurityAlerts(monitoredRepos: string[]) {
  return useQuery({
    queryKey: ['security-alerts', monitoredRepos],
    queryFn: async () => {
      const results: { repo: string; dependabot: any[]; codeScanning: any[]; error?: string }[] = [];
      for (const fullName of monitoredRepos.slice(0, 10)) {
        const [owner, repo] = fullName.split('/');
        if (!owner || !repo) continue;
        try {
          const [dependabot, codeScanning] = await Promise.all([
            githubGet<any[]>(`repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/dependabot/alerts?per_page=20`).catch(() => []),
            githubGet<any[]>(`repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/code-scanning/alerts?per_page=20&state=open`).catch(() => []),
          ]);
          results.push({ repo: fullName, dependabot: dependabot || [], codeScanning: codeScanning || [] });
        } catch {
          results.push({ repo: fullName, dependabot: [], codeScanning: [], error: 'Access denied — token may lack security scope' });
        }
      }
      return results;
    },
    enabled: monitoredRepos.length > 0,
  });
}

// ── GitHub Projects V2 (Kanban) ─────────────────────────────────────────

const PROJECTS_QUERY = `
  query($login: String!, $first: Int!) {
    repositoryOwner(login: $login) {
      ... on User {
        projectsV2(first: $first, orderBy: { field: UPDATED_AT, direction: DESC }) {
          nodes {
            id
            title
            number
            url
            closed
            updatedAt
            items(first: 50) {
              totalCount
              nodes {
                id
                content {
                  ... on Issue {
                    id title url number state
                    repository { nameWithOwner }
                    assignees(first: 5) { nodes { login avatarUrl } }
                    labels(first: 5) { nodes { name color } }
                  }
                  ... on PullRequest {
                    id title url number state
                    repository { nameWithOwner }
                    assignees(first: 5) { nodes { login avatarUrl } }
                    labels(first: 5) { nodes { name color } }
                  }
                  ... on DraftIssue {
                    id title
                  }
                }
                fieldValues(first: 20) {
                  nodes {
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      field { ... on ProjectV2SingleSelectField { name } }
                    }
                    ... on ProjectV2ItemFieldDateValue {
                      date
                      field { ... on ProjectV2Field { name } }
                    }
                    ... on ProjectV2ItemFieldNumberValue {
                      number
                      field { ... on ProjectV2Field { name } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export function useProjects(login: string) {
  return useQuery({
    queryKey: ['projects', login],
    queryFn: () => githubGraphQL<any>(PROJECTS_QUERY, { login, first: 10 }),
    enabled: !!login,
    select: (data: any) => data.repositoryOwner?.projectsV2?.nodes || [],
  });
}

// ── Repo Detail: Traffic ───────────────────────────────────────────────────

export function useTrafficClones(owner: string, repo: string) {
  return useQuery({
    queryKey: ['traffic-clones', owner, repo],
    queryFn: () => githubGet<any>(`repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/traffic/clones`),
    enabled: !!owner && !!repo,
    retry: false,
  });
}

export function useTrafficViews(owner: string, repo: string) {
  return useQuery({
    queryKey: ['traffic-views', owner, repo],
    queryFn: () => githubGet<any>(`repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/traffic/views`),
    enabled: !!owner && !!repo,
    retry: false,
  });
}

// ── Repo Detail: Dependents ────────────────────────────────────────────────

export function useDependents(owner: string, repo: string) {
  return useQuery({
    queryKey: ['dependents', owner, repo],
    queryFn: async () => {
      // Fetch forks (a form of dependents) and repos mentioning this project
      const [forks, searchResults] = await Promise.allSettled([
        githubGet<any>(`repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/forks?sort=stargazers&per_page=10`),
        githubGet<any>(`search/code?q=${encodeURIComponent(`"${owner}/${repo}"`)}+fork:true&per_page=10`),
      ]);

      const forkRepos = forks.status === 'fulfilled'
        ? (Array.isArray(forks.value) ? forks.value : []).map((f: any) => ({
            full_name: f.full_name,
            html_url: f.html_url,
            stargazers_count: f.stargazers_count ?? 0,
            description: f.description ?? '',
            source: 'fork' as const,
          }))
        : [];

      const seen = new Set(forkRepos.map((r: any) => r.full_name));
      const codeRefs = searchResults.status === 'fulfilled'
        ? (searchResults.value?.items || []).map((item: any) => ({
            full_name: item.repository?.full_name || 'unknown',
            html_url: item.repository?.html_url || item.html_url,
            stargazers_count: 0,
            description: item.path || '',
            source: 'reference' as const,
          }))
        : [];

      // Merge, deduplicate, cap at 20
      const merged = [...forkRepos];
      for (const ref of codeRefs) {
        if (!seen.has(ref.full_name) && merged.length < 20) {
          merged.push(ref);
          seen.add(ref.full_name);
        }
      }

      return merged;
    },
    enabled: !!owner && !!repo,
    retry: false,
  });
}

// ── Repo Detail: Mentions ──────────────────────────────────────────────────

export function useMentions(owner: string, repo: string) {
  return useQuery({
    queryKey: ['mentions', owner, repo],
    queryFn: () =>
      githubGet<any>(
        `search/issues?q=${encodeURIComponent(`"${owner}/${repo}" -repo:${owner}/${repo}`)}&sort=created&order=desc&per_page=20`
      ),
    enabled: !!owner && !!repo,
    retry: false,
    select: (data: any) => data.items || [],
  });
}

// ── DORA Engineering Metrics ──────────────────────────────────────────

export function useEngineeringMetrics(owner: string, repo: string, periodDays: number = 30) {
  return useQuery({
    queryKey: ['metrics', owner, repo, periodDays],
    queryFn: () => computeMetrics(owner, repo, periodDays),
    enabled: !!owner && !!repo,
  });
}

export interface CIHealthEntry {
  repo: string;
  totalRuns: number;
  successRate: number;
  avgDuration: number;
  lastFailure: string | null;
  lastSuccess: string | null;
  lastRunStatus: string | null;
  recentConclusions: string[];
  error?: string;
}

export function useCIHealth(monitoredRepos: string[]) {
  return useQuery({
    queryKey: ['ci-health', monitoredRepos],
    queryFn: async () => {
      const results: CIHealthEntry[] = [];
      for (const fullName of monitoredRepos.slice(0, 10)) {
        const [owner, repo] = fullName.split('/');
        if (!owner || !repo) continue;
        try {
          const data = await githubGet<any>(`repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs?per_page=30`);
          const runs = (data.workflow_runs || []) as any[];
          const completed = runs.filter((r: any) => r.conclusion);
          const successes = completed.filter((r: any) => r.conclusion === 'success');
          const failures = completed.filter((r: any) => r.conclusion === 'failure');
          const durations = completed
            .filter((r: any) => r.created_at && r.updated_at)
            .map((r: any) => Math.max(1, Math.round((new Date(r.updated_at).getTime() - new Date(r.created_at).getTime()) / 60000)));
          const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
          const successRate = completed.length > 0 ? Math.round((successes.length / completed.length) * 100) : 100;
          const lastFailure = failures.length > 0 ? failures[0].updated_at || failures[0].created_at : null;
          const lastSuccess = successes.length > 0 ? successes[0].updated_at || successes[0].created_at : null;
          // Determine last run status from the most recent completed run
          const lastRun = completed.length > 0 ? completed[0] : null;
          const lastRunStatus = lastRun?.conclusion ?? null;
          // Last 5 concluded runs for flaky detection
          const recentConclusions = completed.slice(0, 5).map((r: any) => r.conclusion);
          results.push({ repo: fullName, totalRuns: runs.length, successRate, avgDuration, lastFailure, lastSuccess, lastRunStatus, recentConclusions });
        } catch {
          results.push({ repo: fullName, totalRuns: 0, successRate: 0, avgDuration: 0, lastFailure: null, lastSuccess: null, lastRunStatus: null, recentConclusions: [], error: 'Failed to fetch runs' });
        }
      }
      return results;
    },
    enabled: monitoredRepos.length > 0,
  });
}

// ── One-Click Operations: Star / Watch ─────────────────────────────────────

/**
 * Check if the authenticated user has starred a repo.
 * GitHub API GET /user/starred/{owner}/{repo} returns 204 if starred, 404 if not.
 */
export function useIsRepoStarred(owner: string, repo: string) {
  return useQuery({
    queryKey: ['starred', owner, repo],
    queryFn: async () => {
      const response = await githubGetResponse(`user/starred/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
      if (response.status === 204) return true;
      if (response.status === 404) return false;
      // Unexpected status — throw so TanStack Query marks it as error
      throw new Error(`Unexpected status ${response.status} checking star status`);
    },
    enabled: !!owner && !!repo,
    staleTime: 60_000,
  });
}

/**
 * Check if the authenticated user is watching a repo.
 * GitHub API GET /repos/{owner}/{repo}/subscription returns {subscribed, ignored}.
 * Returns false for 404 (never explicitly set) or when subscribed=false.
 */
export function useIsRepoWatched(owner: string, repo: string) {
  return useQuery({
    queryKey: ['watched', owner, repo],
    queryFn: async () => {
      const response = await githubGetResponse(
        `repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/subscription`
      );
      if (response.status === 404) return false;
      if (response.ok) {
        const data = await response.json();
        return data.subscribed === true;
      }
      throw new Error(`Unexpected status ${response.status} checking watch status`);
    },
    enabled: !!owner && !!repo,
    staleTime: 60_000,
  });
}

/** Star a repository: PUT /user/starred/{owner}/{repo} */
export function useStarRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ owner, repo }: { owner: string; repo: string }) =>
      githubPut<void>(`user/starred/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['starred', variables.owner, variables.repo] });
      queryClient.invalidateQueries({ queryKey: ['repos'] });
    },
  });
}

/** Unstar a repository: DELETE /user/starred/{owner}/{repo} */
export function useUnstarRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ owner, repo }: { owner: string; repo: string }) =>
      githubDelete<void>(`user/starred/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['starred', variables.owner, variables.repo] });
      queryClient.invalidateQueries({ queryKey: ['repos'] });
    },
  });
}

/** Watch a repository: PUT /repos/{owner}/{repo}/subscription */
export function useWatchRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ owner, repo }: { owner: string; repo: string }) =>
      githubPut<any>(`repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/subscription`, {
        subscribed: true,
        ignored: false,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['watched', variables.owner, variables.repo] });
    },
  });
}

/** Unwatch a repository: DELETE /repos/{owner}/{repo}/subscription */
export function useUnwatchRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ owner, repo }: { owner: string; repo: string }) =>
      githubDelete<void>(`repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/subscription`),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['watched', variables.owner, variables.repo] });
    },
  });
}
