import { useState, useEffect, useRef, useMemo } from 'react';
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
  useNotifications,
} from '@/hooks/useGitHubQuery';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useMonitoredRepos } from '@/hooks/useMonitoredRepos';
import { useAIAsk } from '@/hooks/useAIAsk';

import {
  Activity,
  CheckCheck,
  Loader2,
  RefreshCw,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Bot,
  Send,
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

function AIAssistantCard({ aiAgent }: { aiAgent: string }) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const askMutation = useAIAsk();
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async () => {
    const q = input.trim();
    if (!q || askMutation.isPending) return;
    setInput('');
    setHistory((prev) => [...prev, { role: 'user', content: q }]);
    try {
      const result = await askMutation.mutateAsync(q);
      setHistory((prev) => [...prev, { role: 'assistant', content: result.response || result.error || 'No response' }]);
    } catch {
      setHistory((prev) => [...prev, { role: 'assistant', content: 'Request failed. Check the server is running.' }]);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  return (
    <div
      className="col-span-12 lg:col-span-8 rounded-2xl border p-6 shadow-sm flex flex-col h-[350px]"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-center justify-between mb-4 pb-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
          <Bot className="w-4 h-4" style={{ color: 'var(--color-brand)' }} />
          AI Copilot Workspace Assistant
        </h2>
        <span
          className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full"
          style={{ background: 'var(--color-surface-tertiary)', color: 'var(--color-text-secondary)' }}
        >
          Agent: {aiAgent}
        </span>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1 scrollbar-thin">
        {history.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-6">
            <Bot className="w-8 h-8 mb-2 opacity-40" style={{ color: 'var(--color-brand)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Your GitHub Copilot</p>
            <p className="text-xs max-w-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              Ask questions about pull requests, repository statuses, or troubleshoot logs using your active agent CLI.
            </p>
          </div>
        )}
        {history.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'items-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border" style={{ borderColor: 'var(--color-border)' }}>
                <Bot className="w-3.5 h-3.5" style={{ color: 'var(--color-brand)' }} />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-brand text-white rounded-tr-none'
                  : 'rounded-tl-none border'
              }`}
              style={{
                background: msg.role === 'user' ? undefined : 'var(--color-surface-secondary)',
                borderColor: msg.role === 'user' ? undefined : 'var(--color-border)',
                color: msg.role === 'user' ? undefined : 'var(--color-text-primary)',
              }}
            >
              <pre className="whitespace-pre-wrap font-sans break-words m-0">{msg.content}</pre>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input Form */}
      <div className="flex items-center gap-2 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Ask AI Copilot to check PR status, summarize active repos..."
          disabled={askMutation.isPending}
          className="flex-1 min-w-0 rounded-xl border px-3 py-2 text-xs outline-none transition-colors"
          style={{
            background: 'var(--color-surface-secondary)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || askMutation.isPending}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-white transition-opacity disabled:opacity-40 shrink-0 bg-gradient-brand"
          title="Send message"
        >
          {askMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
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
  const { data: notificationsData } = useNotifications();


  // 2. CI Pipeline Health
  const { data: ciHealthData, isLoading: ciLoading } = useCIHealth(monitoredRepos);
  const ciList = (ciHealthData || []).slice(0, 3); // Top 3 monitored repos

  // 3. DORA Metrics Repo Selector state
  const [selectedDoraRepo, setSelectedDoraRepo] = useLocalStorage<string>('overviewDoraRepo', '');
  const [aiAgent] = useLocalStorage<string>('aiAgent', 'auto');
  
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
  const criticalCount = (notificationsData || []).filter((n: any) => n.unread).length;

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

        {/* 2. AI Assistant Card (Col-span-8) */}
        <AIAssistantCard aiAgent={aiAgent} />

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
