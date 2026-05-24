import Fastify from 'fastify';
import cors from '@fastify/cors';
import { getGitHubToken } from './auth.js';
import { recordSnapshot, getSnapshots } from './snapshots.js';
import { computeDigest } from './digests.js';
import { initAccounts, getAccounts, getTokenForAccount } from './accountStore.js';
import { diagnoseWorkflowFailure } from './ai-troubleshooter.js';
import { computeMetrics } from './metrics.js';

const app = Fastify({ logger: true });

app.register(cors, { origin: 'http://localhost:5173' });

const BASE = 'https://api.github.com';
const HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'gh-dashboard/0.1.0',
};

// Fastify v5 parses application/json by default; ensure parsed request.body is forwarded below.

// Health check
app.get('/api/health', async () => ({ status: 'ok', auth: !!getGitHubToken() }));

// POST /api/ai/diagnose — AI-powered workflow failure diagnosis
app.post('/api/ai/diagnose', async (request, reply) => {
  const body = request.body as {
    owner?: string;
    repo?: string;
    runId?: number;
    agentCli?: string;
  };

  if (!body?.owner || !body?.repo || body.runId === undefined) {
    reply.code(400).send({ error: 'owner, repo, and runId are required' });
    return;
  }

  // Validate owner/repo format (github.com username/repo pattern)
  if (!/^[a-zA-Z0-9_.-]{1,39}$/.test(body.owner) || !/^[a-zA-Z0-9_.-]{1,100}$/.test(body.repo)) {
    reply.code(400).send({ error: 'Invalid owner or repo format' });
    return;
  }

  // Validate runId is a positive integer
  const runIdNum = typeof body.runId === 'number' ? body.runId : parseInt(String(body.runId), 10);
  if (!Number.isInteger(runIdNum) || runIdNum <= 0) {
    reply.code(400).send({ error: 'runId must be a positive integer' });
    return;
  }

  // Validate agentCli against allow-list if present
  const ALLOWED_AGENTS = ['opencode', 'claude-code', 'claude', 'cursor', 'codex', 'copilot', 'auto'];
  if (body.agentCli && !ALLOWED_AGENTS.includes(body.agentCli)) {
    reply.code(400).send({ error: 'Invalid agentCli' });
    return;
  }

  const result = await diagnoseWorkflowFailure({
    owner: body.owner,
    repo: body.repo,
    runId: runIdNum,
    agentCli: body.agentCli,
  });

  reply.send(result);
});

// GET /api/accounts — list discovered GitHub accounts
app.get('/api/accounts', async (_request, reply) => {
  reply.send({ accounts: getAccounts() });
});

