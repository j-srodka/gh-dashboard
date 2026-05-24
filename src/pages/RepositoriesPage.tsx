import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useRepos,
  useIsRepoStarred,
  useIsRepoWatched,
  useStarRepo,
  useUnstarRepo,
  useWatchRepo,
  useUnwatchRepo,
} from '@/hooks/useGitHubQuery';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useMonitoredRepos } from '@/hooks/useMonitoredRepos';
import { StatusDot } from '@/components/ui';
import { RepoDetailModal } from '@/components/repositories/RepoDetailModal';
import { LANGUAGE_COLORS } from '@/lib/constants';
import {
  Pin,
  FolderGit2,
  Star,
  Zap,
  Eye,
  GitPullRequest,
  CircleDot,
  PlayCircle,
  Loader2,
} from 'lucide-react';

function RepoCard({
  repo,
  isPinned,
  onTogglePin,
  onSelect,
}: {
  repo: any;
  isPinned: boolean;
  onTogglePin: () => void;
  onSelect: () => void;
}) {
  const navigate = useNavigate();
  const [owner, repoName] = repo.full_name.split('/');
  const color = LANGUAGE_COLORS[repo.language] || '#94a3b8';

  // Star state
  const { data: isStarred, isLoading: starLoading } = useIsRepoStarred(owner, repoName);
  const starRepo = useStarRepo();
  const unstarRepo = useUnstarRepo();

  // Watch state
  const { data: isWatched, isLoading: watchLoading } = useIsRepoWatched(owner, repoName);
  const watchRepo = useWatchRepo();
  const unwatchRepo = useUnwatchRepo();

  const handleStar = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (starRepo.isPending || unstarRepo.isPending) return;
    if (isStarred) {
      unstarRepo.mutate({ owner, repo: repoName });
    } else {
      starRepo.mutate({ owner, repo: repoName });
    }
  };

  const handleWatch = (e: React.MouseEvent) => {
    e.stopPropagation();
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
      onClick={onSelect}
      className="rounded-xl border p-5 flex flex-col card-hover cursor-pointer group"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <FolderGit2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-brand)' }} />
          <span className="font-semibold text-sm truncate" style={{ color: 'var(--color-brand)' }}>{repo.name}</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Star toggle */}
          <button
            onClick={handleStar}
            disabled={starPending || starLoading}
            className={`p-1 rounded-md transition-all ${isStarred ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
            style={{ color: isStarred ? 'var(--color-warning)' : 'var(--color-text-tertiary)' }}
            title={isStarred ? 'Unstar repository' : 'Star repository'}
          >
            {starPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Star className="w-3.5 h-3.5" fill={isStarred ? 'currentColor' : 'none'} />
            )}
          </button>
          {/* Watch toggle */}
          <button
            onClick={handleWatch}
            disabled={watchPending || watchLoading}
            className={`p-1 rounded-md transition-all ${isWatched ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
            style={{ color: isWatched ? 'var(--color-info)' : 'var(--color-text-tertiary)' }}
            title={isWatched ? 'Unwatch repository' : 'Watch repository'}
          >
            {watchPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
          </button>
          {/* Pin */}
          <button
            onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
            className={`p-1 rounded-md transition-all ${isPinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
            style={{ color: isPinned ? 'var(--color-warning)' : 'var(--color-text-tertiary)' }}
            title={isPinned ? 'Unpin repository' : 'Pin repository'}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
          <StatusDot status={repo.open_issues_count > 5 ? 'error' : repo.open_issues_count > 0 ? 'warning' : 'success'} />
        </div>
      </div>
      <p className="text-xs mb-3 line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>{repo.description || 'No description'}</p>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {repo.language && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: `${color}20`, color }}>
            {repo.language}
          </span>
        )}
        <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          <Star className="w-3 h-3" />{repo.stargazers_count || 0}
        </span>
        <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          {repo.updated_at ? new Date(repo.updated_at).toLocaleDateString() : 'N/A'}
        </span>
        <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{repo.default_branch || 'main'}</span>
      </div>
      <div className="flex items-center gap-2 pt-3 border-t mt-auto" style={{ borderColor: 'var(--color-border)' }}>
        <a
          href={`https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/compare`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 px-2 rounded-md transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <GitPullRequest className="w-3 h-3" />
          Quick PR
        </a>
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/issues?repo=${encodeURIComponent(repo.name)}`); }}
          className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 px-2 rounded-md transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <CircleDot className="w-3 h-3" />
          Issues
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/actions?repo=${encodeURIComponent(repo.name)}`); }}
          className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 px-2 rounded-md transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <PlayCircle className="w-3 h-3" />
          Workflows
        </button>
      </div>
    </div>
  );
}

export function RepositoriesPage() {
  const { data, isLoading, isError } = useRepos();
  const { monitoredRepos } = useMonitoredRepos();
  const [pinnedRepos, setPinnedRepos] = useLocalStorage<string[]>('pinnedRepos', []);
  const [selectedRepo, setSelectedRepo] = useState<any>(null);

  function togglePin(repoFullName: string) {
    setPinnedRepos((prev) =>
      prev.includes(repoFullName) ? prev.filter((n) => n !== repoFullName) : [...prev, repoFullName],
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="rounded-xl border p-5 animate-pulse" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-3" />
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full mb-4" />
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border p-8 text-center" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <Zap className="w-8 h-8 mx-auto mb-3 text-red-500" />
        <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>Failed to load repositories</h3>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Make sure gh auth login is completed.</p>
      </div>
    );
  }

  const repos = monitoredRepos.length > 0
    ? (data || []).filter((r: any) => monitoredRepos.includes(r.full_name))
    : (data || []);
  const pinnedFirst = [...repos].sort((a: any, b: any) => {
    const aPinned = pinnedRepos.includes(a.full_name) ? 1 : 0;
    const bPinned = pinnedRepos.includes(b.full_name) ? 1 : 0;
    return bPinned - aPinned;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Repositories</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Software catalog across your organization</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {pinnedFirst.map((repo: any) => {
          const isPinned = pinnedRepos.includes(repo.full_name);
          return (
            <RepoCard
              key={repo.id}
              repo={repo}
              isPinned={isPinned}
              onTogglePin={() => togglePin(repo.full_name)}
              onSelect={() => setSelectedRepo(repo)}
            />
          );
        })}
      </div>

      <RepoDetailModal
        repo={selectedRepo}
        isOpen={!!selectedRepo}
        onClose={() => setSelectedRepo(null)}
      />
    </div>
  );
}
