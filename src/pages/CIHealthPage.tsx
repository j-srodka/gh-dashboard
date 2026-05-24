import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  ArrowUpDown,
  Loader2,
} from 'lucide-react';
import { useCIHealth, useRepos } from '@/hooks/useGitHubQuery';
import type { CIHealthEntry } from '@/hooks/useGitHubQuery';
import { useMonitoredRepos } from '@/hooks/useMonitoredRepos';
import { CONCL_ICONS } from '@/lib/constants';
import { StatusDot } from '@/components/ui/StatusDot';
import type { StatusDotStatus } from '@/components/ui/StatusDot';

type FilterMode = 'all' | 'failing' | 'flaky';
type SortKey = 'repo' | 'lastRunStatus' | 'successRate' | 'lastFailure' | 'avgDuration' | 'defaultBranch';

function formatDuration(minutes: number): string {
  if (minutes === 0) return '—';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function isFlaky(entry: CIHealthEntry): boolean {
  const { recentConclusions } = entry;
  if (recentConclusions.length < 2) return false;
  // Flaky: a failure followed later by a success within the last 5 runs
  // recentConclusions is newest-first; reverse to scan oldest-first
  let seenFailure = false;
  for (const conclusion of [...recentConclusions].reverse()) {
    if (conclusion === 'failure') {
      seenFailure = true;
    } else if (conclusion === 'success' && seenFailure) {
      return true;
    }
  }
  return false;
}

function statusToDotStatus(status: string | null): StatusDotStatus {
  switch (status) {
    case 'success': return 'success';
    case 'failure': return 'failure';
    case 'in_progress': return 'pending';
    case 'cancelled': return 'warning';
    case 'skipped': return 'warning';
    default: return 'pending';
  }
}

export function CIHealthPage() {
  const navigate = useNavigate();
  const { monitoredRepos } = useMonitoredRepos();
  const { data: repoData } = useRepos();
  const { data: ciHealth, isLoading, isError, error } = useCIHealth(monitoredRepos);

  const [filter, setFilter] = useState<FilterMode>('all');
  const [sortKey, setSortKey] = useState<SortKey>('successRate');
  const [sortAsc, setSortAsc] = useState(true);

  // Build a map of full_name → default_branch from repo data
  const branchMap = useMemo(() => {
    const map = new Map<string, string>();
    if (repoData) {
      for (const r of repoData as any[]) {
        map.set(r.full_name, r.default_branch || 'main');
      }
    }
    return map;
  }, [repoData]);

  // Summary stats
  const summary = useMemo(() => {
    if (!ciHealth || ciHealth.length === 0) return null;
    const valid = ciHealth.filter((h) => !h.error);
    const failing = valid.filter((h) => h.successRate < 80);
    const flaky = valid.filter(isFlaky);
    const avgSuccess = valid.length > 0
      ? Math.round(valid.reduce((s, h) => s + h.successRate, 0) / valid.length)
      : 0;
    return {
      total: valid.length,
      avgSuccess,
      failing: failing.length,
      flaky: flaky.length,
    };
  }, [ciHealth]);

  // Filtered + sorted rows
  const rows = useMemo(() => {
    if (!ciHealth) return [];
    let filtered = ciHealth.filter((h) => !h.error);

    switch (filter) {
      case 'failing':
        filtered = filtered.filter((h) => h.successRate < 80);
        break;
      case 'flaky':
        filtered = filtered.filter(isFlaky);
        break;
      default:
        break;
    }

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'repo':
          cmp = a.repo.localeCompare(b.repo);
          break;
        case 'lastRunStatus':
          cmp = (a.lastRunStatus || '').localeCompare(b.lastRunStatus || '');
          break;
        case 'successRate':
          cmp = a.successRate - b.successRate;
          break;
        case 'lastFailure': {
          const af = a.lastFailure ? new Date(a.lastFailure).getTime() : 0;
          const bf = b.lastFailure ? new Date(b.lastFailure).getTime() : 0;
          cmp = af - bf;
          break;
        }
        case 'avgDuration':
          cmp = a.avgDuration - b.avgDuration;
          break;
        case 'defaultBranch': {
          const ab = branchMap.get(a.repo) || '';
          const bb = branchMap.get(b.repo) || '';
          cmp = ab.localeCompare(bb);
          break;
        }
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [ciHealth, filter, sortKey, sortAsc, branchMap]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const SortHeader = ({ column, children }: { column: SortKey; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(column)}
      className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:opacity-80 transition-opacity"
      style={{ color: 'var(--color-text-tertiary)' }}
    >
      {children}
      <ArrowUpDown className={`w-3 h-3 ${sortKey === column ? 'opacity-100' : 'opacity-30'}`} />
    </button>
  );

  // Loading state
  if (isLoading) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>CI Health</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>CI/CD health matrix across monitored repositories</p>
        </div>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-text-tertiary)' }} />
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>CI Health</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>CI/CD health matrix across monitored repositories</p>
        </div>
        <div className="rounded-xl border p-8 text-center" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <AlertTriangle className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--color-error)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--color-error)' }}>
            Failed to load CI health data
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      </div>
    );
  }

  const validEntries = (ciHealth || []).filter((h) => !h.error);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>CI Health</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>CI/CD health matrix across monitored repositories</p>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4" style={{ color: 'var(--color-brand)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Avg Success Rate</span>
            </div>
            <div className="text-2xl font-bold" style={{
              color: summary.avgSuccess >= 80 ? 'var(--color-success)'
                : summary.avgSuccess >= 50 ? 'var(--color-warning)'
                : 'var(--color-error)',
            }}>
              {summary.avgSuccess}%
            </div>
          </div>

          <div className="rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Failing</span>
            </div>
            <div className="text-2xl font-bold" style={{ color: summary.failing > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>
              {summary.failing}
            </div>
          </div>

          <div className="rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Flaky</span>
            </div>
            <div className="text-2xl font-bold" style={{ color: summary.flaky > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
              {summary.flaky}
            </div>
          </div>

          <div className="rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--color-brand)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Monitored</span>
            </div>
            <div className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
              {summary.total}
            </div>
          </div>
        </div>
      )}

      {/* Empty state — no monitored repos with data */}
      {validEntries.length === 0 && (
        <div className="rounded-xl border p-8 text-center" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <Activity className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--color-text-tertiary)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>No CI data available</p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
            {monitoredRepos.length === 0
              ? 'Select repositories using the filter in the top bar to get started.'
              : 'No workflow runs found for the selected repositories.'}
          </p>
        </div>
      )}

      {/* Filter pills + table */}
      {validEntries.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-4">
            {(['all', 'failing', 'flaky'] as FilterMode[]).map((f) => {
              const count = f === 'all'
                ? validEntries.length
                : f === 'failing'
                  ? validEntries.filter((h) => h.successRate < 80).length
                  : validEntries.filter(isFlaky).length;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    filter === f ? 'text-white' : 'hover:border-blue-300'
                  }`}
                  style={
                    filter === f
                      ? { background: 'var(--color-brand)', borderColor: 'var(--color-brand)' }
                      : { background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }
                  }
                >
                  {f === 'all' ? 'All' : f === 'failing' ? 'Failing' : 'Flaky'}
                  <span
                    className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px]"
                    style={
                      filter === f
                        ? { background: 'rgba(255,255,255,0.2)', color: '#fff' }
                        : { background: 'var(--color-surface-tertiary)', color: 'var(--color-text-tertiary)' }
                    }
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Table */}
          <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: `1px solid var(--color-border)`, background: 'var(--color-surface-secondary)' }}>
                    <th className="text-left px-4 py-3">
                      <SortHeader column="repo">Repo</SortHeader>
                    </th>
                    <th className="text-left px-4 py-3">
                      <SortHeader column="lastRunStatus">Last Run</SortHeader>
                    </th>
                    <th className="text-left px-4 py-3">
                      <SortHeader column="successRate">Success Rate</SortHeader>
                    </th>
                    <th className="text-left px-4 py-3">
                      <SortHeader column="lastFailure">Last Failure</SortHeader>
                    </th>
                    <th className="text-left px-4 py-3">
                      <SortHeader column="avgDuration">Avg Duration</SortHeader>
                    </th>
                    <th className="text-left px-4 py-3">
                      <SortHeader column="defaultBranch">Branch</SortHeader>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((entry) => {
                    const runInfo = CONCL_ICONS[entry.lastRunStatus || ''] || CONCL_ICONS.skipped;
                    const RunIcon = runInfo.icon;
                    const repoName = entry.repo.split('/').pop() || entry.repo;
                    const defaultBranch = branchMap.get(entry.repo) || 'main';
                    const successColor =
                      entry.successRate >= 80 ? 'var(--color-success)'
                      : entry.successRate >= 50 ? 'var(--color-warning)'
                      : 'var(--color-error)';

                    return (
                      <tr
                        key={entry.repo}
                        onClick={() => navigate('/actions')}
                        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        style={{ borderBottom: `1px solid var(--color-border)` }}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <StatusDot status={statusToDotStatus(entry.lastRunStatus)} />
                            <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{repoName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <RunIcon className="w-3.5 h-3.5" style={{ color: runInfo.color }} />
                            <span className="text-xs" style={{ color: runInfo.color }}>{runInfo.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 max-w-[80px] h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-tertiary)' }}>
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${entry.successRate}%`, background: successColor }}
                              />
                            </div>
                            <span className="text-xs font-medium" style={{ color: successColor }}>{entry.successRate}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {entry.lastFailure ? (
                            <span className="text-xs" style={{ color: 'var(--color-error)' }}>
                              {new Date(entry.lastFailure).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                            {formatDuration(entry.avgDuration)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <GitBranch className="w-3 h-3" style={{ color: 'var(--color-text-tertiary)' }} />
                            <span className="text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>{defaultBranch}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {rows.length === 0 && (
            <div className="text-center py-8 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
              No repositories match the current filter
            </div>
          )}
        </>
      )}
    </div>
  );
}
