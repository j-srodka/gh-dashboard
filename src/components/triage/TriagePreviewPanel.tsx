import type { InboxItem, Reason, ScoreTone } from '@/lib/scoring';
import { Badge, AuthorAvatar } from '@/components/ui';
import {
  X,
  ExternalLink,
  MessageSquare,
  GitPullRequest,
  AlertTriangle,
  Check,
  CircleDot,
} from 'lucide-react';

// ── Props ────────────────────────────────────────────────────────────────────

interface TriagePreviewPanelProps {
  item: InboxItem | null;
  onClose: () => void;
  onMarkRead: (id: string) => void;
}

// ── Reason chip labels (shared with NotificationsPage) ────────────────────────

const REASON_CHIP_LABELS: Record<string, string> = {
  assigned: 'Assigned',
  'review-requested': 'Review req',
  'changes-requested': 'Changes req',
  mentioned: 'Mentioned',
  stale: 'Stale',
  'stale-critical': 'Stale',
  'many-comments': 'Active',
  'ci-failure': 'CI fail',
  'security-alert': 'Security',
  unread: 'Unread',
};

// ── Reason descriptions for the detail view ───────────────────────────────────

const REASON_DESCRIPTIONS: Record<Reason, string> = {
  assigned: 'Assigned to you — this item is your direct responsibility.',
  'review-requested': 'Review requested — someone is waiting for your feedback.',
  'changes-requested': 'Changes requested — your PR needs revision.',
  mentioned: 'You were mentioned — someone is talking to you.',
  stale: 'Stale — no activity in over 7 days, may need your attention.',
  'stale-critical': 'Critically stale — untouched for over 14 days.',
  'many-comments': 'Active discussion — 5+ comments, needs resolution.',
  'ci-failure': 'CI failure — a broken build needs immediate attention.',
  'security-alert': 'Security alert — a critical vulnerability has been reported.',
  unread: 'Unread — you have not acknowledged this item yet.',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getScoreBadgeVariant(
  tone: ScoreTone,
): 'error' | 'warning' | 'success' {
  switch (tone) {
    case 'red':
      return 'error';
    case 'amber':
      return 'warning';
    case 'green':
      return 'success';
  }
  return 'success';
}

function getStateBadgeVariant(
  state: string,
): 'success' | 'info' | 'neutral' | 'draft' {
  switch (state) {
    case 'open':
      return 'success';
    case 'closed':
      return 'neutral';
    case 'merged':
      return 'info';
    case 'draft':
      return 'draft';
    default:
      return 'neutral';
  }
}

function getReasonBadgeVariant(
  reason: string,
): 'error' | 'warning' | 'info' | 'neutral' {
  if (reason === 'review-requested' || reason === 'changes-requested')
    return 'warning';
  if (reason === 'assigned') return 'info';
  if (
    reason === 'ci-failure' ||
    reason === 'security-alert' ||
    reason === 'stale-critical'
  )
    return 'error';
  return 'neutral';
}

function sourceIcon(type: string): React.ReactNode {
  const className = 'w-4 h-4';
  switch (type) {
    case 'pr':
      return (
        <GitPullRequest
          className={className}
          style={{ color: 'var(--color-brand)' }}
        />
      );
    case 'issue':
      return (
        <CircleDot
          className={className}
          style={{ color: 'var(--color-warning)' }}
        />
      );
    case 'ci':
      return (
        <AlertTriangle
          className={className}
          style={{ color: 'var(--color-error)' }}
        />
      );
    case 'security':
      return (
        <AlertTriangle
          className={className}
          style={{ color: 'var(--color-error)' }}
        />
      );
    default:
      return (
        <MessageSquare
          className={className}
          style={{ color: 'var(--color-text-tertiary)' }}
        />
      );
  }
}

function sourceLabel(type: string): string {
  switch (type) {
    case 'pr':
      return 'Pull Request';
    case 'issue':
      return 'Issue';
    case 'ci':
      return 'CI Run';
    case 'security':
      return 'Security Alert';
    default:
      return 'Notification';
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TriagePreviewPanel({
  item,
  onClose,
  onMarkRead,
}: TriagePreviewPanelProps) {
  if (!item) return null;

  const raw = item.raw;
  const state = raw.state as string | undefined;
  const draft = raw.draft as boolean | undefined;
  const createdDate = raw.created_at
    ? formatDate(raw.created_at as string)
    : '';
  const updatedDate = item.updatedAt ? formatDate(item.updatedAt) : '';
  const additions = raw.additions as number | undefined;
  const deletions = raw.deletions as number | undefined;
  const changedFiles = raw.changed_files as number | undefined;
  const body = raw.body as string | undefined;
  const displayState = draft ? 'draft' : state ?? '';
  const hasDiffStats =
    additions !== undefined ||
    deletions !== undefined ||
    changedFiles !== undefined;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--color-surface)' }}
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {sourceIcon(item.type)}
          <span
            className="text-xs font-medium truncate"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {sourceLabel(item.type)}
          </span>
          <Badge variant={getScoreBadgeVariant(item.tone)}>
            {item.score}
          </Badge>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md transition-colors flex-shrink-0"
          style={{ color: 'var(--color-text-tertiary)' }}
          title="Close panel"
          aria-label="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Title */}
        <h2
          className="text-lg font-semibold leading-snug"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {item.title}
        </h2>

        {/* Meta row */}
        <div className="flex items-center flex-wrap gap-1.5 text-sm">
          {item.author && (
            <>
              <AuthorAvatar author={item.author} />
              <span
                className="font-medium"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {item.author}
              </span>
              <span style={{ color: 'var(--color-text-tertiary)' }}>·</span>
            </>
          )}
          <span style={{ color: 'var(--color-text-secondary)' }}>
            {item.repo}
          </span>
        </div>

        {/* Dates */}
        <div
          className="text-xs space-y-1"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          {createdDate && <div>Created: {createdDate}</div>}
          {updatedDate && <div>Updated: {updatedDate}</div>}
        </div>

        {/* Status */}
        {displayState && (
          <div>
            <Badge variant={getStateBadgeVariant(displayState)}>
              {displayState}
            </Badge>
          </div>
        )}

        {/* Why it needs attention */}
        {item.reasons.length > 0 && (
          <div>
            <h3
              className="text-xs font-semibold uppercase tracking-wide mb-2"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Why this needs attention
            </h3>
            <div className="space-y-2">
              {item.reasons.map((r) => {
                const label = REASON_CHIP_LABELS[r] || r;
                const description = REASON_DESCRIPTIONS[r];
                return (
                  <div key={r} className="flex items-start gap-2">
                    <div className="flex-shrink-0 mt-0.5">
                      <Badge variant={getReasonBadgeVariant(r)}>
                        {label}
                      </Badge>
                    </div>
                    {description && (
                      <span
                        className="text-xs leading-relaxed"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        {description}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Comment count */}
        {item.comments > 0 && (
          <div
            className="flex items-center gap-1.5 text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <MessageSquare className="w-4 h-4" />
            <span>
              {item.comments} comment{item.comments !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Diff stats (PRs) */}
        {hasDiffStats && (
          <div
            className="text-sm flex items-center gap-1.5"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {additions !== undefined && (
              <span style={{ color: '#16a34a' }}>+{additions}</span>
            )}
            {additions !== undefined && deletions !== undefined && (
              <span style={{ color: 'var(--color-text-tertiary)' }}>/</span>
            )}
            {deletions !== undefined && (
              <span style={{ color: '#dc2626' }}>-{deletions}</span>
            )}
            {changedFiles !== undefined && (
              <span style={{ color: 'var(--color-text-tertiary)' }}>
                across {changedFiles} file{changedFiles !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

        {/* Body preview */}
        {body && typeof body === 'string' && (
          <div>
            <h3
              className="text-xs font-semibold uppercase tracking-wide mb-2"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Description
            </h3>
            <div
              className="text-sm leading-relaxed whitespace-pre-wrap break-words line-clamp-6"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {body}
            </div>
          </div>
        )}
      </div>

      {/* ── Footer actions ──────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-t flex-shrink-0"
        style={{ borderColor: 'var(--color-border)' }}
      >
        {item.unread && (
          <button
            onClick={() => onMarkRead(item.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-secondary)',
              background: 'var(--color-surface-secondary)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-brand-light)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
          >
            <Check className="w-3.5 h-3.5" />
            Mark Read
          </button>
        )}
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors"
          style={{
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-secondary)',
            background: 'var(--color-surface-secondary)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-brand-light)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open on GitHub
        </a>
      </div>
    </div>
  );
}
