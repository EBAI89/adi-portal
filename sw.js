/* ADI portal service worker: shows portal alerts even when no portal page is open. */
self.addEventListener('install', () => self.skipWaiting());
/* Fast and resilient loading: the page shell and its versioned files are kept on the device, so a repeat visit opens at once and still opens on a weak or interrupted connection. */
const SHELL = 'adi-shell-v2', FILES = 'adi-files-v2', EDGE = 'adi-edge-v1';
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (![SHELL, FILES, EDGE].includes(k)) await caches.delete(k);
  await self.clients.claim();
})()));
const EDGE_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com', 'cdn.jsdelivr.net'];
/* a new page shell is saved only after the scripts and styles it refers to are on the device too, so the next visit opens at once instead of waiting for the whole download */
async function storeShell(resp) {
  const html = await resp.clone().text(), urls = Array.from(new Set(Array.from(html.matchAll(/(?:src|href)="(\/[^"]*(?:\?v=|assets\/app\.js)[^"]*)"/g)).map(m => m[1])));
  const f = await caches.open(FILES);
  await Promise.all(urls.map(async u => { if (!(await f.match(u))) { const x = await fetch(u); if (!x.ok) throw new Error('asset ' + u); await f.put(u, x); } }));
  const keep = new Set(urls), paths = new Set(urls.map(u => u.split('?')[0]));
  for (const k of await f.keys()) { const rel = k.url.replace(self.location.origin, ''); if (!keep.has(rel) && paths.has(rel.split('?')[0])) await f.delete(k); }
  await (await caches.open(SHELL)).put('/', resp);
}
async function navigate(e) {
  const req = e.request, c = await caches.open(SHELL), hit = await c.match('/');
  const net = fetch(req).then(r => { if (r && r.ok) e.waitUntil(storeShell(r.clone()).catch(() => {})); return r; });   // the page is never held back by the background download
  if (hit) { net.catch(() => {}); return hit; }                           // returning visitor: the saved page opens at once, then refreshes quietly
  try { return await Promise.race([net, new Promise((_, no) => setTimeout(no, 8000))]); }
  catch (x) { return net; }
}
/* the open page asks for the new version to be fetched (and, when it is ready, reloads into it) */
self.addEventListener('message', e => {
  if (!e.data || e.data.type !== 'refresh-shell') return;
  const src = e.source;
  e.waitUntil((async () => { let ok = false; try { const r = await fetch('/', { cache: 'reload' }); if (r && r.ok) { await storeShell(r); ok = true; } } catch (x) {} if (src) src.postMessage({ type: 'shell-refreshed', ok }); })());
});
async function cacheFirst(req, name) {
  const c = await caches.open(name), hit = await c.match(req); if (hit) return hit;
  const r = await fetch(req); if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r;
}
async function revalidate(req, name) {
  const c = await caches.open(name), hit = await c.match(req);
  const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => hit);
  return hit || net;
}
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  let u; try { u = new URL(r.url); } catch (x) { return; }
  if (u.origin === self.location.origin) {
    if (u.pathname.startsWith('/api/') || u.pathname === '/sw.js' || r.headers.has('range')) return;
    if (r.mode === 'navigate' && u.pathname === '/') return e.respondWith(navigate(e));
    if ((u.searchParams.get('v') || u.pathname === '/assets/app.js') && /\.(js|css)$/.test(u.pathname)) return e.respondWith(cacheFirst(r, FILES));   // versioned: a new release has a new address
  } else if (EDGE_HOSTS.includes(u.hostname)) e.respondWith(revalidate(r, EDGE));
});
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
      await self.registration.showNotification(it.title || 'American Ditek Institute', { body: it.body || '', tag: 'adi-' + (it.at || Date.now()), icon: '/mail-assets/adi-logo.png', badge: '/mail-assets/adi-logo.png', vibrate: [300, 120, 300, 120, 500], silent: false, renotify: true, requireInteraction: true, timestamp: it.at || Date.now(), data: { url: '/#/notifs' } });
    }
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async list => {
    for (const c of list) { if ('focus' in c) { try { if (c.navigate && c.url.split('#')[0]) await c.navigate(c.url.split('#')[0] + '#/notifs'); } catch (x) {} return c.focus(); } }
    return self.clients.openWindow('/#/notifs');
  }));
});
