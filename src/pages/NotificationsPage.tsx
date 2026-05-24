import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useInboxItems, type InboxItemsResult } from '@/hooks/useInboxItems';
import { type InboxItem, type ScoreTone } from '@/lib/scoring';
import { useMarkNotificationRead, useMarkAllNotificationsRead } from '@/hooks/useGitHubQuery';
import { useMonitoredRepos } from '@/hooks/useMonitoredRepos';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { exportToJson } from '@/lib/utils';
import { Badge } from '@/components/ui';
import { AuthorAvatar } from '@/components/ui';
import { TriagePreviewPanel } from '@/components/triage/TriagePreviewPanel';
import {
  ExternalLink,
  MessageSquare,
  GitPullRequest,
  AlertTriangle,
  Inbox,
  Check,
  CheckCheck,
  Loader2,
  Clock,
  AtSign,
  UserCheck,
  Download,
} from 'lucide-react';

// ── Filter Types ───────────────────────────────────────────────────────────

type InboxFilter = 'all' | 'needs-attention' | 'awaiting-review' | 'assigned' | 'mentioned' | 'stale';

interface FilterPill {
  key: InboxFilter;
  label: string;
  icon: React.ElementType;
}

const FILTERS: FilterPill[] = [
  { key: 'all', label: 'All', icon: Inbox },
  { key: 'needs-attention', label: 'Needs Attention', icon: AlertTriangle },
  { key: 'awaiting-review', label: 'Awaiting Review', icon: GitPullRequest },
  { key: 'assigned', label: 'Assigned to Me', icon: UserCheck },
  { key: 'mentioned', label: 'Mentioned', icon: AtSign },
  { key: 'stale', label: 'Stale', icon: Clock },
];

// ── Reason Labels ──────────────────────────────────────────────────────────

const REASON_CHIP_LABELS: Record<string, string> = {
  'assigned': 'Assigned',
  'review-requested': 'Review req',
  'changes-requested': 'Changes req',
  'mentioned': 'Mentioned',
  'stale': 'Stale',
  'stale-critical': 'Stale',
  'many-comments': 'Active',
  'ci-failure': 'CI fail',
  'security-alert': 'Security',
  'unread': 'Unread',
};

// ── Helpers ────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function filterItems(items: InboxItem[], filter: InboxFilter): InboxItem[] {
  switch (filter) {
    case 'needs-attention':
      return items.filter((i) => i.tone === 'red');
    case 'awaiting-review':
      return items.filter((i) => i.reasons.includes('review-requested'));
    case 'assigned':
      return items.filter((i) => i.reasons.includes('assigned'));
    case 'mentioned':
      return items.filter((i) => i.reasons.includes('mentioned'));
    case 'stale':
      return items.filter(
        (i) =>
          i.reasons.includes('stale') || i.reasons.includes('stale-critical'),
      );
    default:
      return items;
  }
}

function getNotifThreadId(item: InboxItem): string | null {
  // Notification items that kept their original dedup key
  if (item.id.startsWith('notif:')) return item.id.slice(6);
  // Items merged from notifications still carry the raw notification data
  if (
    item.raw &&
    item.raw.reason !== undefined &&
    item.raw.id !== undefined
  ) {
    return String(item.raw.id);
  }
  return null;
}

function getScoreBadgeVariant(tone: ScoreTone): 'error' | 'warning' | 'success' {
  switch (tone) {
    case 'red':
      return 'error';
    case 'amber':
      return 'warning';
    case 'green':
      return 'success';
  }
}

