import { githubGet } from './api';

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
  pipelineDuration: MetricValue;
  issueResolutionTime: MetricValue;
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

async function computePRCycleTime(
  owner: string,
  repo: string,
  since: Date,
  until?: Date,
): Promise<MetricValue> {
  try {
    const sinceStr = isoDate(since);
    let q = `is:pr+is:merged+repo:${owner}/${repo}+merged:>=${sinceStr}`;
    if (until) {
      q += `+merged:<${isoDate(until)}`;
    }

    const data = await githubGet<any>(`search/issues?q=${encodeURIComponent(q)}&sort=created&order=desc&per_page=100`);

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

async function computeReviewTurnaround(
  owner: string,
  repo: string,
  since: Date,
  until?: Date,
): Promise<MetricValue> {
  try {
    const sinceStr = isoDate(since);
    let q = `is:pr+is:merged+repo:${owner}/${repo}+merged:>=${sinceStr}`;
    if (until) {
      q += `+merged:<${isoDate(until)}`;
    }
    const data = await githubGet<any>(`search/issues?q=${encodeURIComponent(q)}&sort=created&order=desc&per_page=30`);

    const items = (data.items || []) as any[];
    const mergedPRs = items.filter((pr: any) => pr.pull_request);

    if (mergedPRs.length === 0) {
      return { value: null, label: 'No merged PRs in period' };
    }

    const prsToCheck = mergedPRs.slice(0, 20);
    const turnaroundHours: number[] = [];

    for (const pr of prsToCheck) {
      try {
        const reviews = await githubGet<any[]>(`repos/${owner}/${repo}/pulls/${pr.number}/reviews?per_page=50`);
        const approvedReviews = (reviews || []).filter(
          (r: any) => r.state === 'APPROVED',
        );
        if (approvedReviews.length > 0) {
          const firstApproval = approvedReviews.sort(
            (a: any, b: any) =>
              new Date(a.submitted_at).getTime() -
              new Date(b.submitted_at).getTime(),
          )[0];
          const hours = hoursBetween(pr.created_at, firstApproval.submitted_at);
          turnaroundHours.push(hours);
        }
      } catch {
        // skip PRs with review fetch errors
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

async function computeDeploymentFrequency(
  owner: string,
  repo: string,
  periodDays: number,
  since: Date,
  until?: Date,
): Promise<MetricValue> {
  try {
    const data = await githubGet<any[]>(`repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases?per_page=100`).catch(() => []);
    const releases = (Array.isArray(data) ? data : []) as any[];
    const recentReleases = releases.filter((r: any) => {
      const published = new Date(r.published_at || r.created_at);
      if (until) {
        return published >= since && published < until;
      }
      return published >= since;
    });

    if (recentReleases.length > 0) {
      const freq = recentReleases.length / periodDays;
      return {
        value: Math.round(freq * 100) / 100,
        label: `${recentReleases.length} release${recentReleases.length === 1 ? '' : 's'}`,
      };
    }

    const sinceStr = isoDate(since);
    let commitsPath = `repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?since=${sinceStr}&per_page=100`;
    if (until) {
      commitsPath += `&until=${isoDate(until)}`;
    }
    const commitsData = await githubGet<any[]>(commitsPath).catch(() => []);
    const commits = Array.isArray(commitsData) ? commitsData : [];

    if (commits.length > 0) {
      const freq = commits.length / periodDays;
      return {
        value: Math.round(freq * 100) / 100,
        label: `${commits.length} commit${commits.length === 1 ? '' : 's'} (fallback)`,
      };
    }

    return { value: null, label: 'No releases or commits in period' };
  } catch {
    return { value: null, label: 'Unable to fetch releases or commits' };
  }
}

async function computeWorkflowMetrics(
  owner: string,
  repo: string,
  since: Date,
  until?: Date,
): Promise<{ mttr: MetricValue; cfr: MetricValue; pipelineDuration: MetricValue }> {
  try {
    const data = await githubGet<any>(`repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs?per_page=100`).catch(() => ({ workflow_runs: [] }));
    const runs = (data.workflow_runs || []) as any[];

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
        pipelineDuration: { value: null, label: 'No workflow runs in period' },
      };
    }

    const completed = periodRuns.filter((r: any) => r.conclusion);

    const durations = completed
      .filter((r: any) => r.created_at && r.updated_at)
      .map((r: any) => {
        const ms = new Date(r.updated_at).getTime() - new Date(r.created_at).getTime();
        return Math.max(1, Math.round(ms / 60000));
      });
    const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length * 10) / 10 : null;
    const pipelineDuration: MetricValue = {
      value: avgDuration,
      label: avgDuration !== null ? `${completed.length} run${completed.length === 1 ? '' : 's'} averaged` : 'No completed run timings',
    };

    const failures = completed.filter((r: any) => r.conclusion === 'failure');
    const cfrValue =
      completed.length > 0
        ? Math.round((failures.length / completed.length) * 1000) / 10
        : 0;

    const cfr: MetricValue = {
      value: cfrValue,
      label: `${failures.length} failure${failures.length === 1 ? '' : 's'} / ${completed.length} run${completed.length === 1 ? '' : 's'}`,
    };

    const runsByWorkflow = new Map<string, any[]>();
    for (const run of periodRuns) {
      const name = run.name || run.workflow_id?.toString() || 'unknown';
      const list = runsByWorkflow.get(name) || [];
      list.push(run);
      runsByWorkflow.set(name, list);
    }

    const recoveryHours: number[] = [];

    for (const [, wfRuns] of runsByWorkflow) {
      wfRuns.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      for (let i = 0; i < wfRuns.length - 1; i++) {
        const current = wfRuns[i];
        const next = wfRuns[i + 1];
        if (current.conclusion === 'failure' && next.conclusion === 'success') {
          const hours = hoursBetween(current.updated_at || current.created_at, next.created_at);
          if (hours > 0 && hours < 720) {
            recoveryHours.push(hours);
          }
        }
      }
    }

    let mttr: MetricValue;
    if (recoveryHours.length > 0) {
      const avg = recoveryHours.reduce((a, b) => a + b, 0) / recoveryHours.length;
      mttr = {
        value: Math.round(avg * 10) / 10,
        label: `${recoveryHours.length} recovery event${recoveryHours.length === 1 ? '' : 's'}`,
      };
    } else if (failures.length === 0 && completed.length > 0) {
      mttr = { value: 0, label: '0 failures (Healthy)' };
    } else {
      mttr = { value: null, label: 'No failure→success transitions' };
    }

    return { mttr, cfr, pipelineDuration };
  } catch {
    return {
      mttr: { value: null, label: 'Unable to fetch workflow data' },
      cfr: { value: null, label: 'Unable to fetch workflow data' },
      pipelineDuration: { value: null, label: 'Unable to fetch workflow data' },
    };
  }
}

async function computeIssueResolutionTime(
  owner: string,
  repo: string,
  since: Date,
  until?: Date,
): Promise<MetricValue> {
  try {
    const sinceStr = isoDate(since);
    let q = `is:issue+is:closed+repo:${owner}/${repo}+closed:>=${sinceStr}`;
    if (until) {
      q += `+closed:<${isoDate(until)}`;
    }
    const data = await githubGet<any>(`search/issues?q=${encodeURIComponent(q)}&sort=created&order=desc&per_page=100`).catch(() => ({ items: [] }));

    const items = (data.items || []) as any[];
    const closedIssues = items.filter((item: any) => !item.pull_request && item.closed_at);

    if (closedIssues.length === 0) {
      return { value: null, label: 'No closed issues in period' };
    }

    const resolutionTimes = closedIssues.map((issue: any) =>
      hoursBetween(issue.created_at, issue.closed_at),
    );
    const avg = resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length;

    return {
      value: Math.round(avg * 10) / 10,
      label: `${closedIssues.length} closed issue${closedIssues.length === 1 ? '' : 's'}`,
    };
  } catch {
    return { value: null, label: 'Unable to fetch issue data' };
  }
}

export async function computeMetrics(
  owner: string,
  repo: string,
  periodDays: number,
): Promise<MetricsResult> {
  const repoFull = `${owner}/${repo}`;
  const currentSince = daysAgo(periodDays);
  const previousSince = daysAgo(periodDays * 2);
  const previousUntil = daysAgo(periodDays);
  const insufficientData: string[] = [];

  const [prCycleCurrent, reviewCurrent, deployCurrent, wfMetricsCurrent, issueResolutionCurrent] =
    await Promise.all([
      computePRCycleTime(owner, repo, currentSince),
      computeReviewTurnaround(owner, repo, currentSince),
      computeDeploymentFrequency(owner, repo, periodDays, currentSince),
      computeWorkflowMetrics(owner, repo, currentSince),
      computeIssueResolutionTime(owner, repo, currentSince),
    ]);

  const [prCyclePrev, reviewPrev, deployPrev, wfMetricsPrev, issueResolutionPrev] =
    await Promise.all([
      computePRCycleTime(owner, repo, previousSince, previousUntil),
      computeReviewTurnaround(owner, repo, previousSince, previousUntil),
      computeDeploymentFrequency(owner, repo, periodDays, previousSince, previousUntil),
      computeWorkflowMetrics(owner, repo, previousSince, previousUntil),
      computeIssueResolutionTime(owner, repo, previousSince, previousUntil),
    ]);

  const current: MetricPeriod = {
    prCycleTime: prCycleCurrent,
    reviewTurnaround: reviewCurrent,
    deploymentFrequency: deployCurrent,
    meanTimeToRecovery: wfMetricsCurrent.mttr,
    changeFailureRate: wfMetricsCurrent.cfr,
    pipelineDuration: wfMetricsCurrent.pipelineDuration,
    issueResolutionTime: issueResolutionCurrent,
  };

  const previous: MetricPeriod = {
    prCycleTime: prCyclePrev,
    reviewTurnaround: reviewPrev,
    deploymentFrequency: deployPrev,
    meanTimeToRecovery: wfMetricsPrev.mttr,
    changeFailureRate: wfMetricsPrev.cfr,
    pipelineDuration: wfMetricsPrev.pipelineDuration,
    issueResolutionTime: issueResolutionPrev,
  };

  const metricNames: Array<keyof MetricPeriod> = [
    'prCycleTime',
    'reviewTurnaround',
    'deploymentFrequency',
    'meanTimeToRecovery',
    'changeFailureRate',
    'pipelineDuration',
    'issueResolutionTime',
  ];

  for (const name of metricNames) {
    if (current[name].value === null) {
      insufficientData.push(`${name}: ${current[name].label}`);
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