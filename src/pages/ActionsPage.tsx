import { useState, useMemo } from 'react';

import { useRepos, useBulkWorkflowRuns, useRepoWorkflows, useDispatchWorkflow, useCIHealth } from '@/hooks/useGitHubQuery';
import { useMonitoredRepos } from '@/hooks/useMonitoredRepos';
import { useAIDiagnose } from '@/hooks/useAIDiagnose';
import type { DiagnoseResult } from '@/hooks/useAIDiagnose';
import { CONCL_ICONS } from '@/lib/constants';
import { exportToJson } from '@/lib/utils';
import {
  Play,
  ChevronDown,
  ChevronUp,
  Clock,
  GitBranch,
  Loader2,
  CheckCircle2,
  Workflow,
  Activity,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  X,
  ChevronRight,
  Download,
} from 'lucide-react';

type WfFilter = 'all' | 'success' | 'failure' | 'pending';

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function WorkflowCard({ repo, owner }: { repo: string; owner: string }) {
  const { data: workflows, isLoading } = useRepoWorkflows(owner, repo);
  const dispatch = useDispatchWorkflow();
  const [branchMap, setBranchMap] = useState<Record<number, string>>({});
  const [dispatchedId, setDispatchedId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Workflow className="w-4 h-4" style={{ color: 'var(--color-brand)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{repo}</span>
        </div>
        <div className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading workflows...</div>
      </div>
    );
  }

  const list = (workflows || []) as any[];

  return (
    <div className="rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Workflow className="w-4 h-4" style={{ color: 'var(--color-brand)' }} />
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{repo}</span>
        <span className="text-xs ml-auto" style={{ color: 'var(--color-text-tertiary)' }}>{list.length} workflow{list.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="space-y-2">
        {list.length === 0 && (
          <div className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>No workflows found</div>
        )}
        {list.map((wf: any) => (
          <div key={wf.id} className="flex items-center gap-2 py-2 px-3 rounded-lg" style={{ background: 'var(--color-surface-secondary)' }}>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{wf.name}</div>
              <div className="text-xs truncate" style={{ color: 'var(--color-text-tertiary)' }}>{wf.path}</div>
            </div>
            <input
              type="text"
              placeholder="branch"
              value={branchMap[wf.id] || ''}
              onChange={(e) => setBranchMap((prev) => ({ ...prev, [wf.id]: e.target.value }))}
              className="w-24 rounded-md border px-2 py-1 text-xs outline-none"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => {
                const ref = branchMap[wf.id] || 'main';
                dispatch.mutate({ owner, repo, workflow_id: wf.id, ref });
                setDispatchedId(wf.id);
                setTimeout(() => setDispatchedId(null), 2000);
              }}
              disabled={dispatch.isPending}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--color-brand)' }}
            >
              {dispatchedId === wf.id ? (
                <><CheckCircle2 className="w-3 h-3" /> <span>Sent</span></>
              ) : (
                <><Play className="w-3 h-3" /> <span>Run</span></>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function RunRow({ run }: { run: any }) {
  const info = CONCL_ICONS[run.conclusion || run.status] || CONCL_ICONS.skipped;
  const Icon = info.icon;
  const duration = run.created_at && run.updated_at
    ? Math.max(1, Math.round((new Date(run.updated_at).getTime() - new Date(run.created_at).getTime()) / 60000))
    : 0;

  const isFailure = run.conclusion === 'failure';
  const diagnose = useAIDiagnose();
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnoseResult | null>(null);
  const [showLogsPreview, setShowLogsPreview] = useState(false);

  const handleDiagnose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const [owner, repo] = (run.repo || '').split('/');
    if (!owner || !repo) return;
    diagnose.mutate(
      { owner, repo, runId: run.id },
      {
        onSuccess: (result) => {
          setDiagnosisResult(result);
        },
      }
    );
  };

  const dismissDiagnosis = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDiagnosisResult(null);
    setShowLogsPreview(false);
  };

  return (
    <div>
      <div className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
        <a
          href={run.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 flex-1 min-w-0"
        >
          <Icon className="w-4 h-4 flex-shrink-0" style={{ color: info.color }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{run.name}</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: `${info.color}20`, color: info.color }}>
                {info.label}
              </span>
            </div>
            <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              {run.head_commit?.message?.slice(0, 60) || run.head_branch} · {run.head_branch}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{formatDuration(duration)}</div>
            <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{new Date(run.created_at).toLocaleDateString()}</div>
          </div>
        </a>

        {isFailure && (
          <div className="flex-shrink-0">
            <button
              onClick={handleDiagnose}
              disabled={diagnose.isPending}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors hover:border-purple-400 disabled:opacity-50"
              style={{
                borderColor: 'var(--color-border)',
                color: 'var(--color-accent)',
                background: 'transparent',
              }}
            >
              {diagnose.isPending ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Diagnosing...</>
              ) : (
                <><Sparkles className="w-3 h-3" /> Diagnose</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Diagnosis result panel */}
      {diagnosisResult && (
        <div
          className="mx-5 mb-3 rounded-lg border p-4"
          style={{
            background: 'var(--color-surface-secondary)',
            borderColor: diagnosisResult.error ? 'var(--color-error)' : 'var(--color-accent)',
          }}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" style={{ color: diagnosisResult.error ? 'var(--color-error)' : 'var(--color-accent)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {diagnosisResult.error ? 'Diagnosis Failed' : 'AI Diagnosis'}
              </span>
              {diagnosisResult.agentUsed && (
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--color-surface-tertiary)', color: 'var(--color-text-tertiary)' }}>
                  via {diagnosisResult.agentUsed}
                </span>
              )}
            </div>
            <button
              onClick={dismissDiagnosis}
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-3.5 h-3.5" style={{ color: 'var(--color-text-tertiary)' }} />
            </button>
          </div>

          {diagnosisResult.error ? (
            <div className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-error)' }}>
              {diagnosisResult.error}
            </div>
          ) : (
            <>
              <div className="mb-3">
                <div className="text-xs font-semibold mb-1" style={{ color: 'var(--color-text-tertiary)' }}>DIAGNOSIS</div>
                <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-text-primary)' }}>
                  {diagnosisResult.diagnosis}
                </div>
              </div>
              <div className="mb-3">
                <div className="text-xs font-semibold mb-1" style={{ color: 'var(--color-text-tertiary)' }}>SUGGESTED FIX</div>
                <div className="text-sm leading-relaxed whitespace-pre-wrap font-mono rounded-md p-2.5" style={{ background: 'var(--color-surface-tertiary)', color: 'var(--color-text-primary)' }}>
                  {diagnosisResult.suggestedFix}
                </div>
              </div>
              {diagnosisResult.logsPreview && (
                <div>
                  <button
                    onClick={() => setShowLogsPreview(!showLogsPreview)}
                    className="flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    <ChevronRight
                      className="w-3 h-3 transition-transform"
                      style={{ transform: showLogsPreview ? 'rotate(90deg)' : undefined }}
                    />
                    Logs Preview
                  </button>
                  {showLogsPreview && (
                    <pre className="mt-2 text-xs p-2.5 rounded-md overflow-x-auto max-h-40" style={{ background: 'var(--color-surface-tertiary)', color: 'var(--color-text-secondary)' }}>
                      {diagnosisResult.logsPreview}
                    </pre>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function RunGroup({ repo, runs }: { repo: string; runs: any[] }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-5 py-3 border-b cursor-pointer text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-secondary)' }}
      >
        <GitBranch className="w-4 h-4" style={{ color: 'var(--color-brand)' }} />
        <span className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>{repo}</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'var(--color-surface-tertiary)', color: 'var(--color-text-secondary)' }}>
          {runs.length} run{runs.length !== 1 ? 's' : ''}
        </span>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 ml-auto" style={{ color: 'var(--color-text-tertiary)' }} />
        ) : (
          <ChevronDown className="w-4 h-4 ml-auto" style={{ color: 'var(--color-text-tertiary)' }} />
        )}
      </button>

      {isOpen && (
        <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
          {runs.map((run: any) => (
            <RunRow key={run.id} run={run} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ActionsPage() {
  const { data: repoData, isLoading: reposLoading } = useRepos();
  const { monitoredRepos } = useMonitoredRepos();
  const [wfFilter, setWfFilter] = useState<WfFilter>('all');
  const [repoFilter, setRepoFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: bulkRuns,
    isLoading: bulkLoading,
    refetch,
  } = useBulkWorkflowRuns(monitoredRepos, wfFilter === 'all' ? undefined : wfFilter);

  const repos = useMemo(() => {
    const all = (repoData || []).map((r: any) => ({
      name: r.name,
      owner: r.owner?.login || 'j-srodka',
      fullName: r.full_name,
      defaultBranch: r.default_branch || 'main',
    }));
    if (monitoredRepos.length === 0) return all;
    return all.filter((r: any) => monitoredRepos.includes(r.fullName));
  }, [repoData, monitoredRepos]);

  const filteredRepos = useMemo(() => {
    if (repoFilter === 'all') return repos;
    return repos.filter((r: any) => r.name === repoFilter);
  }, [repos, repoFilter]);

  const groupedRuns = useMemo(() => {
    const map = new Map<string, any[]>();
    const all = (bulkRuns || []) as any[];
    const repoFiltered = repoFilter === 'all'
      ? all
      : all.filter((r: any) => r.repo?.endsWith(`/${repoFilter}`));

    repoFiltered.forEach((run: any) => {
      const repo = run.repo || 'unknown';
      if (!map.has(repo)) map.set(repo, []);
      map.get(repo)!.push(run);
    });

    return Array.from(map.entries());
  }, [bulkRuns, repoFilter]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const isBusy = reposLoading || bulkLoading;
  const { data: ciHealth } = useCIHealth(monitoredRepos);

  const ciSummary = useMemo(() => {
    if (!ciHealth || ciHealth.length === 0) return null;
    const valid = ciHealth.filter((h) => !h.error);
    const avgSuccess = valid.length > 0
      ? Math.round(valid.reduce((s, h) => s + h.successRate, 0) / valid.length)
      : 0;
    const failing = valid.filter((h) => h.successRate < 80);
    return { total: valid.length, avgSuccess, failing: failing.length };
  }, [ciHealth]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Actions & Workflows</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Execute workflows and monitor runs across repositories</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => exportToJson(groupedRuns, 'workflow-runs.json')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:border-blue-300"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)', background: 'var(--color-surface-secondary)' }}
          >
            <Download className="w-3.5 h-3.5" /> Export JSON
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing || isBusy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:border-blue-300 disabled:opacity-50"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
          >
            {refreshing ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Refreshing...</>
            ) : (
              <><Clock className="w-3.5 h-3.5" /> Refresh</>
            )}
          </button>
        </div>
      </div>

      {/* CI Health Summary */}
      {ciSummary && ciSummary.total > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-5 h-5" style={{ color: 'var(--color-brand)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>CI Health</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Avg Success Rate</span>
              </div>
              <div className="text-2xl font-bold" style={{ color: ciSummary.avgSuccess >= 80 ? 'var(--color-success)' : ciSummary.avgSuccess >= 50 ? 'var(--color-warning)' : 'var(--color-error)' }}>
                {ciSummary.avgSuccess}%
              </div>
            </div>
            <div className="rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Struggling Repos</span>
              </div>
              <div className="text-2xl font-bold" style={{ color: ciSummary.failing > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>
                {ciSummary.failing}
              </div>
            </div>
            <div className="rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--color-brand)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Monitored</span>
              </div>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{ciSummary.total}</div>
            </div>
          </div>

          {/* Per-repo CI health cards */}
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {ciHealth?.filter((h) => !h.error).map((h) => (
              <div key={h.repo} className="rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{h.repo.split('/').pop()}</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: `${h.successRate >= 80 ? 'var(--color-success)' : h.successRate >= 50 ? 'var(--color-warning)' : 'var(--color-error)'}20`, color: h.successRate >= 80 ? 'var(--color-success)' : h.successRate >= 50 ? 'var(--color-warning)' : 'var(--color-error)' }}>
                    {h.successRate}%
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: 'var(--color-text-tertiary)' }}>Total runs</span>
                    <span className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>{h.totalRuns}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: 'var(--color-text-tertiary)' }}>Avg duration</span>
                    <span className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>{formatDuration(h.avgDuration)}</span>
                  </div>
                  {h.lastFailure && (
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: 'var(--color-text-tertiary)' }}>Last failure</span>
                      <span className="font-medium" style={{ color: 'var(--color-error)' }}>{new Date(h.lastFailure).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
                <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-tertiary)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${h.successRate}%`, background: h.successRate >= 80 ? 'var(--color-success)' : h.successRate >= 50 ? 'var(--color-warning)' : 'var(--color-error)' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Workflows */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Workflow className="w-5 h-5" style={{ color: 'var(--color-brand)' }} />
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Available Workflows</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredRepos.slice(0, 6).map((r: any) => (
            <WorkflowCard key={r.fullName} owner={r.owner} repo={r.name} />
          ))}
        </div>
      </div>

      {/* Recent Runs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5" style={{ color: 'var(--color-brand)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Recent Runs</h2>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={repoFilter}
              onChange={(e) => setRepoFilter(e.target.value)}
              className="min-w-[140px] rounded-lg border px-3 py-1.5 text-xs outline-none"
              style={{ background: 'var(--color-surface-secondary)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            >
              <option value="all">All Repos</option>
              {repos.map((r: any) => (
                <option key={r.name} value={r.name}>{r.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              {(['all', 'success', 'failure', 'pending'] as WfFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setWfFilter(f)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                    wfFilter === f ? 'text-white' : 'hover:border-blue-300'
                  }`}
                  style={
                    wfFilter === f
                      ? { background: 'var(--color-brand)', borderColor: 'var(--color-brand)' }
                      : { background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }
                  }
                >
                  {f === 'all' ? 'All' : f === 'success' ? '✓ Pass' : f === 'failure' ? '✗ Fail' : '◐ Pending'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {isBusy && (
            <div className="text-sm text-center py-8" style={{ color: 'var(--color-text-tertiary)' }}>Loading runs...</div>
          )}
          {!isBusy && groupedRuns.length === 0 && (
            <div className="text-center py-8 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>No workflow runs found</div>
          )}
          {groupedRuns.map(([repo, runs]) => (
            <RunGroup key={repo} repo={repo} runs={runs} />
          ))}
        </div>
      </div>
    </div>
  );
}
