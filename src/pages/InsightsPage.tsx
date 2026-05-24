import { useState, useMemo } from 'react';
import { useRepos, useEngineeringMetrics } from '@/hooks/useGitHubQuery';
import { useMonitoredRepos } from '@/hooks/useMonitoredRepos';
import { buildRepoInsight, type RepoInsight } from '@/lib/insights';
import { InsightCard } from '@/components/insights/InsightCard';
import { HealthPill } from '@/components/insights/HealthPill';
import { RepoDetailModal } from '@/components/repositories/RepoDetailModal';
import { StatCard } from '@/components/ui/StatCard';
import {
  Activity,
  AlertTriangle,
  Filter,
  ChevronDown,
  GitPullRequest,
  Eye,
  Rocket,
  Timer,
  Percent,
  BarChart3,
} from 'lucide-react';
import type { MetricValue } from '@/lib/insights';

type FilterLabel = 'all' | 'Strong' | 'Watch' | 'Risky';
type TabId = 'health' | 'metrics';
type PeriodDays = 7 | 30 | 90;

function formatTrend(
  current: MetricValue,
  previous: MetricValue,
  unit: string,
  lowerIsBetter: boolean,
): { trend: string; trendUp: boolean; trendColor: string } {
  const green = 'var(--color-success)';
  const red = 'var(--color-error)';
  const neutral = 'var(--color-text-tertiary)';

  if (current.value === null || previous.value === null) {
    return { trend: '—', trendUp: true, trendColor: neutral };
  }

  const diff = current.value - previous.value;
  if (Math.abs(diff) < 0.05) {
    return { trend: 'Unchanged', trendUp: true, trendColor: neutral };
  }

  const improved = lowerIsBetter ? diff < 0 : diff > 0;
  const sign = diff > 0 ? '+' : '';
  const trendText = `${sign}${Math.round(diff * 10) / 10}${unit}`;

  return {
    trend: trendText,
    trendUp: improved,
    trendColor: improved ? green : red,
  };
}

function formatMetricValue(value: number | null, suffix: string): string {
  if (value === null) return 'N/A';
  return `${value}${suffix}`;
}

