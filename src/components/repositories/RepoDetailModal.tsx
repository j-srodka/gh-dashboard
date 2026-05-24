import { useState } from 'react';
import {
  useWorkflowRuns,
  useRepoPullRequests,
  useRepoIssues,
  useRepoReleases,
  useTrafficClones,
  useTrafficViews,
  useDependents,
  useMentions,
  useIsRepoStarred,
  useIsRepoWatched,
  useStarRepo,
  useUnstarRepo,
  useWatchRepo,
  useUnwatchRepo,
} from '@/hooks/useGitHubQuery';
import { LANGUAGE_COLORS } from '@/lib/constants';
import {
  X,
  GitPullRequest,
  CircleDot,
  PlayCircle,
  Tag,
  GitBranch,
  Star,
  Eye,
  ExternalLink,
  GitFork,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  Package,
  MessageSquare,
  Loader2,
} from 'lucide-react';

interface RepoDetailModalProps {
  repo: any;
  isOpen: boolean;
  onClose: () => void;
}

type TabKey = 'overview' | 'prs' | 'issues' | 'actions' | 'releases' | 'traffic' | 'dependents' | 'mentions';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'prs', label: 'Pull Requests' },
  { key: 'issues', label: 'Issues' },
  { key: 'actions', label: 'Actions' },
  { key: 'releases', label: 'Releases' },
  { key: 'traffic', label: 'Traffic' },
  { key: 'dependents', label: 'Dependents' },
  { key: 'mentions', label: 'Mentions' },
];

