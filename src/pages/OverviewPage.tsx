import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useRepos,
  usePullRequests,
  useRecentMerges,
  useFailingWorkflows,
  useMarkAllNotificationsRead,
  useCIHealth,
  useEngineeringMetrics,
} from '@/hooks/useGitHubQuery';
import { useInboxItems } from '@/hooks/useInboxItems';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useMonitoredRepos } from '@/hooks/useMonitoredRepos';

import {
  GitPullRequest,
  CircleDot,
  Activity,
  AlertTriangle,
  CheckCheck,
  Loader2,
  RefreshCw,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface AskResult {
  response: string;
  error?: string;
  agentUsed?: string;
}

// ── Custom Hooks ─────────────────────────────────────────────────────────────

function useAIStandupQuery(prompt: string, enabled: boolean) {
  return useQuery({
    queryKey: ['ai-standup', prompt],
    queryFn: async (): Promise<AskResult> => {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) {
        throw new Error('AI Ask API call failed');
      }
      return res.json();
    },
    enabled: enabled && prompt.length > 0,
    staleTime: 5 * 60 * 1000, // Cache standup digests for 5 minutes
  });
}

// ── Sub-components ───────────────────────────────────────────────────────────

function QuickActionsBar() {
  const queryClient = useQueryClient();
  const markAllRead = useMarkAllNotificationsRead();

  const handleSyncNow = () => {
    queryClient.invalidateQueries();
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate();
  };

  return (
    <div
      className="rounded-xl border p-4 mb-6 flex items-center gap-3 flex-wrap shadow-sm"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
        Quick Actions
      </span>
      <div className="flex items-center gap-2 flex-1 flex-wrap">
        <button
          onClick={handleSyncNow}
          className="inline-flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-md transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Sync Now
        </button>
        <button
          onClick={handleMarkAllRead}
          disabled={markAllRead.isPending}
          className="inline-flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-md transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {markAllRead.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <CheckCheck className="w-3.5 h-3.5" />
          )}
          Mark All Read
        </button>
      </div>
    </div>
  );
}

// ── Main Redesigned Overview Page ───────────────────────────────────────────

