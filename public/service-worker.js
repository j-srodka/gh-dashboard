// Service Worker for gh-dashboard desktop notifications
// Handles notificationclick events to focus/open the app and deliver routing data

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Post message to all clients so the app can handle navigation
      for (const client of clientList) {
        if ('postMessage' in client) {
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            url: data.url || null,
            repoName: data.repoName || null,
            notifType: data.notifType || null,
          });
        }
      }

      // Focus an existing window if available
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }

      // If no window is open, open the app root
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
