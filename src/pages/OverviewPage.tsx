import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  useRepos,
  usePullRequests,
  useIssues,
  useReviewRequests,
  useEvents,
  useRecentMerges,
  useFailingWorkflows,
  useMarkAllNotificationsRead,
} from '@/hooks/useGitHubQuery';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useMonitoredRepos } from '@/hooks/useMonitoredRepos';
import { Badge, StatusDot, StatCard } from '@/components/ui';
import { LANGUAGE_COLORS } from '@/lib/constants';
import {
  GitPullRequest,
  Eye,
  CircleDot,
  Activity,
  FolderGit2,
  AlertTriangle,
  GitMerge,
  GitCommit,
  CalendarCheck,
  XCircle,
  CheckCircle2,
  Pin,
  RefreshCw,
  CheckCheck,
  Loader2,
} from 'lucide-react';
import { useMemo } from 'react';

function PinnedReposSection() {
  const navigate = useNavigate();
  const { data: repoData } = useRepos();
  const [pinnedRepos] = useLocalStorage<string[]>('pinnedRepos', []);

  const pinned = (repoData || []).filter((r: any) => pinnedRepos.includes(r.full_name));

  if (pinned.length === 0) return null;

  return (
    <div className="rounded-xl border p-5 mb-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Pin className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />
        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Pinned Repositories</h2>
      </div>
      <div className="space-y-1">
        {pinned.map((r: any) => (
          <div
            key={r.id}
            className="flex items-center gap-3 py-2 px-3 rounded-lg cursor-pointer transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/50"
            onClick={() => navigate('/repositories')}
          >
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: LANGUAGE_COLORS[r.language] || '#94a3b8' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{r.full_name}</span>
            <span className="text-xs ml-auto flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
              {r.open_issues_count} open issues
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanMyDayCard() {
  const navigate = useNavigate();
  const { monitoredRepos } = useMonitoredRepos();
  const { data: prData } = usePullRequests(monitoredRepos);
  const { data: issueData } = useIssues(monitoredRepos);
  const { data: reviewData } = useReviewRequests(monitoredRepos);
  const { data: eventData } = useEvents();

  const prs = prData || [];
  const issues = issueData || [];
  const reviews = reviewData || [];
  const events = eventData || [];

  const prsNeedingAttention = prs.filter((p: any) => p.draft !== true && (p.review_comments > 0 || p.comments > 0));
  const myIssues = issues.filter((i: any) => !i.assignee || i.assignee?.login === 'alexkim');
  const reviewRequests = reviews.length;
  const newActivity = events.filter((e: any) => ['PullRequestEvent', 'IssuesEvent', 'PushEvent'].includes(e.type)).slice(0, 3);

  return (
    <div className="rounded-xl border p-5 mb-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Plan My Day</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>Prioritized based on your involvement</p>
        </div>
        <CalendarCheck className="w-5 h-5" style={{ color: 'var(--color-brand)' }} />
      </div>

      <div className="space-y-4">
        {reviewRequests > 0 && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-warning-light)' }}>
              <Eye className="w-3.5 h-3.5" style={{ color: 'var(--color-warning)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                {reviewRequests} PR{reviewRequests > 1 ? 's' : ''} waiting for your review
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <button
                  onClick={() => navigate('/pull-requests')}
                  className="text-xs px-2.5 py-1 rounded-md transition-colors hover:opacity-90"
                  style={{ background: 'var(--color-brand)', color: '#fff' }}
                >
                  View PRs
                </button>
              </div>
            </div>
          </div>
        )}

        {prsNeedingAttention.length > 0 && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-info-light)' }}>
              <GitPullRequest className="w-3.5 h-3.5" style={{ color: 'var(--color-info)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                {prsNeedingAttention.length} of your PRs need follow-up
              </div>
              <div className="mt-1.5 space-y-1">
                {prsNeedingAttention.slice(0, 2).map((p: any) => (
                  <div key={p.id} className="flex items-center gap-2 text-xs">
                    <StatusDot status={p.state === 'open' ? 'success' : 'pending'} />
                    <span className="truncate" style={{ color: 'var(--color-text-secondary)' }}>{p.title}</span>
                    <Badge variant="neutral">{p.base?.repo?.name || 'repo'}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {myIssues.length > 0 && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-error-light)' }}>
              <CircleDot className="w-3.5 h-3.5" style={{ color: 'var(--color-error)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                {myIssues.length} assigned issue{myIssues.length > 1 ? 's' : ''}
              </div>
              <div className="mt-1.5 space-y-1">
                {myIssues.slice(0, 2).map((i: any) => (
                  <div key={i.id} className="flex items-center gap-2 text-xs">
                    <StatusDot status={i.state === 'open' ? 'error' : 'success'} />
                    <span className="truncate" style={{ color: 'var(--color-text-secondary)' }}>{i.title}</span>
                    <Badge variant="neutral">{i.repository?.name || 'repo'}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {newActivity.length > 0 && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-success-light)' }}>
              <Activity className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Recent activity</div>
              <div className="mt-1.5 space-y-1">
                {newActivity.map((e: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <StatusDot status="pending" />
                    <span style={{ color: 'var(--color-text-secondary)' }}>
                      {e.type?.replace('Event', '')} in {e.repo?.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mt-4 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <button
          onClick={() => navigate('/pull-requests')}
          className="flex-1 text-xs py-1.5 px-2 rounded-md transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          View PRs
        </button>
        <button
          onClick={() => navigate('/actions')}
          className="flex-1 text-xs py-1.5 px-2 rounded-md transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          View Actions
        </button>
      </div>
    </div>
  );
}

function ActivityFeed() {
  const { data: eventData } = useEvents();

  const activityItems = (eventData || []).slice(0, 8).map((e: any) => {
    const repo = e.repo?.name || 'unknown';
    const actor = e.actor?.login || 'unknown';
    const time = new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    switch (e.type) {
      case 'PullRequestEvent':
        return { icon: GitPullRequest, color: 'var(--color-info)', text: `${e.payload?.action || 'opened'} PR in ${repo}`, repo, actor, time, type: 'pr' };
      case 'IssuesEvent':
        return { icon: CircleDot, color: 'var(--color-error)', text: `${e.payload?.action || 'opened'} issue in ${repo}`, repo, actor, time, type: 'issue' };
      case 'PushEvent':
        return { icon: GitCommit, color: 'var(--color-brand)', text: `Pushed ${e.payload?.commits?.length || 0} commits to ${repo}`, repo, actor, time, type: 'push' };
      case 'CreateEvent':
        return { icon: CheckCircle2, color: 'var(--color-success)', text: `Created ${e.payload?.ref_type || 'ref'} in ${repo}`, repo, actor, time, type: 'create' };
      case 'DeleteEvent':
        return { icon: XCircle, color: 'var(--color-error)', text: `Deleted ${e.payload?.ref_type || 'ref'} in ${repo}`, repo, actor, time, type: 'delete' };
      default:
        return { icon: Activity, color: 'var(--color-brand)', text: `${e.type?.replace('Event', '') || 'Activity'} in ${repo}`, repo, actor, time, type: 'activity' };
    }
  });

  const defaultActivities = [
    { icon: GitMerge, color: 'var(--color-success)', text: 'Merged PR #234 in auth-service', repo: 'auth-service', actor: 'Alex Kim', time: '2m ago', type: 'merge' },
    { icon: XCircle, color: 'var(--color-error)', text: 'Tests failed in data-pipeline', repo: 'data-pipeline', actor: 'CI Bot', time: '15m ago', type: 'ci' },
    { icon: GitCommit, color: 'var(--color-brand)', text: 'Pushed 3 commits to api-service', repo: 'api-service', actor: 'Alex Kim', time: '32m ago', type: 'push' },
    { icon: CheckCircle2, color: 'var(--color-success)', text: 'Workflow succeeded in frontend-app', repo: 'frontend-app', actor: 'CI Bot', time: '1 hr ago', type: 'workflow' },
  ];

  const activities = activityItems.length > 0 ? activityItems : defaultActivities;

  return (
    <div
      className="rounded-xl border p-5"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5" style={{ color: 'var(--color-brand)' }} />
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Activity Feed</h2>
        </div>
        <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Last updated 2m ago</span>
      </div>
      <div className="space-y-4">
        {activities.map((a: typeof defaultActivities[0], i: number) => (
          <div key={i} className="flex items-start gap-3">
            <div className="flex flex-col items-center gap-1 pt-1">
              <div className="w-2 h-2 rounded-full" style={{ background: a.color }} />
              {i < activities.length - 1 && (
                <div className="w-px flex-1 min-h-[2rem]" style={{ background: 'var(--color-border)' }} />
              )}
            </div>
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${a.color}20` }}>
              <a.icon className="w-3.5 h-3.5" style={{ color: a.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{a.text}</div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="neutral">{a.repo}</Badge>
                <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{a.actor} · {a.time}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

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
      className="rounded-xl border p-4 mb-6 flex items-center gap-3 flex-wrap"
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

export function OverviewPage() {
  const { data: repoData } = useRepos();
  const { monitoredRepos } = useMonitoredRepos();
  const { data: prData } = usePullRequests(monitoredRepos);
  const { data: mergeData } = useRecentMerges(monitoredRepos);
  const { data: failingData } = useFailingWorkflows(monitoredRepos);

  const filteredRepos = useMemo(
    () => monitoredRepos.length > 0
      ? (repoData || []).filter((r: any) => monitoredRepos.includes(r.full_name))
      : (repoData || []),
    [monitoredRepos, repoData],
  );

  const repoCount = filteredRepos.length;
  const prCount = (prData || []).length;
  const mergeCount = (mergeData || []).length;
  const failingCount = (failingData || []).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Good morning, Alex</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Here&apos;s what needs your attention today.</p>
      </div>

      <QuickActionsBar />

      <PinnedReposSection />

      <PlanMyDayCard />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={FolderGit2} label="Total Repos" value={repoCount || 0} trend="+2 this month" trendUp trendColor="var(--color-success)" />
        <StatCard icon={GitPullRequest} label="Open PRs" value={prCount || 0} trend="-8% from last week" trendUp={false} trendColor="var(--color-success)" />
        <StatCard icon={AlertTriangle} label="Failing Checks" value={failingCount} trend={failingCount > 0 ? 'needs attention' : 'all green'} trendUp={failingCount > 0} trendColor={failingCount > 0 ? 'var(--color-error)' : 'var(--color-success)'} />
        <StatCard icon={GitMerge} label="Recent Merges" value={mergeCount} trend={mergeCount > 0 ? '+this week' : 'none this week'} trendUp trendColor="var(--color-success)" />
      </div>

      <ActivityFeed />
    </div>
  );
}
