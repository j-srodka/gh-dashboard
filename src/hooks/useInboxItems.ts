import { useMemo } from 'react';
import {
  useNotifications,
  usePullRequests,
  useIssues,
  useReviewRequests,
} from '@/hooks/useGitHubQuery';
import {
  type InboxItem,
  type ItemType,
  type ScoringInput,
  computeAttentionScore,
  daysSince,
  dedupKey,
  repoFullName,
} from '@/lib/scoring';

// ── Notification → ItemType ──────────────────────────────────────────────

function notificationItemType(subjectType: string, reason: string): ItemType {
  if (subjectType === 'PullRequest') return 'pr';
  if (subjectType === 'Issue') return 'issue';
  if (subjectType === 'CheckSuite' || reason === 'ci_activity') return 'ci';
  if (subjectType === 'RepositoryVulnerabilityAlert' || reason === 'security_alert')
    return 'security';
  return 'other';
}

// ── Subject URL Parsing ──────────────────────────────────────────────────
// Notifications carry a subject.url like:
//   https://api.github.com/repos/owner/repo/issues/123
//   https://api.github.com/repos/owner/repo/pulls/456

interface ParsedSubject {
  repo: string;
  type: 'pr' | 'issue';
  number: number;
}

function parseSubjectUrl(url: string | undefined): ParsedSubject | null {
  if (!url) return null;
  try {
    // Example: https://api.github.com/repos/owner/repo/pulls/123
    const parts = url.replace(/\/+$/, '').split('/');
    if (parts.length < 5) return null;
    const number = parseInt(parts[parts.length - 1], 10);
    const kind = parts[parts.length - 2]; // "pulls" or "issues"
    if (kind !== 'pulls' && kind !== 'issues') return null;
    const repoName = parts[parts.length - 3];
    const owner = parts[parts.length - 4];
    if (!owner || !repoName || isNaN(number)) return null;
    return {
      repo: `${owner}/${repoName}`,
      type: kind === 'pulls' ? 'pr' : 'issue',
      number,
    };
  } catch {
    return null;
  }
}

// ── Scoring Input Builder ────────────────────────────────────────────────

function buildScoringInput(
  type: ItemType,
  unread: boolean,
  reason: string | undefined,
  updatedAt: string | undefined,
  commentCount: number,
): ScoringInput {
  return {
    type,
    unread,
    assigned: reason === 'assign',
    reviewRequested: reason === 'review_requested',
    changesRequested: reason === 'changes_requested',
    mentioned: reason === 'mention',
    daysSinceUpdate: daysSince(updatedAt),
    commentCount,
    ciFailed:
      type === 'ci' &&
      (reason === 'ci_activity' || reason === 'workflow_run_failure'),
    isSecurityAlert:
      type === 'security' ||
      reason === 'security_alert' ||
      reason === 'security_advisory',
  };
}

// ── Notification → InboxItem ─────────────────────────────────────────────

function notificationToItem(n: Record<string, unknown>): InboxItem {
  const subject = (n.subject as Record<string, unknown>) || {};
  const repo = (n.repository as Record<string, unknown>) || {};
  const title = (subject.title as string) || 'Notification';
  const repoName = (repo.full_name as string) || 'unknown/unknown';
  const url =
    ((subject.url as string) || '')
      .replace('api.github.com/repos', 'github.com')
      .replace('/pulls/', '/pull/') || '#';
  const updatedAt = (n.updated_at as string) || '';
  const unread = (n.unread as boolean) || false;
  const reason = (n.reason as string) || '';
  const type = notificationItemType(
    (subject.type as string) || '',
    reason,
  );

  const scoring = computeAttentionScore(
    buildScoringInput(type, unread, reason, updatedAt, 0),
  );

  return {
    id: `notif:${n.id as string}`,
    source: 'notification',
    title,
    repo: repoName,
    url,
    updatedAt,
    type,
    unread,
    author: '',
    comments: 0,
    score: scoring.score,
    reasons: scoring.reasons,
    tone: scoring.tone,
    raw: n,
  };
}

// ── PR Search Item → InboxItem ───────────────────────────────────────────