function getSourceLabel(source: InboxItem['source']): string {
  switch (source) {
    case 'notification':
      return 'Notif';
    case 'pr':
      return 'PR';
    case 'issue':
      return 'Issue';
    case 'review-request':
      return 'Review';
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────

function InboxSkeleton() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Inbox
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Loading items...
        </p>
      </div>
      {/* Filter pill skeleton */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <div
            key={f.key}
            className="h-8 w-24 rounded-lg animate-pulse"
            style={{ background: 'var(--color-surface-tertiary)' }}
          />
        ))}
      </div>
      {/* Item skeleton */}
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="rounded-xl border p-4 animate-pulse"
            style={{
              background: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
            }}
          >
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full" style={{ background: 'var(--color-surface-tertiary)' }} />
              <div className="flex-1 space-y-2">
                <div className="h-4 rounded w-3/4" style={{ background: 'var(--color-surface-tertiary)' }} />
                <div className="h-3 rounded w-1/2" style={{ background: 'var(--color-surface-tertiary)' }} />
              </div>
              <div className="w-10 h-5 rounded-full" style={{ background: 'var(--color-surface-tertiary)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ filter }: { filter: InboxFilter }) {
  if (filter === 'all') {
    return (
      <div
        className="text-center py-12 rounded-xl border"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        <Inbox
          className="w-8 h-8 mx-auto mb-3"
          style={{ color: 'var(--color-text-tertiary)' }}
        />
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          All caught up
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
          No items need your attention right now
        </p>
      </div>
    );
  }
  return (
    <div
      className="text-center py-12 rounded-xl border"
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      <Inbox
        className="w-8 h-8 mx-auto mb-3"
        style={{ color: 'var(--color-text-tertiary)' }}
      />
      <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
        No matching items
      </p>
      <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
        Try a different filter
      </p>
    </div>
  );
}

// ── Page Component ─────────────────────────────────────────────────────────

export function NotificationsPage() {
  const { monitoredRepos } = useMonitoredRepos();
  const {
    items,
    isLoading,
    isError,
  }: InboxItemsResult = useInboxItems(monitoredRepos);
  const [activeFilter, setActiveFilter] = useLocalStorage<InboxFilter>(
    'notificationsFilter',
    'all',
  );
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  // ── Triage panel state ──────────────────────────────────────────────────

  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const selectedIndexRef = useRef(-1);

  // Keep ref in sync so j/k nav always reads latest index
  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  // ── Derived data ──

  const filtered = useMemo(
    () => filterItems(items, activeFilter),
    [items, activeFilter],
  );

  // Sync selectedItem when filtered list re-fetches (TanStack Query)
  // If the selected item dropped out of the list, clear the selection.
  useEffect(() => {
    if (selectedItem === null) return;
    const match = filtered.find((i) => i.id === selectedItem.id);
    if (match) {
      setSelectedItem(match);
      setSelectedIndex(filtered.indexOf(match));
    } else {
      setSelectedItem(null);
      setSelectedIndex(-1);
    }
  }, [filtered]);

  // Per-filter counts (from unfiltered items)
  const filterCounts = useMemo(() => {
    const counts: Record<InboxFilter, number> = {
      all: items.length,
      'needs-attention': items.filter((i) => i.tone === 'red').length,
      'awaiting-review': items.filter((i) =>
        i.reasons.includes('review-requested'),
      ).length,
      assigned: items.filter((i) => i.reasons.includes('assigned')).length,
      mentioned: items.filter((i) => i.reasons.includes('mentioned')).length,
      stale: items.filter(
        (i) =>
          i.reasons.includes('stale') || i.reasons.includes('stale-critical'),
      ).length,
    };
    return counts;
  }, [items]);

  // Notification-sourced items that can be marked read
  const markableItems = useMemo(
    () => filtered.filter((i) => getNotifThreadId(i) !== null),
    [filtered],
  );

  // ── Keyboard navigation ────────────────────────────────────────────────

  // Keep a ref to the filtered list so the navigate callback never goes stale
  const filteredRef = useRef(filtered);
  filteredRef.current = filtered;

  const handleSelect = useCallback((item: InboxItem, index: number) => {
    setSelectedItem(item);
    setSelectedIndex(index);
  }, []);

  const handleNavigateItems = useCallback(
    (direction: 'next' | 'prev') => {
      const items = filteredRef.current;
      const len = items.length;
      if (len === 0) {
        setSelectedIndex(-1);
        setSelectedItem(null);
        return;
      }
      const prev = selectedIndexRef.current;
      const next =
        direction === 'next'
          ? prev < len - 1
            ? prev + 1
            : 0
          : prev > 0
            ? prev - 1
            : len - 1;
      setSelectedIndex(next);
      setSelectedItem(items[next] ?? null);
    },
    [],
  );

  const handleClosePanel = useCallback(() => {
    setSelectedItem(null);
    setSelectedIndex(-1);
  }, []);

  const handleMarkRead = useCallback(
    (itemId: string) => {
      const item = items.find((i) => i.id === itemId);
      if (!item) return;
      const notifId = getNotifThreadId(item);
      if (notifId) {
        markRead.mutate(notifId);
      }
    },
    [items, markRead],
  );

  // Reset selection when the active filter changes
  useEffect(() => {
    setSelectedIndex(-1);
    setSelectedItem(null);
  }, [activeFilter]);

  // Scroll the selected item into view when index changes
  useEffect(() => {
    if (selectedIndex >= 0) {
      const el = document.querySelector(
        `[data-inbox-index="${selectedIndex}"]`,
      );
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Mobile overlay: lock body scroll + Escape dismissal
  useEffect(() => {
    if (!selectedItem) return;
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      document.body.style.overflow = 'hidden';
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectedItem(null);
        setSelectedIndex(-1);
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKey);
    };
  }, [selectedItem]);

  // Wire keyboard shortcuts (j/k for item navigation)
  const handleToggleHelp = useCallback(() => {
    // Help toggle is handled globally by Layout; no-op here
  }, []);

  useKeyboardShortcuts({
    onToggleHelp: handleToggleHelp,
    onNavigateItems: handleNavigateItems,
  });

  // ── Loading state ──

  if (isLoading) {
    return <InboxSkeleton />;
  }

  // ── Error state ──

  if (isError) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Inbox
          </h1>
        </div>
        <div
          className="text-center py-12 rounded-xl border"
          style={{
            background: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          <AlertTriangle
            className="w-8 h-8 mx-auto mb-3"
            style={{ color: 'var(--color-error)' }}
          />
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Failed to load inbox
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
            Check your GitHub connection and try again
          </p>
        </div>
      </div>
    );
  }

  // ── Main render ──

  const totalUnread = items.filter((i) => i.unread).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Inbox
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            {items.length > 0
              ? `${items.length} item${items.length !== 1 ? 's' : ''}`
              : 'No items'}{' '}
            {totalUnread > 0 && (
              <span
                className="inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded-full text-[11px] font-bold"
                style={{
                  background: 'var(--color-error)',
                  color: 'var(--color-text-on-brand, #fff)',
                }}
              >
                {totalUnread} unread
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportToJson(filtered, 'notifications.json')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover-border-brand"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)', background: 'var(--color-surface-secondary)' }}
          >
            <Download className="w-3.5 h-3.5" /> Export JSON
          </button>
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending || markableItems.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover-border-brand disabled:opacity-50"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-secondary)',
              background: 'var(--color-surface-secondary)',
            }}
            title={markableItems.length === 0 ? 'No unread notifications to mark' : 'Mark all notifications as read'}
          >
            {markAllRead.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Marking...
              </>
            ) : (
              <>
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
        {FILTERS.map((f) => {
          const Icon = f.icon;
          const isActive = activeFilter === f.key;
          const count = filterCounts[f.key];
          return (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap"
              style={{
                background: isActive
                  ? 'var(--color-brand)'
                  : 'var(--color-surface)',
                borderColor: isActive
                  ? 'var(--color-brand)'
                  : 'var(--color-border)',
                color: isActive ? 'var(--color-text-on-brand, #fff)' : 'var(--color-text-secondary)',
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{f.label}</span>
              {count > 0 && (
                <span
                  className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold"
                  style={{
                    background: isActive ? 'var(--color-surface-on-brand, #fff)' : 'var(--color-surface-tertiary)',
                    color: isActive ? 'var(--color-brand)' : 'var(--color-text-secondary)',
                  }}
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content area with list + optional desktop panel */}
      <div className="flex gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          {filtered.length === 0 && <EmptyState filter={activeFilter} />}
          {filtered.map((item, index) => {
            const notifId = getNotifThreadId(item);
            const timeStr = formatRelativeTime(item.updatedAt);
            const isSelected = index === selectedIndex;

            return (
              <div
                key={item.id}
                data-inbox-index={index}
                onClick={() => handleSelect(item, index)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') handleSelect(item, index);
                }}
                role="button"
                tabIndex={0}
                className={`rounded-xl border p-4 flex items-start gap-3 transition-all group ${
                  isSelected ? '' : 'hover-border-brand'
                } cursor-pointer`}
                aria-selected={isSelected}
                style={{
                  background: 'var(--color-surface)',
                  borderColor: isSelected
                    ? 'var(--color-brand)'
                    : item.unread
                      ? 'var(--color-brand)'
                      : 'var(--color-border)',
                  boxShadow: isSelected
                    ? '0 0 0 1px var(--color-brand)'
                    : undefined,
                }}
              >
                {/* Source icon */}
                <div className="mt-0.5 shrink-0">
                  {item.type === 'pr' && (
                    <GitPullRequest
                      className="w-4 h-4"
                      style={{ color: 'var(--color-brand)' }}
                    />
                  )}
                  {item.type === 'issue' && (
                    <ExternalLink
                      className="w-4 h-4"
                      style={{ color: 'var(--color-warning)' }}
                    />
                  )}
                  {item.type === 'ci' && (
                    <AlertTriangle
                      className="w-4 h-4"
                      style={{ color: 'var(--color-error)' }}
                    />
                  )}
                  {item.type === 'security' && (
                    <AlertTriangle
                      className="w-4 h-4"
                      style={{ color: 'var(--color-error)' }}
                    />
                  )}
                  {item.type === 'other' && (
                    <MessageSquare
                      className="w-4 h-4"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Title row */}
                  <div className="flex items-start gap-2">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium hover:underline truncate"
                      style={{ color: 'var(--color-text-primary)' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {item.title}
                    </a>
                    {/* Score badge */}
                    <Badge variant={getScoreBadgeVariant(item.tone)}>
                      {item.score}
                    </Badge>
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center flex-wrap gap-2 mt-1.5">
                    {/* Repo */}
                    <span
                      className="text-xs"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      {item.repo.split('/').pop() || item.repo}
                    </span>

                    {/* Author */}
                    {item.author && (
                      <>
                        <span style={{ color: 'var(--color-text-tertiary)' }}>·</span>
                        <span className="flex items-center gap-1">
                          <AuthorAvatar author={item.author} />
                          <span
                            className="text-xs"
                            style={{ color: 'var(--color-text-secondary)' }}
                          >
                            {item.author}
                          </span>
                        </span>
                      </>
                    )}

                    {/* Comment count */}
                    {item.comments > 0 && (
                      <>
                        <span style={{ color: 'var(--color-text-tertiary)' }}>·</span>
                        <span
                          className="flex items-center gap-0.5 text-xs"
                          style={{ color: 'var(--color-text-tertiary)' }}
                        >
                          <MessageSquare className="w-3 h-3" />
                          {item.comments}
                        </span>
                      </>
                    )}

                    {/* Time */}
                    {timeStr && (
                      <>
                        <span style={{ color: 'var(--color-text-tertiary)' }}>·</span>
                        <span
                          className="text-xs"
                          style={{ color: 'var(--color-text-tertiary)' }}
                        >
                          {timeStr}
                        </span>
                      </>
                    )}

                    {/* Source tag */}
                    <span
                      className="text-[10px] uppercase tracking-wide px-1 py-0.5 rounded"
                      style={{
                        background: 'var(--color-surface-tertiary)',
                        color: 'var(--color-text-tertiary)',
                      }}
                    >
                      {getSourceLabel(item.source)}
                    </span>
                  </div>

                  {/* Reason chips */}
                  {item.reasons.length > 0 && (
                    <div className="flex items-center flex-wrap gap-1 mt-2">
                      {item.reasons.map((r) => {
                        const label = REASON_CHIP_LABELS[r] || r;
                        // Determine variant: action-oriented or info
                        let variant: 'warning' | 'error' | 'info' | 'neutral' = 'neutral';
                        if (r === 'review-requested' || r === 'changes-requested')
                          variant = 'warning';
                        if (r === 'assigned') variant = 'info';
                        if (r === 'ci-failure' || r === 'security-alert')
                          variant = 'error';
                        if (r === 'stale-critical') variant = 'error';
                        return (
                          <Badge key={r} variant={variant}>
                            {label}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {notifId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (item.unread) markRead.mutate(notifId);
                      }}
                      disabled={markRead.isPending || !item.unread}
                      className="p-1.5 rounded-md transition-colors opacity-0 group-hover:opacity-100 hover-surface-icon disabled:opacity-50"
                      style={{ color: 'var(--color-text-tertiary)' }}
                      title="Mark as read"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-md transition-colors hover-surface-icon"
                    style={{ color: 'var(--color-text-tertiary)' }}
                    title="Open in GitHub"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop: Triage preview panel (in flow beside list) */}
        {selectedItem && (
          <div className="hidden md:block w-96 flex-shrink-0">
            <div
              className="rounded-xl border overflow-hidden sticky top-4"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <TriagePreviewPanel
                item={selectedItem}
                onClose={handleClosePanel}
                onMarkRead={handleMarkRead}
              />
            </div>
          </div>
        )}
      </div>

      {/* Mobile: Triage preview panel (fixed overlay) */}
      {selectedItem && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 triage-panel-backdrop md:hidden"
            onClick={handleClosePanel}
          />
          <div className="fixed inset-y-0 right-0 z-50 w-full triage-panel md:hidden">
            <TriagePreviewPanel
              item={selectedItem}
              onClose={handleClosePanel}
              onMarkRead={handleMarkRead}
            />
          </div>
        </>
      )}
    </div>
  );
}
