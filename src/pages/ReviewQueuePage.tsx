import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { githubGet } from '@/lib/api';
import { useReviewRequests, useReviewPullRequest } from '@/hooks/useGitHubQuery';
import { useMonitoredRepos } from '@/hooks/useMonitoredRepos';
import { StatusDot } from '@/components/ui/StatusDot';
import { AuthorAvatar } from '@/components/ui/AuthorAvatar';
import {
  Eye,
  FileCode,
  CheckCircle2,
  XCircle,
  MessageSquare,
  ChevronRight,
  Clock,
  AlertCircle,
  AlertTriangle,
  Layers,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface PRItem {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: string;
  draft?: boolean;
  created_at: string;
  updated_at: string;
  user: { login: string; avatar_url: string };
  labels: { name: string; color: string }[];
  comments: number;
  repository_url: string;
  requested_reviewers?: { login: string; avatar_url: string }[];
  requested_teams?: { name: string; slug: string }[];
  score?: number;
}

interface FileDiff {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  blob_url: string;
}

type SortMode = 'urgency' | 'oldest' | 'newest';

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseRepoFullName(repositoryUrl: string): string {
  const parts = repositoryUrl.replace('https://api.github.com/repos/', '').split('/');
  if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
  return repositoryUrl.split('/').slice(-2).join('/');
}

function computeUrgency(pr: PRItem): number {
  let score = 0;
  const daysOld = (Date.now() - new Date(pr.created_at).getTime()) / (1000 * 60 * 60 * 24);
  // Older PRs need attention
  score += Math.min(daysOld * 2, 40);
  // Draft PRs are less urgent
  if (pr.draft) score -= 15;
  // PRs with many requested reviewers are higher priority
  const reviewerCount = (pr.requested_reviewers?.length || 0) + (pr.requested_teams?.length || 0);
  score += reviewerCount * 5;
  // More comments = more discussion = attention needed
  score += Math.min(pr.comments * 2, 20);
  return Math.max(score, 0);
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function truncateDiff(patch: string, maxLines: number = 50): string {
  const lines = patch.split('\n');
  if (lines.length <= maxLines) return patch;
  return lines.slice(0, maxLines).join('\n') + `\n\n... (${lines.length - maxLines} more lines truncated)`;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function DiffLine({ line }: { line: string }) {
  let bg = 'transparent';
  let textColor = 'var(--color-text-primary)';
  let prefix = '  ';
  let content = line;
  if (line.startsWith('+') && !line.startsWith('+++')) {
    bg = 'rgba(16, 185, 129, 0.1)';
    textColor = 'var(--color-success)';
    prefix = '+';
    content = line.slice(1);
  } else if (line.startsWith('-') && !line.startsWith('---')) {
    bg = 'rgba(239, 68, 68, 0.1)';
    textColor = 'var(--color-error)';
    prefix = '-';
    content = line.slice(1);
  } else if (line.startsWith('@@')) {
    bg = 'rgba(59, 130, 246, 0.08)';
    textColor = 'var(--color-info)';
    prefix = '';
  }
  return (
    <div
      className="text-xs leading-relaxed whitespace-pre font-mono px-2 py-px"
      style={{ background: bg, color: textColor }}
    >
      {prefix}{content}
    </div>
  );
}

function ConfirmationDialog({
  title,
  message,
  onConfirm,
  onCancel,
  isLoading,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div
        className="rounded-xl border shadow-xl p-6 w-full max-w-sm mx-4"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
          {title}
        </h3>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          {message}
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-50"
            style={{ background: 'var(--color-brand)' }}
          >
            {isLoading ? 'Submitting...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function ReviewQueuePage() {
  const { monitoredRepos } = useMonitoredRepos();
  const { data: reviewData, isLoading } = useReviewRequests(monitoredRepos);
  const reviewMutation = useReviewPullRequest();
  const queryClient = useQueryClient();

  // ── Local state ──────────────────────────────────────────────────────────
  const [sortBy, setSortBy] = useState<SortMode>('urgency');
  const [repoFilter, setRepoFilter] = useState<string>('all');
  const [expandedPR, setExpandedPR] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    owner: string;
    repo: string;
    number: number;
    event: 'APPROVE' | 'REQUEST_CHANGES';
  } | null>(null);

  // ── Process PR data ──────────────────────────────────────────────────────
  const prs = useMemo(() => {
    const items = (reviewData || []) as PRItem[];
    return items.map((pr) => ({ ...pr, _repoFull: parseRepoFullName(pr.repository_url) }));
  }, [reviewData]);

  const repoGroups = useMemo(() => {
    const groups = new Map<string, PRItem[]>();
    prs.forEach((pr: any) => {
      const repo = pr._repoFull;
      if (!groups.has(repo)) groups.set(repo, []);
      groups.get(repo)!.push(pr);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [prs]);

  const uniqueRepos = useMemo(() => {
    const repos = new Set<string>();
    prs.forEach((pr: any) => repos.add(pr._repoFull));
    return Array.from(repos).sort();
  }, [prs]);

  const filteredPRs = useMemo(() => {
    let result = repoFilter === 'all' ? [...prs] : prs.filter((p: any) => p._repoFull === repoFilter);
    result.sort((a: any, b: any) => {
      switch (sortBy) {
        case 'urgency':
          return computeUrgency(b) - computeUrgency(a);
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        default:
          return 0;
      }
    });
    return result;
  }, [prs, repoFilter, sortBy]);

  // ── Diff files query (fetched only when a PR is expanded) ────────────────
  const expandedPRData = useMemo(
    () => prs.find((p: any) => p.id === expandedPR),
    [prs, expandedPR],
  );

  const [expandedOwner, expandedRepo] = useMemo(() => {
    if (!expandedPRData) return [null, null];
    const parts = (expandedPRData as any)._repoFull.split('/');
    return [parts[0] || null, parts[1] || null];
  }, [expandedPRData]);

  const { data: diffFiles, isLoading: diffLoading } = useQuery({
    queryKey: ['diff-files', expandedOwner, expandedRepo, expandedPR],
    queryFn: () =>
      githubGet<FileDiff[]>(
        `repos/${encodeURIComponent(expandedOwner!)}/${encodeURIComponent(expandedRepo!)}/pulls/${expandedPRData?.number}/files`,
      ),
    enabled: !!expandedOwner && !!expandedRepo && expandedPR !== null && !!expandedPRData,
    staleTime: 60_000, // Cache diff files for 1 minute
  });

  // ── Selected file diff content ───────────────────────────────────────────
  const selectedDiff = useMemo(() => {
    if (!diffFiles || !selectedFile) return null;
    return diffFiles.find((f) => f.filename === selectedFile) || null;
  }, [diffFiles, selectedFile]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleTogglePR = useCallback(
    (prId: number) => {
      if (expandedPR === prId) {
        setExpandedPR(null);
        setSelectedFile(null);
      } else {
        setExpandedPR(prId);
        setSelectedFile(null);
      }
    },
    [expandedPR],
  );

  const handleReviewAction = useCallback(
    (owner: string, repo: string, number: number, event: 'APPROVE' | 'REQUEST_CHANGES') => {
      setConfirmAction({ owner, repo, number, event });
    },
    [],
  );

  const [reviewError, setReviewError] = useState<string | null>(null);

  const executeReview = useCallback(() => {
    if (!confirmAction) return;
    setReviewError(null);
    reviewMutation.mutate(
      {
        owner: confirmAction.owner,
        repo: confirmAction.repo,
        number: confirmAction.number,
        event: confirmAction.event,
      },
      {
        onSuccess: () => {
          setConfirmAction(null);
          setExpandedPR(null);
          setSelectedFile(null);
          queryClient.invalidateQueries({ queryKey: ['review-queue'] });
          queryClient.invalidateQueries({ queryKey: ['pulls'] });
          queryClient.invalidateQueries({ queryKey: ['diff-files'] });
        },
        onError: (err: any) => {
          setReviewError(err?.message || 'Review action failed. The PR may have been merged or have a merge conflict.');
        },
      },
    );
  }, [confirmAction, reviewMutation, queryClient]);

  // ── Render ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
        Loading review queue...
      </div>
    );
  }

  const totalPRs = filteredPRs.length;

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Review Queue
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            {totalPRs} pull request{totalPRs !== 1 ? 's' : ''} awaiting your review across{' '}
            {uniqueRepos.length} repo{uniqueRepos.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* ── Controls ────────────────────────────────────────────────────── */}
      <div
        className="rounded-xl border p-4 mb-6"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={repoFilter}
            onChange={(e) => setRepoFilter(e.target.value)}
            className="min-w-[180px] rounded-lg border px-3 py-2 text-sm outline-none"
            style={{
              background: 'var(--color-surface-secondary)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          >
            <option value="all">All Repositories</option>
            {uniqueRepos.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortMode)}
            className="min-w-[160px] rounded-lg border px-3 py-2 text-sm outline-none"
            style={{
              background: 'var(--color-surface-secondary)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          >
            <option value="urgency">Most Urgent</option>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
          <div className="flex-1" />
          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            {totalPRs} PR{totalPRs !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {filteredPRs.length === 0 && (
        <div className="text-center py-12">
          <Eye className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--color-text-tertiary)' }} />
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
            No reviews waiting
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            All caught up! PRs where you're requested as a reviewer will appear here.
          </p>
        </div>
      )}

      {/* ── PR list grouped by repo ──────────────────────────────────────── */}
      <div className="space-y-4">
        {repoGroups.map(([repo, repoPrs]) => {
          const visiblePrs = repoPrs.filter((p: any) =>
            filteredPRs.some((fp: any) => fp.number === p.number),
          );
          if (visiblePrs.length === 0) return null;

          return (
            <div key={repo}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <Layers className="w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
                  {repo}
                </span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{ background: 'var(--color-surface-tertiary)', color: 'var(--color-text-tertiary)' }}
                >
                  {visiblePrs.length}
                </span>
              </div>

              <div className="space-y-2">
                {visiblePrs.map((pr: any) => {
                  const urgency = computeUrgency(pr);
                  const isExpanded = expandedPR === pr.id;

                  return (
                    <div key={pr.id}>
                      {/* ── PR card ─────────────────────────────────────── */}
                      <div
                        className="rounded-xl border transition-all cursor-pointer hover:shadow-sm"
                        style={{
                          background: 'var(--color-surface)',
                          borderColor: isExpanded ? 'var(--color-brand)' : 'var(--color-border)',
                        }}
                        onClick={() => handleTogglePR(pr.id)}
                      >
                        <div className="p-4 flex items-center gap-4">
                          {/* CI indicator */}
                          <StatusDot status={pr.draft ? 'pending' : 'success'} />

                          {/* Title & meta */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                                {pr.title}
                              </span>
                              {pr.draft && (
                                <span
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0"
                                  style={{
                                    background: 'var(--color-surface-tertiary)',
                                    color: 'var(--color-text-tertiary)',
                                    border: '1px dashed var(--color-border)',
                                  }}
                                >
                                  Draft
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                                style={{ background: 'var(--color-surface-tertiary)', color: 'var(--color-text-secondary)' }}
                              >
                                #{pr.number}
                              </span>
                              {pr.labels?.slice(0, 3).map((l: any) => (
                                <span
                                  key={l.name}
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                                  style={{ background: 'var(--color-info-light)', color: '#1e40af' }}
                                >
                                  {l.name}
                                </span>
                              ))}
                              <span className="text-xs flex items-center gap-1" style={{ color: 'var(--color-text-tertiary)' }}>
                                <Clock className="w-3 h-3" /> {timeAgo(pr.created_at)}
                              </span>
                            </div>

                            {/* Requested reviewers */}
                            {pr.requested_reviewers && pr.requested_reviewers.length > 0 && (
                              <div className="flex items-center gap-1 mt-2">
                                <span className="text-[10px] mr-1" style={{ color: 'var(--color-text-tertiary)' }}>
                                  Reviewers:
                                </span>
                                {pr.requested_reviewers.slice(0, 5).map((r: any) => (
                                  <AuthorAvatar key={r.login} author={r.login} />
                                ))}
                                {pr.requested_reviewers.length > 5 && (
                                  <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                                    +{pr.requested_reviewers.length - 5}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Right column */}
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <AuthorAvatar author={pr.user?.login || 'unknown'} />

                            {/* Urgency badge */}
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                              style={{
                                background:
                                  urgency >= 40
                                    ? 'var(--color-error-light)'
                                    : urgency >= 20
                                      ? 'var(--color-warning-light)'
                                      : 'var(--color-success-light)',
                                color:
                                  urgency >= 40
                                    ? 'var(--color-error)'
                                    : urgency >= 20
                                      ? 'var(--color-warning)'
                                      : 'var(--color-success)',
                              }}
                            >
                              <AlertCircle className="w-3 h-3" />
                              {Math.round(urgency)}
                            </span>

                            <span className="text-xs flex items-center gap-1" style={{ color: 'var(--color-text-tertiary)' }}>
                              <MessageSquare className="w-3.5 h-3.5" /> {pr.comments || 0}
                            </span>

                            <ChevronRight
                              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                              style={{ color: 'var(--color-text-tertiary)' }}
                            />
                          </div>
                        </div>

                        {/* ── Diff Preview Panel ────────────────────────── */}
                        {isExpanded && (
                          <div
                            className="border-t"
                            style={{ borderColor: 'var(--color-border)' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {diffLoading ? (
                              <div className="p-4 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                                Loading diff...
                              </div>
                            ) : diffFiles && diffFiles.length > 0 ? (
                              <div className="flex flex-col md:flex-row">
                                {/* File list (left) */}
                                <div
                                  className="md:w-72 flex-shrink-0 border-b md:border-b-0 md:border-r max-h-[400px] overflow-y-auto"
                                  style={{ borderColor: 'var(--color-border)' }}
                                >
                                  <div
                                    className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide sticky top-0 z-10"
                                    style={{
                                      background: 'var(--color-surface-secondary)',
                                      color: 'var(--color-text-tertiary)',
                                      borderBottom: '1px solid var(--color-border)',
                                    }}
                                  >
                                    Changed Files ({diffFiles.length})
                                  </div>
                                  {diffFiles.map((file) => (
                                    <button
                                      key={file.filename}
                                      onClick={() => setSelectedFile(file.filename)}
                                      className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b ${
                                        selectedFile === file.filename ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                                      }`}
                                      style={{ borderColor: 'var(--color-border-light)' }}
                                    >
                                      <div className="flex items-center gap-1.5">
                                        <FileCode className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
                                        <span className="truncate" style={{ color: 'var(--color-text-primary)' }}>
                                          {file.filename}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 mt-0.5 ml-[18px]">
                                        <span className="text-[10px]" style={{ color: 'var(--color-success)' }}>
                                          +{file.additions}
                                        </span>
                                        <span className="text-[10px]" style={{ color: 'var(--color-error)' }}>
                                          -{file.deletions}
                                        </span>
                                        {file.status !== 'modified' && (
                                          <span
                                            className="text-[10px] px-1 rounded"
                                            style={{
                                              background: 'var(--color-surface-tertiary)',
                                              color: 'var(--color-text-tertiary)',
                                            }}
                                          >
                                            {file.status}
                                          </span>
                                        )}
                                      </div>
                                    </button>
                                  ))}
                                </div>

                                {/* Diff viewer (right) */}
                                <div className="flex-1 min-w-0">
                                  {selectedDiff ? (
                                    <div>
                                      <div
                                        className="px-4 py-2 border-b flex items-center justify-between"
                                        style={{ borderColor: 'var(--color-border)' }}
                                      >
                                        <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                          {selectedDiff.filename}
                                        </span>
                                        <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                                          +{selectedDiff.additions} / -{selectedDiff.deletions}
                                        </span>
                                      </div>
                                      <div
                                        className="overflow-x-auto max-h-[380px] overflow-y-auto"
                                        style={{ background: 'var(--color-surface-secondary)' }}
                                      >
                                        {selectedDiff.patch ? (
                                          <div className="py-1">
                                            {truncateDiff(selectedDiff.patch)
                                              .split('\n')
                                              .map((line, i) => (
                                                <DiffLine key={i} line={line} />
                                              ))}
                                          </div>
                                        ) : (
                                          <div className="p-4 text-xs text-center" style={{ color: 'var(--color-text-tertiary)' }}>
                                            Binary file or diff not available
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center h-[200px]">
                                      <div className="text-center">
                                        <FileCode className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-text-tertiary)' }} />
                                        <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                                          Select a file to preview its diff
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="p-4 text-sm text-center" style={{ color: 'var(--color-text-tertiary)' }}>
                                No files changed or unable to load diff
                              </div>
                            )}

                            {/* ── Review Actions ────────────────────────── */}
                            <div
                              className="flex items-center gap-2 px-4 py-3 border-t"
                              style={{ borderColor: 'var(--color-border)' }}
                            >
                              <button
                                onClick={() =>
                                  handleReviewAction(
                                    expandedOwner || '',
                                    expandedRepo || '',
                                    pr.number,
                                    'APPROVE',
                                  )
                                }
                                disabled={reviewMutation.isPending}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-50"
                                style={{ background: 'var(--color-success)' }}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Approve
                              </button>
                              <button
                                onClick={() =>
                                  handleReviewAction(
                                    expandedOwner || '',
                                    expandedRepo || '',
                                    pr.number,
                                    'REQUEST_CHANGES',
                                  )
                                }
                                disabled={reviewMutation.isPending}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-50"
                                style={{ background: 'var(--color-error)' }}
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Request Changes
                              </button>
                              <div className="flex-1" />
                              <a
                                href={pr.html_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs flex items-center gap-1 transition-colors hover:underline"
                                style={{ color: 'var(--color-text-tertiary)' }}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                View on GitHub
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Confirmation Dialog ──────────────────────────────────────────── */}
      {confirmAction && (
        <>
          <ConfirmationDialog
            title={
              confirmAction.event === 'APPROVE'
                ? 'Approve Pull Request'
                : 'Request Changes'
            }
            message={
              confirmAction.event === 'APPROVE'
                ? `Are you sure you want to approve PR #${confirmAction.number}? This will submit an approving review.`
                : `Are you sure you want to request changes on PR #${confirmAction.number}? This will submit a review requesting changes.`
            }
            onConfirm={executeReview}
            onCancel={() => { setConfirmAction(null); setReviewError(null); }}
            isLoading={reviewMutation.isPending}
          />
          {reviewError && (
            <div className="fixed inset-0 z-[61] flex items-center justify-center bg-black/40"
              onClick={() => setReviewError(null)}
            >
              <div
                className="rounded-xl border shadow-xl p-5 w-full max-w-sm mx-4"
                style={{ background: 'var(--color-surface)', borderColor: 'var(--color-error)', borderWidth: 1 }}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--color-error)' }} />
                  <div>
                    <span className="text-sm font-semibold" style={{ color: 'var(--color-error)' }}>Review Failed</span>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>{reviewError}</p>
                    <button
                      className="mt-3 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                      style={{ background: 'var(--color-error)' }}
                      onClick={() => setReviewError(null)}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