function prToItem(
  pr: Record<string, unknown>,
  isReviewRequest: boolean,
): InboxItem {
  const title = (pr.title as string) || 'Untitled';
  const repo = repoFullName(pr.repository_url as string | undefined);
  const number = (pr.number as number) || 0;
  const url = (pr.html_url as string) || '#';
  const updatedAt = (pr.updated_at as string) || '';
  const author = ((pr.user as Record<string, unknown>)?.login as string) || '';
  const comments =
    ((pr.comments as number) || 0) +
    ((pr.review_comments as number) || 0);
  const draft = (pr.draft as boolean) || false;
  const labels = (pr.labels as Array<Record<string, unknown>>) || [];
  const hasChangesRequested = labels.some(
    (l) =>
      (l.name as string)?.toLowerCase() === 'changes requested',
  );

  const type: ItemType = 'pr';

  // Build rich scoring input combining PR metadata
  const scoringInput: ScoringInput = {
    type,
    unread: false, // search results don't carry read/unread
    assigned: false, // search results don't reliably carry current-user assignment; notifications handle this
    reviewRequested: isReviewRequest,
    changesRequested: hasChangesRequested,
    mentioned: false, // search results don't carry mention info
    daysSinceUpdate: daysSince(updatedAt),
    commentCount: comments,
    ciFailed: draft === false && (pr.state as string) === 'failure',
    isSecurityAlert: false,
  };

  const scoring = computeAttentionScore(scoringInput);

  return {
    id: dedupKey(type, repo, number),
    source: isReviewRequest ? 'review-request' : 'pr',
    title,
    repo,
    url,
    updatedAt,
    type,
    unread: false,
    author,
    comments,
    score: scoring.score,
    reasons: scoring.reasons,
    tone: scoring.tone,
    raw: pr,
  };
}

// ── Issue Item → InboxItem ───────────────────────────────────────────────

function issueToItem(issue: Record<string, unknown>): InboxItem {
  const title = (issue.title as string) || 'Untitled';
  const repo = repoFullName(issue.repository_url as string | undefined);
  const number = (issue.number as number) || 0;
  const url = (issue.html_url as string) || '#';
  const updatedAt = (issue.updated_at as string) || '';
  const author =
    ((issue.user as Record<string, unknown>)?.login as string) || '';
  const comments = (issue.comments as number) || 0;

  const type: ItemType = 'issue';

  const scoringInput: ScoringInput = {
    type,
    unread: false,
    assigned: true, // useIssues filters to assigned issues
    reviewRequested: false,
    changesRequested: false,
    mentioned: false,
    daysSinceUpdate: daysSince(updatedAt),
    commentCount: comments,
    ciFailed: false,
    isSecurityAlert: false,
  };

  const scoring = computeAttentionScore(scoringInput);

  return {
    id: dedupKey(type, repo, number),
    source: 'issue',
    title,
    repo,
    url,
    updatedAt,
    type,
    unread: false,
    author,
    comments,
    score: scoring.score,
    reasons: scoring.reasons,
    tone: scoring.tone,
    raw: issue,
  };
}

// ── Unified Inbox Hook ───────────────────────────────────────────────────

export interface InboxItemsResult {
  items: InboxItem[];
  /** Total count across all sources before dedup. */
  rawCount: number;
  /** Count after dedup. */
  dedupedCount: number;
  /** Items with red-tone scores. */
  critical: InboxItem[];
  /** Items with amber-tone scores. */
  warning: InboxItem[];
  /** Items with green-tone scores. */
  lowPriority: InboxItem[];
  isLoading: boolean;
  isError: boolean;
}

/**
 * Merge notifications, PRs, issues, and review requests into a single
 * attention-scored inbox. Items are de-duplicated across sources and
 * sorted by score descending.
 */
