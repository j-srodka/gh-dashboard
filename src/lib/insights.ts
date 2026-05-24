export type HealthLabel = 'Strong' | 'Watch' | 'Risky';

export interface RepoInsight {
  score: number;
  label: HealthLabel;
  freshnessScore: number; // 0-25
  maintenanceScore: number; // 0-25
  activityScore: number; // 0-25
  completenessScore: number; // 0-25
  alerts: string[];
  opportunities: string[];
  daysSincePush: number;
  // ── Slice 6: Health Score Refinements ──
  /** Stars change vs last snapshot (positive = growth, negative = decline) */
  starsDelta?: number | null;
  /** Date of the snapshot used for delta comparison */
  lastSnapshotDate?: string | null;
  /** Security sub-score 0-25 (25 = no alerts, 0 = many severe alerts) */
  securityScore?: number;
  /** Total number of open security alerts (Dependabot + code scanning) */
  securityAlertsCount?: number;
  /** Number of critical-severity security alerts */
  securityCriticalCount?: number;
  /** Number of high-severity security alerts */
  securityHighCount?: number;
}

/** Optional context that enriches buildRepoInsight with cross-metric data. */
export interface InsightOptions {
  /** Previous snapshot star count for stars-delta tracking. */
  snapshotStars?: number;
  /** Date of the previous snapshot (YYYY-MM-DD). */
  snapshotDate?: string;
  /** Security alerts with a severity field (e.g. Dependabot / code-scanning results). */
  securityAlerts?: Array<{ severity?: string }>;
  /** CI success rate 0–100, used for cross-metric correlation alerts. */
  ciSuccessRate?: number;
}