export function OverviewPage() {
  const navigate = useNavigate();
  const { monitoredRepos } = useMonitoredRepos();
  
  // Data hooks for stats & DORA selection
  const { data: repoData } = useRepos();
  const { data: prData } = usePullRequests(monitoredRepos);
  const { data: mergeData } = useRecentMerges(monitoredRepos);
  const { data: failingData } = useFailingWorkflows(monitoredRepos);

  // 1. Triage Inbox items (attention score normalized)
  const { items: allInboxItems = [], critical: criticalItems = [], isLoading: inboxLoading } = useInboxItems(monitoredRepos);
  const inboxItems = allInboxItems.slice(0, 3); // High-priority 3 items

  // 2. CI Pipeline Health
  const { data: ciHealthData, isLoading: ciLoading } = useCIHealth(monitoredRepos);
  const ciList = (ciHealthData || []).slice(0, 3); // Top 3 monitored repos

  // 3. DORA Metrics Repo Selector state
  const [selectedDoraRepo, setSelectedDoraRepo] = useLocalStorage<string>('overviewDoraRepo', '');
  
  const repos = useMemo(() => {
    return monitoredRepos.length > 0
      ? (repoData || []).filter((r: any) => monitoredRepos.includes(r.full_name))
      : (repoData || []);
  }, [monitoredRepos, repoData]);

  const activeDoraRepo = useMemo(() => {
    if (selectedDoraRepo && repos.some((r: any) => r.full_name === selectedDoraRepo)) {
      return selectedDoraRepo;
    }
    return repos[0]?.full_name || '';
  }, [selectedDoraRepo, repos]);

  const [doraOwner, doraRepoName] = useMemo(() => {
    const [owner, name] = activeDoraRepo.split('/');
    return [owner || '', name || ''];
  }, [activeDoraRepo]);

  const { data: doraMetrics, isLoading: doraLoading } = useEngineeringMetrics(
    doraOwner,
    doraRepoName,
    30 // 30 days DORA metrics
  );

  // 4. Standup digest stats for AI prompt
  const repoCount = repos.length;
  const prCount = (prData || []).length;
  const mergeCount = (mergeData || []).length;
  const failingCount = (failingData || []).length;
  const criticalCount = criticalItems.length;

  const aiPrompt = useMemo(() => {
    if (repoCount === 0) return '';
    return `Generate a concise standup helper developer summary based on these active metrics for Sunday, May 24, 2026. Be brief, formatted with HTML bullet points, professional, and highlight critical priorities first:
- Repositories monitored: ${repoCount}
- Open PRs: ${prCount}
- Critical triage alerts requiring attention: ${criticalCount}
- Failed CI builds today: ${failingCount}
- Recent merges this week: ${mergeCount}`;
  }, [repoCount, prCount, criticalCount, failingCount, mergeCount]);

  const { data: aiStandup, isLoading: aiLoading } = useAIStandupQuery(aiPrompt, repoCount > 0);

  return (
    <div className="space-y-6">
      {/* Dynamic Keyframes for Pulsing Status Indicators */}
      <style>{`
        @keyframes pulse-green {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5); }
          70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        @keyframes pulse-red {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
          70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .pulse-success-dot {
          animation: pulse-green 2s infinite;
        }
        .pulse-error-dot {
          animation: pulse-red 2s infinite;
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Good morning, Alex</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Here&apos;s your developer standup and delivery health dashboard.</p>
        </div>
      </div>

      <QuickActionsBar />

      {/* Widget Grid Layout */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* 1. AI Standup Digest Widget (Full Width) */}
        <div
          className="col-span-12 rounded-2xl border p-6 relative overflow-hidden shadow-sm"
          style={{
            background: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          {/* Top linear border indicator */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-brand" />
          
          <div className="flex items-center justify-between mb-4 pb-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
              <Sparkles className="w-4 h-4 text-gradient shrink-0" style={{ color: 'var(--color-brand-start)' }} />
              AI Developer Standup digest
            </h2>
            <span
              className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full"
              style={{ background: 'var(--color-surface-tertiary)', color: 'var(--color-text-secondary)' }}
            >
              Configured Agent CLI
            </span>
          </div>

          <div className="flex gap-4 items-start">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm"
              style={{
                background: 'linear-gradient(135deg, var(--color-gradient-start), var(--color-gradient-mid))',
              }}
            >
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            
            <div className="flex-1 text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
              {aiLoading ? (
                <div className="flex items-center gap-2 py-2" style={{ color: 'var(--color-text-secondary)' }}>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating workspace summary...
                </div>
              ) : aiStandup?.response ? (
                <div 
                  className="prose dark:prose-invert max-w-none text-sm text-text-primary"
                  dangerouslySetInnerHTML={{ __html: aiStandup.response.replace(/\n/g, '<br />') }}
                />
              ) : (
                /* Fallback Local Standby Digest */
                <div>
                  <p><strong>Standup Summary:</strong> Yesterday, you merged <strong>{mergeCount} PRs</strong> across your monitored repositories. Today, there are <strong>{criticalCount} critical triage tasks</strong> needing attention and <strong>{failingCount} failing checks</strong>. Here is your standup agenda:</p>
                  <ul className="list-disc pl-5 mt-2 space-y-1" style={{ color: 'var(--color-text-secondary)' }}>
                    <li>You have <strong>{prCount} active open PRs</strong> waiting to be merged or reviewed.</li>
                    {criticalCount > 0 && (
                      <li><strong>Attention needed:</strong> Resolve {criticalCount} high-attention scoring items in your Triage Inbox.</li>
                    )}
                    {failingCount > 0 && (
                      <li><strong>Failing pipeline:</strong> Investigate failing CI run in your actions worklist.</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2. Scored Triage Inbox Widget (Col-span-8) */}
        <div
          className="col-span-12 lg:col-span-8 rounded-2xl border p-6 shadow-sm flex flex-col"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-center justify-between mb-4 pb-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
              <GitPullRequest className="w-4 h-4" style={{ color: 'var(--color-brand)' }} />
              Triage Inbox & Review Queue
            </h2>
            <button
              onClick={() => navigate('/review-queue')}
              className="text-xs font-semibold flex items-center gap-0.5 hover:underline"
              style={{ color: 'var(--color-brand)' }}
            >
              Go to Inbox
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="flex-1 space-y-3">
            {inboxLoading ? (
              <div className="flex items-center justify-center py-12" style={{ color: 'var(--color-text-tertiary)' }}>
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Loading priority queue...
              </div>
            ) : inboxItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCheck className="w-8 h-8 mb-2" style={{ color: 'var(--color-success)' }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Inbox Fully Cleared</p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>All caught up! No triage items require attention.</p>
              </div>
            ) : (
              inboxItems.map((item: any) => {
                const scoreColor =
                  item.tone === 'red'
                    ? 'rgba(239, 68, 68, 0.15)'
                    : item.tone === 'amber'
                      ? 'rgba(245, 158, 11, 0.15)'
                      : 'rgba(16, 185, 129, 0.15)';
                const scoreText =
                  item.tone === 'red'
                    ? 'var(--color-error)'
                    : item.tone === 'amber'
                      ? 'var(--color-warning)'
                      : 'var(--color-success)';

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3.5 rounded-xl border transition-all hover:translate-x-1 cursor-pointer hover:border-slate-300 dark:hover:border-slate-700"
                    style={{ background: 'var(--color-surface-secondary)', borderColor: 'var(--color-border)' }}
                    onClick={() => {
                      if (item.source === 'review-request') {
                        navigate('/review-queue');
                      } else if (item.source === 'issue') {
                        navigate('/issues');
                      } else {
                        window.open(item.url, '_blank', 'noopener,noreferrer');
                      }
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {item.type === 'pr' ? (
                        <GitPullRequest className="w-4 h-4 shrink-0" style={{ color: 'var(--color-brand)' }} />
                      ) : item.type === 'issue' ? (
                        <CircleDot className="w-4 h-4 shrink-0" style={{ color: 'var(--color-warning)' }} />
                      ) : item.type === 'ci' ? (
                        <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: 'var(--color-error)' }} />
                      ) : (
                        <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: 'var(--color-success)' }} />
                      )}
                      
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                          {item.title}
                        </div>
                        <div className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                          {item.repo} • {item.author ? `@${item.author}` : 'system'}
                        </div>
                      </div>
                    </div>

                    <div
                      className="text-xs font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0 ml-4"
                      style={{ background: scoreColor, color: scoreText }}
                    >
                      {item.tone === 'red' && <AlertTriangle className="w-3 h-3" />}
                      Score: {item.score}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 3. CI Operational Health Widget (Col-span-4) */}
        <div
          className="col-span-12 lg:col-span-4 rounded-2xl border p-6 shadow-sm flex flex-col"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-center justify-between mb-4 pb-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
              <Activity className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
              CI Operational Health
            </h2>
            <button
              onClick={() => navigate('/ci-health')}
              className="text-xs font-semibold flex items-center gap-0.5 hover:underline"
              style={{ color: 'var(--color-brand)' }}
            >
              Details
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="flex-1 space-y-4">
            {ciLoading ? (
              <div className="flex items-center justify-center py-12" style={{ color: 'var(--color-text-tertiary)' }}>
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Loading pipelines...
              </div>
            ) : ciList.length === 0 ? (
              <div className="text-center py-12 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                No active monitored pipelines. Add repos in Settings.
              </div>
            ) : (
              ciList.map((entry) => {
                const isSuccess = entry.lastRunStatus === 'success' || entry.successRate >= 80;
                const dotColor = isSuccess ? 'var(--color-success)' : 'var(--color-error)';
                const pulseClass = isSuccess ? 'pulse-success-dot' : 'pulse-error-dot';
                
                return (
                  <div key={entry.repo} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Custom Pulsing StatusDot */}
                        <span className={`w-2 h-2 rounded-full shrink-0 ${pulseClass}`} style={{ background: dotColor }} />
                        <span className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                          {entry.repo.split('/').pop()}
                        </span>
                      </div>
                      <span className="text-xs font-bold font-display" style={{ color: 'var(--color-text-primary)' }}>
                        {entry.successRate}%
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-tertiary)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${entry.successRate}%`,
                            background: isSuccess ? 'var(--color-success)' : 'var(--color-error)',
                          }}
                        />
                      </div>
                      <span className="text-[10px] shrink-0 w-8 text-right" style={{ color: 'var(--color-text-tertiary)' }}>
                        {entry.avgDuration}m avg
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 4. DORA Metrics Insights Widget (Full Width) */}
        <div
          className="col-span-12 rounded-2xl border p-6 shadow-sm"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-center justify-between mb-4 pb-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-4">
              <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                <TrendingUp className="w-4 h-4" style={{ color: 'var(--color-brand-end)' }} />
                DORA Insights Dashboard
              </h2>
              {/* Repository Selector Dropdown */}
              {repos.length > 1 && (
                <select
                  value={activeDoraRepo}
                  onChange={(e) => setSelectedDoraRepo(e.target.value)}
                  className="text-xs font-medium bg-transparent border rounded px-2.5 py-1 outline-none transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                >
                  {repos.map((r: any) => (
                    <option key={r.id} value={r.full_name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <button
              onClick={() => navigate('/insights')}
              className="text-xs font-semibold flex items-center gap-0.5 hover:underline"
              style={{ color: 'var(--color-brand)' }}
            >
              View Analytics
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {doraLoading ? (
            <div className="flex items-center justify-center py-8" style={{ color: 'var(--color-text-tertiary)' }}>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading metrics for {activeDoraRepo.split('/').pop()}...
            </div>
          ) : !doraMetrics ? (
            <div className="text-center py-8 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              Select a repository to display DORA metrics.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border text-center" style={{ background: 'var(--color-surface-secondary)', borderColor: 'var(--color-border)' }}>
                <div className="text-[10px] font-semibold text-transform uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
                  Deployment Frequency
                </div>
                <div className="text-xl font-bold font-display mt-1" style={{ color: 'var(--color-brand-start)' }}>
                  {doraMetrics.current.deploymentFrequency.value !== null ? `${doraMetrics.current.deploymentFrequency.value}/day` : 'N/A'}
                </div>
                <div className="text-[10px] font-semibold mt-1" style={{ color: 'var(--color-success)' }}>
                  {doraMetrics.current.deploymentFrequency.label}
                </div>
              </div>

              <div className="p-4 rounded-xl border text-center" style={{ background: 'var(--color-surface-secondary)', borderColor: 'var(--color-border)' }}>
                <div className="text-[10px] font-semibold text-transform uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
                  Lead Time to Change
                </div>
                <div className="text-xl font-bold font-display mt-1" style={{ color: 'var(--color-brand-mid)' }}>
                  {doraMetrics.current.prCycleTime.value !== null ? `${doraMetrics.current.prCycleTime.value} days` : 'N/A'}
                </div>
                <div className="text-[10px] font-semibold mt-1" style={{ color: 'var(--color-success)' }}>
                  {doraMetrics.current.prCycleTime.label}
                </div>
              </div>

              <div className="p-4 rounded-xl border text-center" style={{ background: 'var(--color-surface-secondary)', borderColor: 'var(--color-border)' }}>
                <div className="text-[10px] font-semibold text-transform uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
                  Mean Time to Recover
                </div>
                <div className="text-xl font-bold font-display mt-1" style={{ color: 'var(--color-brand-end)' }}>
                  {doraMetrics.current.meanTimeToRecovery.value !== null ? `${doraMetrics.current.meanTimeToRecovery.value} hours` : 'N/A'}
                </div>
                <div className="text-[10px] font-semibold mt-1" style={{ color: 'var(--color-success)' }}>
                  {doraMetrics.current.meanTimeToRecovery.label}
                </div>
              </div>

              <div className="p-4 rounded-xl border text-center" style={{ background: 'var(--color-surface-secondary)', borderColor: 'var(--color-border)' }}>
                <div className="text-[10px] font-semibold text-transform uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
                  Change Failure Rate
                </div>
                <div className="text-xl font-bold font-display mt-1" style={{ color: 'var(--color-error)' }}>
                  {doraMetrics.current.changeFailureRate.value !== null ? `${doraMetrics.current.changeFailureRate.value}%` : 'N/A'}
                </div>
                <div className="text-[10px] font-semibold mt-1" style={{ color: 'var(--color-success)' }}>
                  {doraMetrics.current.changeFailureRate.label}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
