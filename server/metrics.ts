import { getGitHubToken } from './auth.js';

const BASE = 'https://api.github.com';
const HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'gh-dashboard/0.1.0',
};

export interface MetricValue {
  value: number | null;
  label: string;
}

export interface MetricPeriod {
  prCycleTime: MetricValue;
  reviewTurnaround: MetricValue;
  deploymentFrequency: MetricValue;
  meanTimeToRecovery: MetricValue;
  changeFailureRate: MetricValue;
}

export interface MetricsResult {
  repo: string;
  periodDays: number;
  current: MetricPeriod;
  previous: MetricPeriod;
  insufficientData: string[];
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

function hoursBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return ms / (1000 * 60 * 60);
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

async function githubFetch(token: string, path: string): Promise<any> {
  const url = `${BASE}/${path}`;
  const response = await fetch(url, {
    headers: {
      ...HEADERS,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status} for ${path}`);
  }
  return response.json();
}

// ── PR Cycle Time ────────────────────────────────────────────────────────
async function computePRCycleTime(
  token: string,
  owner: string,
  repo: string,
  since: Date,
  until?: Date,
): Promise<MetricValue> {
  try {
    const sinceStr = isoDate(since);
    let q = `is:pr+is:merged+repo:${owner}/${repo}+merged:>=${sinceStr}`;
    if (until) {
      const untilStr = isoDate(until);
      q += `+merged:<${untilStr}`;
    }
    // Use search API for merged PRs within date range
    const data = await githubFetch(
      token,
      `search/issues?q=${encodeURIComponent(q)}&sort=created&order=desc&per_page=100`,
    );

    const items = (data.items || []) as any[];
    const mergedPRs = items.filter((pr: any) => pr.pull_request && pr.closed_at);

    if (mergedPRs.length === 0) {
      return { value: null, label: 'No merged PRs in period' };
    }

    const cycleTimes = mergedPRs.map((pr: any) =>
      daysBetween(pr.created_at, pr.closed_at),
    );
    const avg = cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length;

    return {
      value: Math.round(avg * 10) / 10,
      label: `${mergedPRs.length} PR${mergedPRs.length === 1 ? '' : 's'}`,
    };
  } catch {
    return { value: null, label: 'Unable to fetch PR data' };
  }
}

// ── Review Turnaround ────────────────────────────────────────────────────
async function computeReviewTurnaround(
  token: string,
  owner: string,
  repo: string,
  since: Date,
  until?: Date,
): Promise<MetricValue> {
  try {
    const sinceStr = isoDate(since);
    let q = `is:pr+is:merged+repo:${owner}/${repo}+merged:>=${sinceStr}`;
    if (until) {
      const untilStr = isoDate(until);
      q += `+merged:<${untilStr}`;
    }
    const data = await githubFetch(
      token,
      `search/issues?q=${encodeURIComponent(q)}&sort=created&order=desc&per_page=30`,
    );

    const items = (data.items || []) as any[];
    const mergedPRs = items.filter((pr: any) => pr.pull_request);

    if (mergedPRs.length === 0) {
      return { value: null, label: 'No merged PRs in period' };
    }

    // Fetch reviews for up to 20 most recent PRs
    const prsToCheck = mergedPRs.slice(0, 20);
    const turnaroundHours: number[] = [];

    for (const pr of prsToCheck) {
      try {
        const reviews = await githubFetch(
          token,
          `repos/${owner}/${repo}/pulls/${pr.number}/reviews?per_page=50`,
        );
        const approvedReviews = (reviews || []).filter(
          (r: any) => r.state === 'APPROVED',
        );
        if (approvedReviews.length > 0) {
          // First approved review timestamp
          const firstApproval = approvedReviews.sort(
            (a: any, b: any) =>
              new Date(a.submitted_at).getTime() -
              new Date(b.submitted_at).getTime(),
          )[0];
          const hours = hoursBetween(pr.created_at, firstApproval.submitted_at);
          turnaroundHours.push(hours);
        }
      } catch {
        // Skip PRs where we can't fetch reviews
      }
    }

    if (turnaroundHours.length === 0) {
      return { value: null, label: 'No approved reviews found' };
    }

    const avgHours =
      turnaroundHours.reduce((a, b) => a + b, 0) / turnaroundHours.length;

    return {
      value: Math.round(avgHours * 10) / 10,
      label: `${turnaroundHours.length} PR${turnaroundHours.length === 1 ? '' : 's'} with reviews`,
    };
  } catch {
    return { value: null, label: 'Unable to fetch review data' };
  }
}

// ── Deployment Frequency ─────────────────────────────────────────────────
async function computeDeploymentFrequency(
  token: string,
  owner: string,
  repo: string,
  periodDays: number,
  since: Date,
  until?: Date,
): Promise<MetricValue> {
  try {
    const data = await githubFetch(
      token,
      `repos/${owner}/${repo}/releases?per_page=100`,
    );
    const releases = (data || []) as any[];
    const recentReleases = releases.filter((r: any) => {
      const published = new Date(r.published_at || r.created_at);
      if (until) {
        return published >= since && published < until;
      }
      return published >= since;
    });

    if (releases.length === 0) {
      return { value: null, label: 'No releases found' };
    }

    if (recentReleases.length === 0) {
      return { value: null, label: `No releases in last ${periodDays} days` };
    }

    // Deployments per day
    const freq = recentReleases.length / periodDays;

    return {
      value: Math.round(freq * 100) / 100,
      label: `${recentReleases.length} release${recentReleases.length === 1 ? '' : 's'}`,
    };
  } catch {
    return { value: null, label: 'Unable to fetch releases' };
  }
}

// ── MTTR & Change Failure Rate (from workflow runs) ─────────────────────
async function computeWorkflowMetrics(
  token: string,
  owner: string,
  repo: string,
  since: Date,
  until?: Date,
): Promise<{ mttr: MetricValue; cfr: MetricValue }> {
  try {
    const data = await githubFetch(
      token,
      `repos/${owner}/${repo}/actions/runs?per_page=100`,
    );
    const runs = (data.workflow_runs || []) as any[];

    // Filter to runs within period
    const periodRuns = runs.filter((r: any) => {
      const created = new Date(r.created_at);
      if (until) {
        return created >= since && created < until;
      }
      return created >= since;
    });

    if (periodRuns.length === 0) {
      return {
        mttr: { value: null, label: 'No workflow runs in period' },
        cfr: { value: null, label: 'No workflow runs in period' },
      };
    }

    // ── Change Failure Rate ──
    const completed = periodRuns.filter((r: any) => r.conclusion);
    const failures = completed.filter(
      (r: any) => r.conclusion === 'failure',
    );
    const cfrValue =
      completed.length > 0
        ? Math.round((failures.length / completed.length) * 1000) / 10
        : 0;

    const cfr: MetricValue = {
      value: cfrValue,
      label: `${failures.length} failure${failures.length === 1 ? '' : 's'} / ${completed.length} runs`,
    };

    // ── MTTR ──
    // For each workflow name, find failure→next-success pairs
    const runsByWorkflow = new Map<string, any[]>();
    for (const run of periodRuns) {
      const name = run.name || run.workflow_id?.toString() || 'unknown';
      const list = runsByWorkflow.get(name) || [];
      list.push(run);
      runsByWorkflow.set(name, list);
    }

    const recoveryHours: number[] = [];

    for (const [, wfRuns] of runsByWorkflow) {
      // Sort by created_at ascending
      wfRuns.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );

      for (let i = 0; i < wfRuns.length - 1; i++) {
        const current = wfRuns[i];
        const next = wfRuns[i + 1];
        if (
          current.conclusion === 'failure' &&
          next.conclusion === 'success'
        ) {
          const hours = hoursBetween(
            current.updated_at || current.created_at,
            next.created_at,
          );
          // Only count reasonable recovery times (< 720 hours / 30 days)
          if (hours > 0 && hours < 720) {
            recoveryHours.push(hours);
          }
        }
      }
    }

    const mttr: MetricValue =
      recoveryHours.length > 0
        ? {
            value:
              Math.round(
                (recoveryHours.reduce((a, b) => a + b, 0) /
                  recoveryHours.length) *
                  10,
              ) / 10,
            label: `${recoveryHours.length} recovery event${recoveryHours.length === 1 ? '' : 's'}`,
          }
        : { value: null, label: 'No failure→success transitions found' };

    return { mttr, cfr };
  } catch {
    return {
      mttr: { value: null, label: 'Unable to fetch workflow data' },
      cfr: { value: null, label: 'Unable to fetch workflow data' },
    };
  }
}

// ── Main compute function ────────────────────────────────────────────────
export async function computeMetrics(
  owner: string,
  repo: string,
  periodDays: number,
): Promise<MetricsResult> {
  const token = getGitHubToken();
  const repoFull = `${owner}/${repo}`;

  const currentSince = daysAgo(periodDays);
  const previousSince = daysAgo(periodDays * 2);
  const previousUntil = daysAgo(periodDays);

  const insufficientData: string[] = [];

  // Compute current period metrics
  const [prCycleCurrent, reviewCurrent, deployCurrent, wfMetricsCurrent] =
    await Promise.all([
      computePRCycleTime(token, owner, repo, currentSince),
      computeReviewTurnaround(token, owner, repo, currentSince),
      computeDeploymentFrequency(token, owner, repo, periodDays, currentSince),
      computeWorkflowMetrics(token, owner, repo, currentSince),
    ]);

  // Compute previous period metrics
  const [prCyclePrev, reviewPrev, deployPrev, wfMetricsPrev] =
    await Promise.all([
      computePRCycleTime(token, owner, repo, previousSince, previousUntil),
      computeReviewTurnaround(token, owner, repo, previousSince, previousUntil),
      computeDeploymentFrequency(
        token,
        owner,
        repo,
        periodDays,
        previousSince,
        previousUntil,
      ),
      computeWorkflowMetrics(token, owner, repo, previousSince, previousUntil),
    ]);

  // Build metric period objects
  const current: MetricPeriod = {
    prCycleTime: prCycleCurrent,
    reviewTurnaround: reviewCurrent,
    deploymentFrequency: deployCurrent,
    meanTimeToRecovery: wfMetricsCurrent.mttr,
    changeFailureRate: wfMetricsCurrent.cfr,
  };

  const previous: MetricPeriod = {
    prCycleTime: prCyclePrev,
    reviewTurnaround: reviewPrev,
    deploymentFrequency: deployPrev,
    meanTimeToRecovery: wfMetricsPrev.mttr,
    changeFailureRate: wfMetricsPrev.cfr,
  };

  // Collect insufficient data messages
  const metricNames: Array<keyof MetricPeriod> = [
    'prCycleTime',
    'reviewTurnaround',
    'deploymentFrequency',
    'meanTimeToRecovery',
    'changeFailureRate',
  ];

  for (const name of metricNames) {
    if (current[name].value === null) {
      insufficientData.push(
        `${name}: ${current[name].label}`,
      );
    }
  }

  return {
    repo: repoFull,
    periodDays,
    current,
    previous,
    insufficientData,
  };
}
