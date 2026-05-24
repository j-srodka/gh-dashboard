import { useEffect, useRef } from 'react';
import { useNotifications } from '@/hooks/useGitHubQuery';
import { useLocalStorage } from '@/hooks/useLocalStorage';

type NotifClassification = 'ci' | 'review' | 'mention' | null;

function classifyNotification(n: any): NotifClassification {
  const reason = n.reason || '';
  const type = n.subject?.type || '';

  // Review requests: GitHub sends reason=review_requested
  if (reason === 'review_requested') return 'review';

  // @mentions: GitHub sends reason=mention
  if (reason === 'mention') return 'mention';

  // CI failures: CheckSuite type or ci_activity reason
  if (type === 'CheckSuite' || reason === 'ci_activity') return 'ci';

  return null;
}

/**
 * Hook that watches the notifications query for new items and triggers
 * desktop Browser Notifications for CI failures, review requests, and @mentions.
 *
 * - Compares incoming notifications against a Set of previously seen IDs
 * - Only fires for newly-appeared unread items
 * - Respects per-type localStorage toggles
 * - No-op when Notification permission is not 'granted'
 */
export function useDesktopNotifications() {
  const { data: notifications } = useNotifications();
  const [notifyCiFailures] = useLocalStorage<boolean>('notifyCiFailures', true);
  const [notifyReviewRequests] = useLocalStorage<boolean>('notifyReviewRequests', true);
  const [notifyMentions] = useLocalStorage<boolean>('notifyMentions', true);

  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Exit early if no data or Notification API not available / not granted
    if (!notifications || !Array.isArray(notifications)) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    for (const n of notifications) {
      // Already seen this item
      if (seenIds.current.has(n.id)) continue;

      // Register as seen regardless of whether we notify
      seenIds.current.add(n.id);

      // Only fire for unread items (notifications we haven't acted on)
      if (!n.unread) continue;

      const classification = classifyNotification(n);
      if (!classification) continue;

      let title = '';
      let body = '';
      const repo = n.repository?.full_name || '';

      switch (classification) {
        case 'ci':
          if (!notifyCiFailures) continue;
          title = 'CI Failed';
          body = `${repo} — ${n.subject?.title || 'Workflow run'}`;
          break;
        case 'review':
          if (!notifyReviewRequests) continue;
          title = 'Review Requested';
          body = `${n.subject?.title || 'Pull Request'} — ${repo}`;
          break;
        case 'mention':
          if (!notifyMentions) continue;
          title = 'Mentioned';
          body = `${n.subject?.title || 'Issue/PR'} — ${repo}`;
          break;
      }

      try {
        new Notification(title, {
          body,
          icon: '/vite.svg',
          tag: n.id,
          data: {
            url: n.subject?.url || null,
            repoName: repo,
            notifType: classification,
          },
        });
      } catch {
        // Silently ignore — permission may have been revoked between checks
      }
    }

    // Prune stale IDs that are no longer in the current notification set
    // This keeps the ref from growing unbounded
    const currentIds = new Set(notifications.map((n: any) => n.id));
    for (const id of seenIds.current) {
      if (!currentIds.has(id)) seenIds.current.delete(id);
    }
  }, [notifications, notifyCiFailures, notifyReviewRequests, notifyMentions]);
}