function daysSince(dateStr: string | null | undefined): number {
  if (!dateStr) return 999;
  const then = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Build a per-repo health insight with score (0-100) and narrative alerts/opportunities.
 * Adapted from Gitdeck's scoring formula.
 *
 * Pass optional {@link InsightOptions} to unlock cross-metric correlation,
 * security-alert penalty, and stars-delta tracking.  All options are optional —
 * callers that only pass the repo object work exactly as before.
 */
export function buildRepoInsight(repo: any, options?: InsightOptions): RepoInsight {
  const daysSincePush = daysSince(repo.pushed_at);
  const openIssues = repo.open_issues_count || 0;
  const stars = repo.stargazers_count || 0;
  const forks = repo.forks_count || 0;
  const hasDescription = !!repo.description && repo.description.length > 10;
  const hasTopics = Array.isArray(repo.topics) && repo.topics.length > 0;
  const hasLicense = !!repo.license;
  const hasReadme = true; // GitHub repos always have some readme; can't check without extra fetch
  const size = repo.size || 0;

  // --- Freshness (0-25) ---
  // Recent push = healthy. Stale > 90 days = penalty.
  let freshnessScore = 25;
  if (daysSincePush <= 1) freshnessScore = 25;
  else if (daysSincePush <= 7) freshnessScore = 22;
  else if (daysSincePush <= 30) freshnessScore = 18;
  else if (daysSincePush <= 90) freshnessScore = 12;
  else freshnessScore = Math.max(0, 12 - Math.floor((daysSincePush - 90) / 30));

  // --- Maintenance burden (0-25) ---
  // Fewer open issues = better. Large repos can handle more issues.
  const issueThreshold = stars > 1000 ? 50 : stars > 100 ? 20 : 5;
  let maintenanceScore = 25;
  if (openIssues === 0) maintenanceScore = 25;
  else if (openIssues <= issueThreshold) maintenanceScore = 20;
  else if (openIssues <= issueThreshold * 2) maintenanceScore = 14;
  else if (openIssues <= issueThreshold * 4) maintenanceScore = 8;
  else maintenanceScore = Math.max(0, 8 - Math.floor((openIssues - issueThreshold * 4) / issueThreshold));

  // --- Activity (0-25) ---
  // Engagement via stars + forks + general activity.
  let activityScore = 10; // base
  if (stars > 1000) activityScore += 8;
  else if (stars > 100) activityScore += 5;
  else if (stars > 10) activityScore += 2;
  if (forks > 100) activityScore += 4;
  else if (forks > 10) activityScore += 2;
  else if (forks > 0) activityScore += 1;
  if (size > 1000) activityScore += 2; // significant codebase
  if (daysSincePush <= 7) activityScore += 1;
  activityScore = clamp(activityScore, 0, 25);

  // --- Completeness (0-25) ---
  // Well-documented, tagged, licensed repos score higher.
  let completenessScore = 5; // base for existing repo
  if (hasDescription) completenessScore += 8;
  if (hasTopics) completenessScore += 5;
  if (hasLicense) completenessScore += 5;
  if (hasReadme) completenessScore += 2;
  completenessScore = clamp(completenessScore, 0, 25);

  // ── Security scoring (0-25) ────────────────────────────────────────────
  let securityScore = 25;
  let securityAlertsCount = 0;
  let securityCriticalCount = 0;
  let securityHighCount = 0;

  if (options?.securityAlerts && options.securityAlerts.length > 0) {
    securityAlertsCount = options.securityAlerts.length;
    for (const alert of options.securityAlerts) {
      const s = (alert.severity || '').toLowerCase();
      if (s === 'critical') securityCriticalCount++;
      else if (s === 'high') securityHighCount++;
    }
    // Severity-weighted penalty: critical=5, high=3, medium/low=1; max deduction 20
    const mediumLow = securityAlertsCount - securityCriticalCount - securityHighCount;
    const rawPenalty =
      securityCriticalCount * 5 +
      securityHighCount * 3 +
      Math.max(0, mediumLow) * 1;
    securityScore = clamp(25 - Math.min(rawPenalty, 20), 0, 25);
  }

  const securityPenalty = 25 - securityScore;

  // ── Total score ────────────────────────────────────────────────────────
  const score = clamp(
    freshnessScore + maintenanceScore + activityScore + completenessScore - securityPenalty,
    0,
    100,
  );

  let label: HealthLabel;
  if (score >= 80) label = 'Strong';
  else if (score >= 55) label = 'Watch';
  else label = 'Risky';

  // ── Stars delta ────────────────────────────────────────────────────────
  let starsDelta: number | null = null;
  let lastSnapshotDate: string | null = null;
  if (options?.snapshotStars !== undefined && options.snapshotStars !== null) {
    starsDelta = stars - options.snapshotStars;
    lastSnapshotDate = options.snapshotDate ?? null;
  }

  // ── Alerts ──────────────────────────────────────────────────────────────
  const alerts: string[] = [];

  // Base alerts (unchanged)
  if (daysSincePush > 90) {
    alerts.push(`No commits in ${daysSincePush} days — repository may be unmaintained.`);
  } else if (daysSincePush > 30) {
    alerts.push(`Last push was ${daysSincePush} days ago — activity slowing.`);
  }
  if (openIssues > issueThreshold * 2) {
    alerts.push(`${openIssues} open issues — backlog growing faster than resolution.`);
  }
  if (!hasDescription) {
    alerts.push('Missing description — harder for contributors to discover purpose.');
  }

  // Security alerts
  if (securityCriticalCount > 0) {
    alerts.push(`${securityCriticalCount} critical security alert${securityCriticalCount !== 1 ? 's' : ''} — immediate action recommended.`);
  } else if (securityHighCount > 0) {
    alerts.push(`${securityHighCount} high-severity security alert${securityHighCount !== 1 ? 's' : ''} — review soon.`);
  }

  // ── Cross-metric correlation alerts ────────────────────────────────────
  // Compound signals that are more worrying together than alone.
  if (activityScore <= 12 && options?.ciSuccessRate !== undefined && options.ciSuccessRate < 70) {
    alerts.push(
      'Low engagement combined with failing CI — repository health may be deteriorating.',
    );
  }
  if (openIssues > issueThreshold * 2 && daysSincePush > 90) {
    alerts.push(
      'Growing backlog on a repository with no recent commits — may be unmaintained.',
    );
  }
  if (activityScore <= 12 && daysSincePush > 30) {
    alerts.push(
      'Low community engagement with slowing commit activity — consider outreach or archiving.',
    );
  }
  if (completenessScore <= 10 && activityScore <= 12) {
    alerts.push(
      'Repository lacks documentation and has low engagement — hard to discover and appears inactive.',
    );
  }

  // ── Opportunities ──────────────────────────────────────────────────────
  const opportunities: string[] = [];
  if (!hasTopics) {
    opportunities.push('Add topics to improve discoverability.');
  }
  if (!hasLicense) {
    opportunities.push('Add a license file to clarify usage rights.');
  }
  if (daysSincePush <= 7 && openIssues > 0 && openIssues <= 3) {
    opportunities.push('Low issue count with recent activity — good time to clear backlog.');
  }
  if (stars > 100 && forks < 5) {
    opportunities.push('High stars but few forks — consider adding CONTRIBUTING guide.');
  }
  if (score >= 80 && daysSincePush <= 7) {
    opportunities.push('Repository is healthy and active — consider a new release.');
  }
  // Security-specific opportunity
  if (securityAlertsCount > 0 && securityCriticalCount === 0) {
    opportunities.push(`${securityAlertsCount} open security alert${securityAlertsCount !== 1 ? 's' : ''} — resolving these will boost your score.`);
  }
  if (starsDelta !== null && starsDelta < 0 && Math.abs(starsDelta) >= 5) {
    opportunities.push(`Stars declined by ${Math.abs(starsDelta)} since last snapshot — consider community outreach.`);
  }

  return {
    score,
    label,
    freshnessScore,
    maintenanceScore,
    activityScore,
    completenessScore,
    alerts,
    opportunities,
    daysSincePush,
    // Slice 6 additions
    starsDelta,
    lastSnapshotDate,
    securityScore,
    securityAlertsCount: securityAlertsCount || undefined,
    securityCriticalCount: securityCriticalCount || undefined,
    securityHighCount: securityHighCount || undefined,
  };
}

export function labelColor(label: HealthLabel): string {
  switch (label) {
    case 'Strong':
      return 'var(--color-success)';
    case 'Watch':
      return 'var(--color-warning)';
    case 'Risky':
      return 'var(--color-error)';
  }
}

// ── DORA Engineering Metrics ──────────────────────────────────────────────

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

export interface EngineeringMetrics {
  repo: string;
  periodDays: number;
  current: MetricPeriod;
  previous: MetricPeriod;
  insufficientData: string[];
}

export function labelBg(label: HealthLabel): string {
  switch (label) {
    case 'Strong':
      return 'var(--color-success-light)';
    case 'Watch':
      return 'var(--color-warning-light)';
    case 'Risky':
      return 'var(--color-error-light)';
  }
}