// POST /api/workflows — aggregate workflow runs across repos
app.post('/api/workflows', async (request, reply) => {
  const { repos, status } = request.body as {
    repos: string[];
    status?: 'success' | 'failure' | 'pending';
  };

  const limitedRepos = (repos || []).slice(0, 10);
  const token = getGitHubToken();

  const results = await Promise.all(
    limitedRepos.map(async (fullName) => {
      try {
        const [owner, repo] = fullName.split('/');
        const url = `${BASE}/repos/${owner}/${repo}/actions/runs?per_page=5`;
        const response = await fetch(url, {
          headers: {
            ...HEADERS,
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          console.error(`GitHub API error for ${fullName}: ${response.status}`);
          return [];
        }

        const data = (await response.json()) as { workflow_runs: any[] };
        let runs = data.workflow_runs.map((run) => ({ ...run, repo: fullName }));

        if (status) {
          runs = runs.filter(
            (run) => run.conclusion === status || run.status === status
          );
        }

        return runs;
      } catch (err) {
        console.error(`Error fetching workflows for ${fullName}:`, err);
        return [];
      }
    })
  );

  reply.send(results.flat());
});

// POST /api/snapshots — record current repo stats (computes real issue count excluding PRs)
app.post('/api/snapshots', async (request, reply) => {
  const body = request.body as {
    repos?: { full_name: string; stargazers_count: number; forks_count: number; open_issues_count: number }[];
  };
  if (!body?.repos || !Array.isArray(body.repos)) {
    reply.code(400).send({ error: 'repos array required' });
    return;
  }

  const token = getGitHubToken();
  for (const repo of body.repos) {
    const [owner, repoName] = repo.full_name.split('/');
    let realIssueCount = repo.open_issues_count;
    try {
      const issuesRes = await fetch(`${BASE}/repos/${owner}/${repoName}/issues?state=open&per_page=100`, {
        headers: { ...HEADERS, Authorization: `Bearer ${token}` },
      });
      if (issuesRes.ok) {
        const issues = (await issuesRes.json()) as any[];
        realIssueCount = issues.filter((i) => !i.pull_request).length;
      }
    } catch {
      // Fallback to raw count on error
    }
    await recordSnapshot(repo.full_name, repo.stargazers_count, repo.forks_count, realIssueCount);
  }
  reply.send({ recorded: body.repos.length });
});

// GET /api/snapshots — retrieve stored snapshot history
app.get('/api/snapshots', async (_request, reply) => {
  const snapshots = await getSnapshots();
  reply.send(snapshots);
});

// GET /api/digests?period=daily|weekly — compute period deltas
app.get('/api/digests', async (request, reply) => {
  const query = request.query as Record<string, string>;
  const period = query.period === 'weekly' ? 'weekly' : 'daily';
  const digest = await computeDigest(period);
  reply.send(digest);
});

// POST /api/metrics/:owner/:repo — DORA engineering metrics
app.post('/api/metrics/:owner/:repo', async (request, reply) => {
  const { owner, repo } = request.params as { owner: string; repo: string };
  const body = request.body as { periodDays?: number } | undefined;
  const periodDays = body?.periodDays ?? 30;

  // Validate periodDays
  if (![7, 30, 90].includes(periodDays)) {
    reply.code(400).send({ error: 'periodDays must be 7, 30, or 90' });
    return;
  }

  // Validate owner/repo format
  if (!/^[a-zA-Z0-9_.-]{1,39}$/.test(owner) || !/^[a-zA-Z0-9_.-]{1,100}$/.test(repo)) {
    reply.code(400).send({ error: 'Invalid owner or repo format' });
    return;
  }

  try {
    const result = await computeMetrics(owner, repo, periodDays);
    reply.send(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    reply.code(500).send({ error: message });
  }
});

// POST /api/graphql — GitHub GraphQL API proxy (for Projects V2)
app.post('/api/graphql', async (request, reply) => {
  const token = getGitHubToken();
  const body = request.body as { query: string; variables?: Record<string, unknown> };

  if (!body?.query) {
    reply.code(400).send({ error: 'query is required' });
    return;
  }

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'gh-dashboard/0.1.0',
    },
    body: JSON.stringify({ query: body.query, variables: body.variables }),
  });

  reply.code(response.status);
  reply.header('content-type', 'application/json');
  const text = await response.text();
  reply.send(text);
});

// Generic GitHub API proxy — supports X-Account header for multi-account
app.all('/api/github/*', async (request, reply) => {
  const path = (request.params as Record<string, string>)['*'];
  const accountId = request.headers['x-account'] as string | undefined;
  const token = accountId ? getTokenForAccount(accountId) : getGitHubToken();

  const query = request.query as Record<string, string | string[]>;
  const qs = Object.entries(query)
    .flatMap(([key, value]) => {
      if (Array.isArray(value)) return value.map((v) => `${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
      return [`${encodeURIComponent(key)}=${encodeURIComponent(value)}`];
    })
    .join('&');

  const url = qs ? `${BASE}/${path}?${qs}` : `${BASE}/${path}`;

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

  const response = await fetch(url, {
    method: request.method,
    headers: {
      ...HEADERS,
      Authorization: `Bearer ${token}`,
      ...(hasBody && { 'Content-Type': 'application/json' }),
      ...(request.headers['if-none-match'] && { 'If-None-Match': request.headers['if-none-match'] as string }),
    },
    body: hasBody ? JSON.stringify(request.body) : undefined,
  });

  reply.code(response.status);
  reply.header('content-type', response.headers.get('content-type') || 'application/json');
  reply.header('etag', response.headers.get('etag') || '');
  reply.header('x-ratelimit-remaining', response.headers.get('x-ratelimit-remaining') || '');
  reply.header('x-poll-interval', response.headers.get('x-poll-interval') || '');

  const body = await response.text();
  reply.send(body);
});

// Start
async function start() {
  try {
    getGitHubToken(); // Validate auth up front
    initAccounts(); // Discover accounts
    await app.listen({ port: 3001, host: '127.0.0.1' });
    console.log('Proxy server running at http://localhost:3001');
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
