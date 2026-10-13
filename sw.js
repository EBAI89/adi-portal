/* ADI portal service worker: shows portal alerts even when no portal page is open. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let items = [];
    try {
      const sub = await self.registration.pushManager.getSubscription();
      if (sub) {
        const r = await fetch('/api/push/pull', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        if (r.ok) items = ((await r.json()).items || []).slice(-5);
      }
    } catch (err) { /* fall through to the generic alert */ }
    if (!items.length) items = [{ title: 'American Ditek Institute', body: 'You have a new notification on the portal.', at: Date.now() }];
    for (const it of items) {
      await self.registration.showNotification(it.title || 'American Ditek Institute', { body: it.body || '', tag: 'adi-' + (it.at || Date.now()), data: { url: '/' } });
    }
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('/');
  }));
});