export function useInboxItems(monitoredRepos: string[]): InboxItemsResult {
  const {
    data: notifications,
    isLoading: notifLoading,
    isError: notifError,
  } = useNotifications();

  const {
    data: prs,
    isLoading: prsLoading,
    isError: prsError,
  } = usePullRequests(monitoredRepos);

  const {
    data: issues,
    isLoading: issuesLoading,
    isError: issuesError,
  } = useIssues(monitoredRepos);

  const {
    data: reviews,
    isLoading: reviewsLoading,
    isError: reviewsError,
  } = useReviewRequests(monitoredRepos);

  const isLoading =
    notifLoading || prsLoading || issuesLoading || reviewsLoading;
  const isError = notifError || prsError || issuesError || reviewsError;

  const result = useMemo(() => {
    // ── Build unified list with dedup ──
    const dedupMap = new Map<string, InboxItem>();
    const rawItems: InboxItem[] = [];

    // Helper: insert or merge an item into the dedup map.
    const upsert = (item: InboxItem) => {
      rawItems.push(item);
      const existing = dedupMap.get(item.id);
      if (existing) {
        // Merge: combine reasons and take the higher score.
        const mergedReasons = [
          ...new Set([...existing.reasons, ...item.reasons]),
        ];
        const mergedScore = Math.max(existing.score, item.score);

        // Recompute tone based on merged score
        let mergedTone = existing.tone;
        if (mergedScore >= 60) mergedTone = 'red';
        else if (mergedScore >= 30) mergedTone = 'amber';
        else mergedTone = 'green';

        // Prefer the richer data (search results over notifications).
        const merged: InboxItem = {
          ...existing,
          ...item,
          id: existing.id,
          source: item.source !== 'notification' ? item.source : existing.source,
          unread: existing.unread || item.unread,
          author: item.author || existing.author,
          comments: Math.max(existing.comments, item.comments),
          score: mergedScore,
          reasons: mergedReasons,
          tone: mergedTone,
          raw: { ...existing.raw, ...item.raw },
        };
        dedupMap.set(item.id, merged);
      } else {
        dedupMap.set(item.id, item);
      }
    };

    // 1. Process notifications first (lowest priority data, enriched later)
    if (notifications) {
      for (const n of notifications) {
        const notifItem = notificationToItem(n as Record<string, unknown>);

        // For PR/issue notifications, try to build a cross-reference dedup key
        const subject = (n as Record<string, unknown>).subject as
          | Record<string, unknown>
          | undefined;
        const parsed = parseSubjectUrl(subject?.url as string | undefined);

        if (parsed && (parsed.type === 'pr' || parsed.type === 'issue')) {
          // Use the standard dedup key so PR/issue queries can merge
          notifItem.id = dedupKey(parsed.type, parsed.repo, parsed.number);

          // Upgrade type from parsed subject (more reliable)
          // We mutate via unknown because InboxItem is readonly in spirit
          const mutable = notifItem as unknown as Record<string, unknown>;
          mutable.type = parsed.type === 'pr' ? 'pr' : 'issue';
          mutable.repo = parsed.repo;
        }

        upsert(notifItem);
      }
    }

    // 2. Process PRs (user's own)
    if (prs) {
      for (const pr of prs) {
        upsert(prToItem(pr as Record<string, unknown>, false));
      }
    }

    // 3. Process review requests (PRs awaiting user's review)
    if (reviews) {
      for (const pr of reviews) {
        upsert(prToItem(pr as Record<string, unknown>, true));
      }
    }

    // 4. Process issues (assigned to user)
    if (issues) {
      for (const issue of issues) {
        // Skip items that are actually PRs (the search API sometimes returns them)
        if ((issue as Record<string, unknown>).pull_request) continue;
        upsert(issueToItem(issue as Record<string, unknown>));
      }
    }

    // ── Sort by score descending ──
    const sorted = Array.from(dedupMap.values()).sort(
      (a, b) => b.score - a.score,
    );

    // ── Partition by tone ──
    const critical = sorted.filter((i) => i.tone === 'red');
    const warning = sorted.filter((i) => i.tone === 'amber');
    const lowPriority = sorted.filter((i) => i.tone === 'green');

    return {
      items: sorted,
      rawCount: rawItems.length,
      dedupedCount: sorted.length,
      critical,
      warning,
      lowPriority,
    };
  }, [notifications, prs, issues, reviews]);

  return {
    ...result,
    isLoading,
    isError,
  };
}
