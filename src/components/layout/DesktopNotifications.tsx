import { useEffect } from 'react';
import { useDesktopNotifications } from '@/hooks/useDesktopNotifications';

/**
 * Invisible component that:
 * 1. Runs useDesktopNotifications to fire desktop Browser Notifications
 *    for new CI failures, review requests, and @mentions.
 * 2. Listens for messages from the service worker (NOTIFICATION_CLICK)
 *    and opens the relevant GitHub URL in a new tab.
 *
 * Mount once at the app root (inside App.tsx) so it's always active.
 */
export function DesktopNotifications() {
  // Main hook: watches notification data and triggers desktop notifications
  useDesktopNotifications();

  // Listen for service-worker notification click messages
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    function handleMessage(event: MessageEvent) {
      const payload = event.data;
      if (payload?.type !== 'NOTIFICATION_CLICK') return;

      // Open the GitHub URL in a new tab if available
      if (payload.url) {
        // Convert API URL to web URL if needed
        let url = payload.url;
        url = url
          .replace('api.github.com/repos', 'github.com')
          .replace('/pulls/', '/pull/');
        // Defense-in-depth: only open trusted GitHub URLs
        if (url.startsWith('https://github.com/') || url.startsWith('https://api.github.com/')) {
          window.open(url, '_blank');
        }
      }
    }

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);

  return null; // invisible
}
