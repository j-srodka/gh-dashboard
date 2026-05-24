import { useState, useMemo, useRef, useEffect } from 'react';
import { usePullRequests, useReviewRequests, useReviewPullRequest } from '@/hooks/useGitHubQuery';
import { useMonitoredRepos } from '@/hooks/useMonitoredRepos';
import { useSavedViews, type SavedView } from '@/hooks/useSavedViews';
import { StatusDot } from '@/components/ui/StatusDot';
import { AuthorAvatar } from '@/components/ui/AuthorAvatar';
import { exportToJson } from '@/lib/utils';
import { GitPullRequest, MessageCircle, Download, Bookmark, ChevronDown, Trash2, Plus } from 'lucide-react';

function ReviewBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    APPROVED: 'bg-emerald-100 text-emerald-700',
    CHANGES_REQUESTED: 'bg-red-100 text-red-700',
    REVIEW_REQUIRED: 'bg-amber-100 text-amber-700',
    PENDING: 'bg-slate-100 text-slate-600',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.PENDING}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

type SortOption = 'newest' | 'oldest' | 'title-az' | 'title-za';
type StatusFilter = 'all' | 'open' | 'draft' | 'blocked' | 'approved';
type Preset = 'none' | 'my-prs' | 'needs-review' | 'draft' | 'merged-week';