export function RepoDetailModal({ repo, isOpen, onClose }: RepoDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  if (!isOpen || !repo) return null;

  const [owner, repoName] = repo.full_name.split('/');

  // Star state
  const { data: isStarred, isLoading: starLoading } = useIsRepoStarred(owner, repoName);
  const starRepo = useStarRepo();
  const unstarRepo = useUnstarRepo();

  // Watch state
  const { data: isWatched, isLoading: watchLoading } = useIsRepoWatched(owner, repoName);
  const watchRepo = useWatchRepo();
  const unwatchRepo = useUnwatchRepo();

  const handleStar = () => {
    if (starRepo.isPending || unstarRepo.isPending) return;
    if (isStarred) {
      unstarRepo.mutate({ owner, repo: repoName });
    } else {
      starRepo.mutate({ owner, repo: repoName });
    }
  };

  const handleWatch = () => {
    if (watchRepo.isPending || unwatchRepo.isPending) return;
    if (isWatched) {
      unwatchRepo.mutate({ owner, repo: repoName });
    } else {
      watchRepo.mutate({ owner, repo: repoName });
    }
  };

  const starPending = starRepo.isPending || unstarRepo.isPending;
  const watchPending = watchRepo.isPending || unwatchRepo.isPending;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-[92%] max-w-4xl max-h-[85vh] rounded-xl border shadow-2xl flex flex-col overflow-hidden"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: LANGUAGE_COLORS[repo.language] || '#94a3b8' }}
            >
              <GitBranch className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                {repo.full_name}
              </h2>
              <p className="text-xs truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                {repo.description || 'No description'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Star toggle */}
            <button
              onClick={handleStar}
              disabled={starPending || starLoading}
              className="p-2 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              style={{ color: isStarred ? 'var(--color-warning)' : 'var(--color-text-tertiary)' }}
              title={isStarred ? 'Unstar repository' : 'Star repository'}
            >
              {starPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Star className="w-4 h-4" fill={isStarred ? 'currentColor' : 'none'} />
              )}
            </button>
            {/* Watch toggle */}
            <button
              onClick={handleWatch}
              disabled={watchPending || watchLoading}
              className="p-2 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              style={{ color: isWatched ? 'var(--color-info)' : 'var(--color-text-tertiary)' }}
              title={isWatched ? 'Unwatch repository' : 'Watch repository'}
            >
              {watchPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
            {/* Quick PR */}
            <a
              href={`https://github.com/${owner}/${repoName}/compare`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              style={{ color: 'var(--color-text-tertiary)' }}
              title="Open compare / new pull request"
            >
              <GitPullRequest className="w-4 h-4" />
            </a>
            <a
              href={repo.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              style={{ color: 'var(--color-text-tertiary)' }}
              title="Open on GitHub"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="px-3 py-2 text-xs font-medium rounded-t-lg transition-colors relative"
              style={{
                color: activeTab === tab.key ? 'var(--color-brand)' : 'var(--color-text-tertiary)',
                background: activeTab === tab.key ? 'var(--color-surface-secondary)' : 'transparent',
              }}
            >
              {tab.label}
              {activeTab === tab.key && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                  style={{ background: 'var(--color-brand)' }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'overview' && <OverviewTab repo={repo} />}
          {activeTab === 'prs' && <PullRequestsTab owner={owner} repo={repoName} />}
          {activeTab === 'issues' && <IssuesTab owner={owner} repo={repoName} />}
          {activeTab === 'actions' && <ActionsTab owner={owner} repo={repoName} />}
          {activeTab === 'releases' && <ReleasesTab owner={owner} repo={repoName} />}
          {activeTab === 'traffic' && <TrafficTab owner={owner} repo={repoName} />}
          {activeTab === 'dependents' && <DependentsTab owner={owner} repo={repoName} />}
          {activeTab === 'mentions' && <MentionsTab owner={owner} repo={repoName} />}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ repo }: { repo: any }) {
  const [owner, repoName] = repo.full_name.split('/');
  const { data: issuesData } = useRepoIssues(owner, repoName);
  const realIssues = (issuesData || []).filter((i: any) => !i.pull_request);
  const openIssuesCount = realIssues.length;

  const stats = [
    { icon: Star, label: 'Stars', value: repo.stargazers_count || 0 },
    { icon: GitFork, label: 'Forks', value: repo.forks_count || 0 },
    { icon: Eye, label: 'Watchers', value: repo.watchers_count || 0 },
    { icon: CircleDot, label: 'Open Issues', value: openIssuesCount },
  ];

  const meta = [
    { label: 'Default Branch', value: repo.default_branch || 'main' },
    { label: 'Language', value: repo.language || 'Unknown' },
    { label: 'Visibility', value: repo.visibility || 'public' },
    {
      label: 'Created',
      value: repo.created_at ? new Date(repo.created_at).toLocaleDateString() : 'N/A',
    },
    {
      label: 'Updated',
      value: repo.updated_at ? new Date(repo.updated_at).toLocaleDateString() : 'N/A',
    },
    {
      label: 'Pushed',
      value: repo.pushed_at ? new Date(repo.pushed_at).toLocaleDateString() : 'N/A',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border p-3 flex items-center gap-3"
            style={{ background: 'var(--color-surface-secondary)', borderColor: 'var(--color-border)' }}
          >
            <s.icon className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-brand)' }} />
            <div>
              <div className="text-lg font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                {s.value}
              </div>
              <div className="text-[10px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Description */}
      {repo.description && (
        <div className="rounded-lg border p-4" style={{ background: 'var(--color-surface-secondary)', borderColor: 'var(--color-border)' }}>
          <h3 className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>Description</h3>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{repo.description}</p>
        </div>
      )}

      {/* Topics */}
      {Array.isArray(repo.topics) && repo.topics.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>Topics</h3>
          <div className="flex flex-wrap gap-1.5">
            {repo.topics.map((topic: string) => (
              <span
                key={topic}
                className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{ background: 'var(--color-surface-tertiary)', color: 'var(--color-text-secondary)' }}
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Meta grid */}
      <div>
        <h3 className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {meta.map((m) => (
            <div
              key={m.label}
              className="rounded-lg border p-2.5"
              style={{ background: 'var(--color-surface-secondary)', borderColor: 'var(--color-border)' }}
            >
              <div className="text-[10px] font-medium mb-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{m.label}</div>
              <div className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{m.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PullRequestsTab({ owner, repo }: { owner: string; repo: string }) {
  const { data, isLoading } = useRepoPullRequests(owner, repo);
  const prs = data || [];

  if (isLoading) return <LoadingState />;
  if (prs.length === 0) return <EmptyState message="No open pull requests" />;

  return (
    <div className="space-y-2">
      {prs.map((pr: any) => (
        <div
          key={pr.id}
          className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <GitPullRequest className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-brand)' }} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{pr.title}</div>
            <div className="flex items-center gap-2 mt-0.5 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              <span>#{pr.number}</span>
              <span>·</span>
              <span>{pr.user?.login || 'unknown'}</span>
              <span>·</span>
              <span>{pr.draft ? 'Draft' : pr.state}</span>
            </div>
          </div>
          <button
            onClick={() => window.open(pr.html_url, '_blank')}
            className="p-1.5 rounded-md transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function IssuesTab({ owner, repo }: { owner: string; repo: string }) {
  const { data, isLoading } = useRepoIssues(owner, repo);
  const issues = (data || []).filter((i: any) => !i.pull_request);

  if (isLoading) return <LoadingState />;
  if (issues.length === 0) return <EmptyState message="No open issues" />;

  return (
    <div className="space-y-2">
      {issues.map((issue: any) => (
        <div
          key={issue.id}
          className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <CircleDot className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-success)' }} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{issue.title}</div>
            <div className="flex items-center gap-2 mt-0.5 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              <span>#{issue.number}</span>
              <span>·</span>
              <span>{issue.user?.login || 'unknown'}</span>
              {issue.labels?.length > 0 && (
                <>
                  <span>·</span>
                  <span className="truncate">{issue.labels.map((l: any) => l.name).join(', ')}</span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={() => window.open(issue.html_url, '_blank')}
            className="p-1.5 rounded-md transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function ActionsTab({ owner, repo }: { owner: string; repo: string }) {
  const { data, isLoading } = useWorkflowRuns(owner, repo);
  const runs = data || [];

  if (isLoading) return <LoadingState />;
  if (runs.length === 0) return <EmptyState message="No recent workflow runs" />;

  return (
    <div className="space-y-2">
      {runs.slice(0, 20).map((run: any) => {
        const isSuccess = run.conclusion === 'success';
        const isFailure = run.conclusion === 'failure';
        const isPending = run.status !== 'completed';

        return (
          <div
            key={run.id}
            className="flex items-center gap-3 rounded-lg border p-3"
            style={{ borderColor: 'var(--color-border)' }}
          >
            {isSuccess && <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-success)' }} />}
            {isFailure && <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-error)' }} />}
            {isPending && <Clock className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-warning)' }} />}
            {!isSuccess && !isFailure && !isPending && <PlayCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                {run.name || run.workflow_name || 'Workflow'}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                <span>{run.head_branch}</span>
                <span>·</span>
                <span>{run.conclusion || run.status}</span>
                <span>·</span>
                <span>{run.run_number}</span>
              </div>
            </div>
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
              {run.created_at ? new Date(run.created_at).toLocaleDateString() : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ReleasesTab({ owner, repo }: { owner: string; repo: string }) {
  const { data, isLoading } = useRepoReleases(owner, repo);
  const releases = data || [];

  if (isLoading) return <LoadingState />;
  if (releases.length === 0) return <EmptyState message="No releases" />;

  return (
    <div className="space-y-2">
      {releases.map((release: any) => (
        <div
          key={release.id}
          className="flex items-center gap-3 rounded-lg border p-3"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <Tag className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-brand)' }} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
              {release.name || release.tag_name}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              <span>{release.tag_name}</span>
              {release.prerelease && (
                <>
                  <span>·</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: 'var(--color-warning-light)', color: 'var(--color-warning)' }}>
                    Pre-release
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
            <Calendar className="w-3 h-3" />
            <span>{release.published_at ? new Date(release.published_at).toLocaleDateString() : 'N/A'}</span>
          </div>
          <button
            onClick={() => window.open(release.html_url, '_blank')}
            className="p-1.5 rounded-md transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function TrafficTab({ owner, repo }: { owner: string; repo: string }) {
  const { data: clonesData, isLoading: clonesLoading, error: clonesError } = useTrafficClones(owner, repo);
  const { data: viewsData, isLoading: viewsLoading, error: viewsError } = useTrafficViews(owner, repo);

  const isLoading = clonesLoading || viewsLoading;
  const hasError = clonesError || viewsError;
  const isForbidden =
    (clonesError as any)?.message?.includes('403') ||
    (viewsError as any)?.message?.includes('403');

  if (isLoading) return <LoadingState />;

  if (isForbidden || hasError) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--color-text-tertiary)' }} />
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
          Traffic data requires push access to this repository.
        </p>
        <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          Your current token does not have push permission for {owner}/{repo}.
        </p>
      </div>
    );
  }

  const clones = clonesData?.clones || [];
  const views = viewsData?.views || [];
  const maxClones = Math.max(...clones.map((c: any) => c.count), 1);
  const maxViews = Math.max(...views.map((v: any) => v.count), 1);

  return (
    <div className="space-y-6">
      {/* Clone stats */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <GitBranch className="w-4 h-4" style={{ color: 'var(--color-brand)' }} />
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
            Clones
          </h3>
          <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
            {clonesData?.count ?? 0} total · {clonesData?.uniques ?? 0} unique
          </span>
        </div>
        {clones.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>No clone data available yet.</p>
        ) : (
          <div className="space-y-1.5">
            {clones.slice(0, 14).map((day: any, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] w-12 text-right flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
                  {new Date(day.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
                <div className="flex-1 h-4 rounded-sm relative" style={{ background: 'var(--color-surface-tertiary)' }}>
                  <div
                    className="absolute inset-y-0 left-0 rounded-sm transition-all"
                    style={{
                      width: `${Math.max((day.count / maxClones) * 100, 2)}%`,
                      background: 'var(--color-brand)',
                      opacity: 0.7,
                    }}
                  />
                </div>
                <span className="text-[10px] w-6 text-left flex-shrink-0 font-medium tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                  {day.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* View stats */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Eye className="w-4 h-4" style={{ color: 'var(--color-brand)' }} />
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
            Views
          </h3>
          <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
            {viewsData?.count ?? 0} total · {viewsData?.uniques ?? 0} unique
          </span>
        </div>
        {views.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>No view data available yet.</p>
        ) : (
          <div className="space-y-1.5">
            {views.slice(0, 14).map((day: any, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] w-12 text-right flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
                  {new Date(day.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
                <div className="flex-1 h-4 rounded-sm relative" style={{ background: 'var(--color-surface-tertiary)' }}>
                  <div
                    className="absolute inset-y-0 left-0 rounded-sm transition-all"
                    style={{
                      width: `${Math.max((day.count / maxViews) * 100, 2)}%`,
                      background: 'var(--color-success)',
                      opacity: 0.7,
                    }}
                  />
                </div>
                <span className="text-[10px] w-6 text-left flex-shrink-0 font-medium tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                  {day.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DependentsTab({ owner, repo }: { owner: string; repo: string }) {
  const { data, isLoading, error } = useDependents(owner, repo);
  const dependents = data || [];

  if (isLoading) return <LoadingState />;

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--color-text-tertiary)' }} />
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Unable to load dependent repositories.
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>{(error as any)?.message || 'Unknown error'}</p>
      </div>
    );
  }

  if (dependents.length === 0) {
    return <EmptyState message="No dependent repositories found." />;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <Package className="w-4 h-4" style={{ color: 'var(--color-brand)' }} />
        <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
          {dependents.length} dependent repo{dependents.length !== 1 ? 's' : ''}
        </span>
      </div>
      {dependents.map((d: any, i: number) => (
        <div
          key={`${d.full_name}-${i}`}
          className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {d.source === 'fork' ? (
            <GitFork className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
          ) : (
            <Package className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{d.full_name}</div>
            {d.description && (
              <div className="text-xs truncate mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{d.description}</div>
            )}
          </div>
          {d.stargazers_count > 0 && (
            <div className="flex items-center gap-1 text-xs flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
              <Star className="w-3 h-3" />
              <span className="tabular-nums">{d.stargazers_count}</span>
            </div>
          )}
          <button
            onClick={() => window.open(d.html_url, '_blank')}
            className="p-1.5 rounded-md transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function MentionsTab({ owner, repo }: { owner: string; repo: string }) {
  const { data, isLoading, error } = useMentions(owner, repo);
  const mentions = data || [];

  if (isLoading) return <LoadingState />;

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--color-text-tertiary)' }} />
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Unable to load mentions.
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>{(error as any)?.message || 'Unknown error'}</p>
      </div>
    );
  }

  if (mentions.length === 0) {
    return <EmptyState message="No cross-repo mentions found." />;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4" style={{ color: 'var(--color-brand)' }} />
        <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
          {mentions.length} mention{mentions.length !== 1 ? 's' : ''} across GitHub
        </span>
      </div>
      {mentions.map((item: any) => {
        const isPR = item.pull_request !== undefined;
        const itemRepo = item.repository_url
          ? item.repository_url.replace('https://api.github.com/repos/', '')
          : 'unknown';
        return (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
            style={{ borderColor: 'var(--color-border)' }}
          >
            {isPR ? (
              <GitPullRequest className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-brand)' }} />
            ) : (
              <CircleDot className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-success)' }} />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{item.title}</div>
              <div className="flex items-center gap-2 mt-0.5 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                <span>{itemRepo}#{item.number}</span>
                <span>·</span>
                <span>{item.user?.login || 'unknown'}</span>
                <span>·</span>
                <span>{item.state}</span>
              </div>
            </div>
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
              {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
            </span>
            <button
              onClick={() => window.open(item.html_url, '_blank')}
              className="p-1.5 rounded-md transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-lg border p-3 animate-pulse" style={{ borderColor: 'var(--color-border)' }}>
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2" />
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12">
      <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--color-text-tertiary)' }} />
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{message}</p>
    </div>
  );
}