export function InsightsPage() {
  const { data, isLoading, isError } = useRepos();
  const { monitoredRepos } = useMonitoredRepos();
  const [selectedRepo, setSelectedRepo] = useState<any>(null);
  const [filter, setFilter] = useState<FilterLabel>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('health');

  // ── Metrics tab state ──
  const [metricsRepo, setMetricsRepo] = useState<string>('');
  const [metricsPeriod, setMetricsPeriod] = useState<PeriodDays>(30);

  const repos = monitoredRepos.length > 0
    ? (data || []).filter((r: any) => monitoredRepos.includes(r.full_name))
    : (data || []);

  // Auto-select first monitored repo for metrics
  const metricsRepoOwner = useMemo(() => {
    const effective = metricsRepo || repos[0]?.full_name || '';
    const [owner, repoName] = effective.split('/');
    return { owner: owner || '', repo: repoName || '', fullName: effective };
  }, [metricsRepo, repos]);

  const {
    data: metricsData,
    isLoading: metricsLoading,
    isError: metricsError,
  } = useEngineeringMetrics(
    metricsRepoOwner.owner,
    metricsRepoOwner.repo,
    metricsPeriod,
  );

  const insights = useMemo(() => {
    const map = new Map<string, RepoInsight>();
    for (const repo of repos) {
      map.set(repo.full_name, buildRepoInsight(repo));
    }
    return map;
  }, [repos]);

  const filteredRepos = useMemo(() => {
    if (filter === 'all') return repos;
    return repos.filter((r: any) => insights.get(r.full_name)?.label === filter);
  }, [repos, filter, insights]);

  const summary = useMemo(() => {
    const counts = { Strong: 0, Watch: 0, Risky: 0 };
    let totalScore = 0;
    for (const repo of repos) {
      const insight = insights.get(repo.full_name);
      if (insight) {
        counts[insight.label]++;
        totalScore += insight.score;
      }
    }
    const avgScore = repos.length > 0 ? Math.round(totalScore / repos.length) : 0;
    return { counts, avgScore };
  }, [repos, insights]);

  // ── Metrics trend computations ──
  const trends = useMemo(() => {
    if (!metricsData) {
      return {
        prCycleTime: { trend: '—', trendUp: true, trendColor: 'var(--color-text-tertiary)' },
        reviewTurnaround: { trend: '—', trendUp: true, trendColor: 'var(--color-text-tertiary)' },
        deploymentFrequency: { trend: '—', trendUp: true, trendColor: 'var(--color-text-tertiary)' },
        meanTimeToRecovery: { trend: '—', trendUp: true, trendColor: 'var(--color-text-tertiary)' },
        changeFailureRate: { trend: '—', trendUp: true, trendColor: 'var(--color-text-tertiary)' },
      };
    }
    const { current, previous } = metricsData;
    return {
      prCycleTime: formatTrend(current.prCycleTime, previous.prCycleTime, 'd', true),
      reviewTurnaround: formatTrend(current.reviewTurnaround, previous.reviewTurnaround, 'h', true),
      deploymentFrequency: formatTrend(current.deploymentFrequency, previous.deploymentFrequency, '/d', false),
      meanTimeToRecovery: formatTrend(current.meanTimeToRecovery, previous.meanTimeToRecovery, 'h', true),
      changeFailureRate: formatTrend(current.changeFailureRate, previous.changeFailureRate, '%', true),
    };
  }, [metricsData]);

  // ── Loading State ──
  if (isLoading) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Insights</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Repository health and scoring</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-xl border p-5 animate-pulse" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-3" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full mb-4" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border p-8 text-center" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <Activity className="w-8 h-8 mx-auto mb-3 text-red-500" />
        <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>Failed to load repositories</h3>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Make sure gh auth login is completed.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Insights</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            {activeTab === 'health' ? 'Repository health scores and recommendations' : 'DORA engineering metrics'}
          </p>
        </div>

        {/* Tab bar + controls */}
        <div className="flex items-center gap-2">
          {/* Tabs */}
          <div
            className="flex rounded-lg border p-0.5"
            style={{ background: 'var(--color-surface-tertiary)', borderColor: 'var(--color-border)' }}
          >
            <button
              onClick={() => setActiveTab('health')}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              style={{
                background: activeTab === 'health' ? 'var(--color-surface)' : 'transparent',
                color: activeTab === 'health' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              }}
            >
              Health
            </button>
            <button
              onClick={() => setActiveTab('metrics')}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              style={{
                background: activeTab === 'metrics' ? 'var(--color-surface)' : 'transparent',
                color: activeTab === 'metrics' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              }}
            >
              Metrics
            </button>
          </div>

          {/* Health tab controls */}
          {activeTab === 'health' && (
            <>
              {/* Summary pills */}
              <div className="hidden sm:flex items-center gap-2">
                <HealthPill label="Strong" score={summary.counts.Strong} size="sm" />
                <HealthPill label="Watch" score={summary.counts.Watch} size="sm" />
                <HealthPill label="Risky" score={summary.counts.Risky} size="sm" />
                <div className="px-2.5 py-1 rounded-full text-[10px] font-semibold" style={{ background: 'var(--color-surface-tertiary)', color: 'var(--color-text-secondary)' }}>
                  Avg {summary.avgScore}
                </div>
              </div>

              {/* Filter */}
              <div className="relative">
                <button
                  onClick={() => setFilterOpen(!filterOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:border-blue-300"
                  style={{ background: 'var(--color-surface-secondary)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>{filter === 'all' ? 'All' : filter}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                {filterOpen && (
                  <div
                    className="absolute right-0 mt-2 w-32 rounded-lg border shadow-lg z-50 overflow-hidden"
                    style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                  >
                    {(['all', 'Strong', 'Watch', 'Risky'] as FilterLabel[]).map((f) => (
                      <button
                        key={f}
                        onClick={() => { setFilter(f); setFilterOpen(false); }}
                        className="w-full px-3 py-2 text-xs text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        style={{ color: filter === f ? 'var(--color-brand)' : 'var(--color-text-secondary)' }}
                      >
                        {f === 'all' ? 'All Repos' : f}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Health Tab ── */}
      {activeTab === 'health' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredRepos.map((repo: any) => {
              const insight = insights.get(repo.full_name);
              if (!insight) return null;
              return (
                <InsightCard
                  key={repo.id}
                  repo={repo}
                  insight={insight}
                  onClick={() => setSelectedRepo(repo)}
                />
              );
            })}
          </div>

          {filteredRepos.length === 0 && (
            <div className="text-center py-12 rounded-xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No repositories match the selected filter.</p>
            </div>
          )}
        </>
      )}

      {/* ── Metrics Tab ── */}
      {activeTab === 'metrics' && (
        <div>
          {/* Controls bar */}
          <div className="flex items-center gap-3 mb-6">
            {/* Repo selector */}
            <select
              value={metricsRepoOwner.fullName}
              onChange={(e) => setMetricsRepo(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-xs border focus:outline-none focus:ring-1 focus:ring-blue-400"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            >
              {repos.map((r: any) => (
                <option key={r.full_name} value={r.full_name}>
                  {r.full_name}
                </option>
              ))}
            </select>

            {/* Period selector */}
            <div
              className="flex rounded-lg border p-0.5"
              style={{ background: 'var(--color-surface-tertiary)', borderColor: 'var(--color-border)' }}
            >
              {([7, 30, 90] as PeriodDays[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setMetricsPeriod(p)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
                  style={{
                    background: metricsPeriod === p ? 'var(--color-surface)' : 'transparent',
                    color: metricsPeriod === p ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  }}
                >
                  {p === 7 ? '7d' : p === 30 ? '30d' : '90d'}
                </button>
              ))}
            </div>
          </div>

          {/* Metrics loading */}
          {metricsLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="rounded-xl border p-5 animate-pulse" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-3" />
                  <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/4" />
                </div>
              ))}
            </div>
          )}

          {/* Metrics error */}
          {metricsError && !metricsLoading && (
            <div className="rounded-xl border p-8 text-center" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <BarChart3 className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--color-error)' }} />
              <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>Failed to load metrics</h3>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Could not compute metrics for {metricsRepoOwner.fullName}. The repository may have insufficient data.
              </p>
            </div>
          )}

          {/* Metrics data */}
          {metricsData && !metricsLoading && (
            <>
              {/* Stat cards grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
                {/* PR Cycle Time */}
                <StatCard
                  icon={GitPullRequest}
                  label="PR Cycle Time"
                  value={formatMetricValue(metricsData.current.prCycleTime.value, ' days')}
                  trend={trends.prCycleTime.trend}
                  trendUp={trends.prCycleTime.trendUp}
                  trendColor={trends.prCycleTime.trendColor}
                />

                {/* Review Turnaround */}
                <StatCard
                  icon={Eye}
                  label="Review Turnaround"
                  value={formatMetricValue(metricsData.current.reviewTurnaround.value, ' hours')}
                  trend={trends.reviewTurnaround.trend}
                  trendUp={trends.reviewTurnaround.trendUp}
                  trendColor={trends.reviewTurnaround.trendColor}
                />

                {/* Deployment Frequency */}
                <StatCard
                  icon={Rocket}
                  label="Deployment Frequency"
                  value={formatMetricValue(metricsData.current.deploymentFrequency.value, '/day')}
                  trend={trends.deploymentFrequency.trend}
                  trendUp={trends.deploymentFrequency.trendUp}
                  trendColor={trends.deploymentFrequency.trendColor}
                />

                {/* MTTR */}
                <StatCard
                  icon={Timer}
                  label="Mean Time to Recovery"
                  value={formatMetricValue(metricsData.current.meanTimeToRecovery.value, ' hours')}
                  trend={trends.meanTimeToRecovery.trend}
                  trendUp={trends.meanTimeToRecovery.trendUp}
                  trendColor={trends.meanTimeToRecovery.trendColor}
                />

                {/* Change Failure Rate */}
                <StatCard
                  icon={Percent}
                  label="Change Failure Rate"
                  value={formatMetricValue(metricsData.current.changeFailureRate.value, '%')}
                  trend={trends.changeFailureRate.trend}
                  trendUp={trends.changeFailureRate.trendUp}
                  trendColor={trends.changeFailureRate.trendColor}
                />
              </div>

              {/* Insufficient data warnings */}
              {metricsData.insufficientData.length > 0 && (
                <div
                  className="rounded-xl border p-4"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      Insufficient Data
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {metricsData.insufficientData.map((msg, i) => (
                      <li key={i} className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        {msg}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Metric detail labels */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {([
                  { key: 'prCycleTime', name: 'PR Cycle Time', detail: metricsData.current.prCycleTime.label },
                  { key: 'reviewTurnaround', name: 'Review Turnaround', detail: metricsData.current.reviewTurnaround.label },
                  { key: 'deploymentFrequency', name: 'Deployment Frequency', detail: metricsData.current.deploymentFrequency.label },
                  { key: 'meanTimeToRecovery', name: 'MTTR', detail: metricsData.current.meanTimeToRecovery.label },
                  { key: 'changeFailureRate', name: 'Change Failure Rate', detail: metricsData.current.changeFailureRate.label },
                ] as const).map(({ key, name, detail }) => (
                  <div
                    key={key}
                    className="rounded-lg border px-3 py-2"
                    style={{ background: 'var(--color-surface-tertiary)', borderColor: 'var(--color-border)' }}
                  >
                    <span className="text-[10px] font-medium block" style={{ color: 'var(--color-text-tertiary)' }}>
                      {name}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {detail}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal */}
      <RepoDetailModal
        repo={selectedRepo}
        isOpen={!!selectedRepo}
        onClose={() => setSelectedRepo(null)}
      />
    </div>
  );
}