export function PullRequestsPage() {
  const { monitoredRepos } = useMonitoredRepos();
  const { data: prData, isLoading } = usePullRequests(monitoredRepos);
  const { data: reviewData } = useReviewRequests(monitoredRepos);
  const reviewMutation = useReviewPullRequest();
  const [repoFilter, setRepoFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [preset, setPreset] = useState<Preset>('none');
  const { savedViews, saveView, deleteView, applyView } = useSavedViews();
  const [savedViewOpen, setSavedViewOpen] = useState(false);
  const [saveInputOpen, setSaveInputOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const savedViewRef = useRef<HTMLDivElement>(null);

  // Click outside to close saved views dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (savedViewRef.current && !savedViewRef.current.contains(e.target as Node)) {
        setSavedViewOpen(false);
        setSaveInputOpen(false);
      }
    }
    if (savedViewOpen || saveInputOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [savedViewOpen, saveInputOpen]);

  const allPrs = useMemo(() => {
    const authorPRs = (prData || []);
    const reviewerPRs = (reviewData || []);
    const combined = [...authorPRs];
    reviewerPRs.forEach((pr: any) => {
      if (!combined.find((p: any) => p.id === pr.id)) combined.push(pr);
    });
    return combined;
  }, [prData, reviewData]);

  const uniqueRepos = useMemo(() => {
    const repos = new Set<string>();
    allPrs.forEach((pr: any) => {
      const repoName = pr.repository_url?.split('/').pop();
      if (repoName) repos.add(repoName);
    });
    return Array.from(repos).sort();
  }, [allPrs]);

  const filteredAndSorted = useMemo(() => {
    let result = [...allPrs];

    if (repoFilter !== 'all') {
      result = result.filter((pr: any) => pr.repository_url?.split('/').pop() === repoFilter);
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'open') {
        result = result.filter((pr: any) => pr.state === 'open' && !pr.draft);
      } else if (statusFilter === 'draft') {
        result = result.filter((pr: any) => pr.draft);
      } else if (statusFilter === 'blocked') {
        result = result.filter((pr: any) => pr.state === 'failure' || pr.state === 'closed');
      } else if (statusFilter === 'approved') {
        result = result.filter((pr: any) => pr.state === 'APPROVED');
      }
    }

    result.sort((a: any, b: any) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        case 'oldest':
          return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
        case 'title-az':
          return a.title.localeCompare(b.title);
        case 'title-za':
          return b.title.localeCompare(a.title);
        default:
          return 0;
      }
    });

    return result;
  }, [allPrs, repoFilter, sortBy, statusFilter]);

  const handleNewPR = () => {
    let owner = '';
    let repo = '';
    if (monitoredRepos.length > 0) {
      const parts = monitoredRepos[0].split('/');
      owner = parts[0];
      repo = parts[1];
    } else if (allPrs.length > 0) {
      const urlParts = allPrs[0].repository_url?.split('/');
      if (urlParts && urlParts.length >= 2) {
        owner = urlParts[urlParts.length - 2];
        repo = urlParts[urlParts.length - 1];
      }
    }
    if (owner && repo) {
      window.open(`https://github.com/${owner}/${repo}/compare`, '_blank', 'noopener,noreferrer');
    }
  };

  if (isLoading) {
    return <div className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Pull Requests</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Cross-repo view of all open pull requests</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportToJson(filteredAndSorted, 'pull-requests.json')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:border-blue-300"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)', background: 'var(--color-surface-secondary)' }}
          >
            <Download className="w-3.5 h-3.5" /> Export JSON
          </button>
          <button
            onClick={handleNewPR}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
            style={{ background: 'var(--color-brand)' }}
          >
            <GitPullRequest className="w-4 h-4" /> New PR
          </button>
        </div>
      </div>

      {/* Quick Filter Presets */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Quick Filters:</span>
        {([
          { key: 'my-prs' as Preset, label: 'My PRs', description: 'Open PRs I authored' },
          { key: 'needs-review' as Preset, label: 'Needs review', description: 'Open PRs needing review' },
          { key: 'draft' as Preset, label: 'Draft', description: 'Work-in-progress PRs' },
          { key: 'merged-week' as Preset, label: 'Merged this week', description: 'Recently merged' },
        ]).map((p) => (
          <button
            key={p.key}
            onClick={() => {
              setPreset(p.key);
              switch (p.key) {
                case 'my-prs':
                  setStatusFilter('open');
                  setSortBy('newest');
                  break;
                case 'needs-review':
                  setStatusFilter('open');
                  setSortBy('newest');
                  break;
                case 'draft':
                  setStatusFilter('draft');
                  setSortBy('newest');
                  break;
                case 'merged-week':
                  setStatusFilter('all');
                  setSortBy('newest');
                  break;
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              preset === p.key ? 'text-white' : 'hover:border-blue-300'
            }`}
            style={
              preset === p.key
                ? { background: 'var(--color-brand)', borderColor: 'var(--color-brand)' }
                : { background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }
            }
            title={p.description}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border p-4 mb-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search PRs..."
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors"
              style={{ background: 'var(--color-surface-secondary)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            />
          </div>
          <select
            value={repoFilter}
            onChange={(e) => setRepoFilter(e.target.value)}
            className="min-w-[160px] rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ background: 'var(--color-surface-secondary)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
          >
            <option value="all">All Repositories</option>
            {uniqueRepos.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value as SortOption); setPreset('none'); }}
            className="min-w-[140px] rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ background: 'var(--color-surface-secondary)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="title-az">Title A-Z</option>
            <option value="title-za">Title Z-A</option>
          </select>
          <div className="flex gap-2 flex-wrap">
            {(['all', 'open', 'draft', 'blocked', 'approved'] as StatusFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => { setStatusFilter(f); setPreset('none'); }}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  statusFilter === f ? 'text-white' : 'hover:border-blue-300'
                }`}
                style={
                  statusFilter === f
                    ? { background: 'var(--color-brand)', borderColor: 'var(--color-brand)' }
                    : { background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }
                }
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Saved Views */}
          <div className="relative flex items-center gap-2 ml-auto" ref={savedViewRef}>
            {/* Save current filter button */}
            <button
              onClick={() => {
                if (saveInputOpen) {
                  const trimmed = saveName.trim();
                  if (trimmed) {
                    saveView(trimmed, {
                      repoFilter,
                      statusFilter,
                      sortBy,
                    });
                    setSaveName('');
                  }
                  setSaveInputOpen(false);
                } else {
                  setSaveInputOpen(true);
                  setSavedViewOpen(false);
                }
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:border-blue-300"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
              title="Save current filter as a view"
            >
              {saveInputOpen ? (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const trimmed = saveName.trim();
                        if (trimmed) {
                          saveView(trimmed, { repoFilter, statusFilter, sortBy });
                          setSaveName('');
                          setSaveInputOpen(false);
                        }
                      }
                      if (e.key === 'Escape') {
                        setSaveName('');
                        setSaveInputOpen(false);
                      }
                      e.stopPropagation();
                    }}
                    placeholder="View name..."
                    autoFocus
                    className="w-24 bg-transparent outline-none text-xs"
                    style={{ color: 'var(--color-text-primary)' }}
                  />
                </>
              ) : (
                <>
                  <Bookmark className="w-3.5 h-3.5" /> Save View
                </>
              )}
            </button>

            {/* Saved views dropdown */}
            <button
              onClick={() => {
                setSavedViewOpen(!savedViewOpen);
                setSaveInputOpen(false);
              }}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:border-blue-300"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
              title="Saved views"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {savedViewOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-56 rounded-xl border shadow-lg z-50 overflow-hidden"
                style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
              >
                <div className="p-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
                    Saved Views
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto p-1">
                  {savedViews.length === 0 && (
                    <div className="text-[11px] py-4 text-center" style={{ color: 'var(--color-text-tertiary)' }}>
                      No saved views yet
                    </div>
                  )}
                  {savedViews.map((view: SavedView) => (
                    <div
                      key={view.id}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/50 group"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      <button
                        onClick={() => {
                          const v = applyView(view.id);
                          if (v) {
                            if (v.repoFilter) setRepoFilter(v.repoFilter);
                            if (v.statusFilter) setStatusFilter(v.statusFilter as StatusFilter);
                            if (v.sortBy) setSortBy(v.sortBy as SortOption);
                            setPreset('none');
                            setSavedViewOpen(false);
                          }
                        }}
                        className="flex-1 text-left truncate"
                        title={view.name}
                      >
                        <span className="flex items-center gap-1.5">
                          <Bookmark className="w-3 h-3 flex-shrink-0" />
                          {view.name}
                        </span>
                      </button>
                      <button
                        onClick={() => deleteView(view.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all hover:bg-red-50 dark:hover:bg-red-900/20"
                        style={{ color: 'var(--color-error)' }}
                        title="Delete saved view"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {filteredAndSorted.length === 0 && (
          <div className="text-center py-8 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>No pull requests match your filters</div>
        )}
        {filteredAndSorted.map((pr: any) => {
          const repoName = pr.repository_url?.split('/').pop() || 'unknown';
          const ciStatus = pr.draft ? 'pending' : pr.state === 'failure' ? 'failure' : 'success';
          const reviewStatus = pr.state === 'APPROVED' ? 'APPROVED' : 'PENDING';
          const urlParts = pr.repository_url?.split('/') || [];
          const owner = urlParts.length >= 2 ? urlParts[urlParts.length - 2] : '';
          const repo = urlParts.length >= 1 ? urlParts[urlParts.length - 1] : '';
          return (
            <div
              key={pr.id}
              className="rounded-xl border p-4 flex items-center gap-4"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              <StatusDot status={ciStatus} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{pr.title}</span>
                  {pr.draft && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'var(--color-surface-tertiary)', color: 'var(--color-text-tertiary)', border: '1px dashed var(--color-border)' }}>
                      Draft
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'var(--color-surface-tertiary)', color: 'var(--color-text-secondary)' }}>{repoName}</span>
                  {pr.labels?.slice(0, 3).map((l: any) => (
                    <span key={l.name} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'var(--color-info-light)', color: '#1e40af' }}>
                      {l.name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <AuthorAvatar author={pr.user?.login || 'UN'} />
                <ReviewBadge status={reviewStatus} />
                <span className="text-xs flex items-center gap-1" style={{ color: 'var(--color-text-tertiary)' }}>
                  <MessageCircle className="w-3.5 h-3.5" /> {pr.comments || 0}
                </span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  disabled={reviewMutation.isPending}
                  onClick={() => reviewMutation.mutate({ owner, repo, number: pr.number, event: 'APPROVE' })}
                  className="text-xs px-2 py-1 rounded-md transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Approve
                </button>
                <button
                  disabled={reviewMutation.isPending}
                  onClick={() => reviewMutation.mutate({ owner, repo, number: pr.number, event: 'REQUEST_CHANGES' })}
                  className="text-xs px-2 py-1 rounded-md transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Request Changes
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
