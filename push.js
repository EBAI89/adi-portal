'use strict';
/* Alerts on this device (Web Push): works when the portal page is closed.
   Adds a card to the dashboard (staff) and to the profile page, and registers the service worker. */
(function () {
  if (window.__PUSH_INSTALLED) return; window.__PUSH_INSTALLED = true;
  const LBL = (en, fr) => (typeof LANG !== 'undefined' && LANG === 'fr') ? fr : en;
  const SUP = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const ST = { devices: null, on: false, busy: false, loaded: false };

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

  const key64 = s => { const p = '='.repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, c => c.charCodeAt(0)); };
  async function mine() { try { const reg = await navigator.serviceWorker.ready; return await reg.pushManager.getSubscription(); } catch (e) { return null; } }
  async function load() {
    if (!SUP() || typeof me !== 'function' || !me()) return;
    ST.on = !!(await mine()) && Notification.permission === 'granted';
    try { ST.devices = (await api('/api/push/status')).devices; } catch (e) { ST.devices = null; }
    ST.loaded = true; if (typeof render === 'function') render();
  }
  let lastUid = null;
  setInterval(() => { const u = typeof me === 'function' && me(); const id = u ? u.id : null; if (id !== lastUid) { lastUid = id; ST.loaded = false; if (id) load(); } }, 1500);

  async function enable() {
    if (!SUP()) return toast(LBL('This browser cannot show alerts when closed. On iPhone, add the portal to the Home Screen first.', 'Ce navigateur ne peut pas afficher d\'alertes lorsqu\'il est fermé. Sur iPhone, ajoutez d\'abord le portail à l\'écran d\'accueil.'), 1);
    ST.busy = true; render();
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') throw new Error(LBL('Alerts are blocked. Allow notifications for this site in the browser settings, then try again.', 'Les alertes sont bloquées. Autorisez les notifications pour ce site dans les paramètres du navigateur, puis réessayez.'));
      const reg = await navigator.serviceWorker.ready, k = (await api('/api/push/key')).key;
      let sub = await reg.pushManager.getSubscription(); if (sub) { try { await sub.unsubscribe(); } catch (e) {} }
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key64(k) });
      await api('/api/push/subscribe', { body: { subscription: sub.toJSON() } });
      toast(LBL('Alerts are on for this device.', 'Les alertes sont activées sur cet appareil.'));
    } catch (e) { toast(String((e && e.message) || e), 1); }
    ST.busy = false; await load();
  }
  async function disable() {
    ST.busy = true; render();
    try { const sub = await mine(); if (sub) { await api('/api/push/unsubscribe', { body: { endpoint: sub.endpoint } }); await sub.unsubscribe(); } toast(LBL('Alerts are off for this device.', 'Les alertes sont désactivées sur cet appareil.')); } catch (e) { toast(String((e && e.message) || e), 1); }
    ST.busy = false; await load();
  }
  async function test() {
    try { await api('/api/push/test', { body: {} }); toast(LBL('Test alert sent. It should appear in a few seconds, even if you close the portal.', 'Alerte de test envoyée. Elle doit apparaître dans quelques secondes, même si vous fermez le portail.')); } catch (e) { toast(String((e && e.message) || e), 1); }
  }
  ACT.pushon = () => { enable(); }; ACT.pushoff = () => { disable(); }; ACT.pushtest = () => { test(); };

  function card() {
    if (!SUP()) return `<div class="card gap"><h3>🔔 ${LBL('Alerts on this device', 'Alertes sur cet appareil')}</h3><p class="muted">${LBL('This browser cannot show alerts when the portal is closed. On iPhone, add the portal to the Home Screen first; on Android and computers use Chrome, Edge or Firefox.', 'Ce navigateur ne peut pas afficher d\'alertes lorsque le portail est fermé. Sur iPhone, ajoutez d\'abord le portail à l\'écran d\'accueil ; sur Android et ordinateur, utilisez Chrome, Edge ou Firefox.')}</p></div>`;
    const blocked = Notification.permission === 'denied';
    return `<div class="card gap"><h3>🔔 ${LBL('Alerts on this device', 'Alertes sur cet appareil')}</h3><p class="muted">${LBL('Receive a pop-up on this phone or computer for each portal notification (new applications, payments, inquiries, messages), even when the portal is not open.', 'Recevez une alerte sur ce téléphone ou cet ordinateur pour chaque notification du portail (candidatures, paiements, demandes, messages), même lorsque le portail n\'est pas ouvert.')}</p>
      ${blocked ? `<div class="note bad">${LBL('Notifications are blocked for this site. Allow them in the browser settings (lock icon next to the address), then reload.', 'Les notifications sont bloquées pour ce site. Autorisez-les dans les paramètres du navigateur (icône de cadenas près de l\'adresse), puis rechargez.')}</div>` : ''}
      <p class="small">${ST.on ? '✅ ' + LBL('On for this device', 'Activées sur cet appareil') : '⚪ ' + LBL('Off for this device', 'Désactivées sur cet appareil')}${ST.devices != null ? ' · ' + LBL(ST.devices + ' device(s) in total', ST.devices + ' appareil(s) au total') : ''}</p>
      <div class="row">${ST.on ? `<button class="btn ghost" data-a="pushtest" ${ST.busy ? 'disabled' : ''}>${LBL('Send a test alert', 'Envoyer une alerte de test')}</button><button class="btn ghost" data-a="pushoff" ${ST.busy ? 'disabled' : ''}>${LBL('Turn off', 'Désactiver')}</button>` : `<button class="btn gold" data-a="pushon" ${ST.busy || blocked ? 'disabled' : ''}>${LBL('Turn on alerts', 'Activer les alertes')}</button>`}</div></div>`;
  }
  const dismissed = () => { try { return sessionStorage.getItem('adi_pushbn') === '1'; } catch (e) { return false; } };
  ACT.pushbnx = () => { try { sessionStorage.setItem('adi_pushbn', '1'); } catch (e) {} render(); };
  function banner() {
    if (!ST.loaded || ST.on || dismissed()) return '';
    const sup = SUP(), blocked = sup && Notification.permission === 'denied';
    return `<section class="pbn" role="region" aria-label="${LBL('Phone alerts', 'Alertes sur téléphone')}"><div class="pbn-ico">🔔</div><div class="pbn-b"><p class="pbn-k">${LBL('Institutional alerts', 'Alertes institutionnelles')}</p><h3>${LBL('Be informed the moment it matters', 'Soyez informé(e) dès que cela compte')}</h3><p>${sup ? (blocked ? LBL('Notifications are blocked for this site. Allow them in the browser settings (lock icon beside the address), then reload this page.', 'Les notifications sont bloquées pour ce site. Autorisez-les dans les paramètres du navigateur (icône de cadenas près de l\'adresse), puis rechargez la page.') : LBL('Receive a notification on this phone or computer, like a message, for every application, payment, enquiry or request awaiting your attention. A copy is also sent to your e-mail address.', 'Recevez sur ce téléphone ou cet ordinateur, comme un message, une notification pour chaque candidature, paiement, demande ou requête en attente de votre décision. Une copie est également envoyée à votre adresse e-mail.')) : LBL('This browser cannot show alerts when the portal is closed. On iPhone, add the portal to the Home Screen first; on Android, use Chrome.', 'Ce navigateur ne peut pas afficher d\'alertes lorsque le portail est fermé. Sur iPhone, ajoutez d\'abord le portail à l\'écran d\'accueil ; sur Android, utilisez Chrome.')}</p><div class="row">${sup && !blocked ? `<button class="btn gold" data-a="pushon" ${ST.busy ? 'disabled' : ''}>${LBL('Enable alerts on this device', 'Activer les alertes sur cet appareil')}</button>` : ''}<button class="btn ghost" data-a="pushbnx">${LBL('Later', 'Plus tard')}</button></div></div></section>`;
  }
  document.head.insertAdjacentHTML('beforeend', '<style id="pbn-css">.pbn{display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:start;margin:0 0 16px;padding:18px 20px;border-radius:16px;background:#0b2559;color:#f7f4ec;border-left:5px solid #c9a227}.pbn-ico{font-size:1.8rem;line-height:1}.pbn-k{margin:0;font:700 .72rem/1 inherit;letter-spacing:.14em;text-transform:uppercase;color:#c9a227}.pbn h3{margin:6px 0 6px;color:#fff;font-size:1.15rem}.pbn p{margin:0 0 12px;color:#e7e1d2;line-height:1.55}.pbn .btn.ghost{background:transparent;color:#fff;border-color:rgba(255,255,255,.5)}@media(max-width:480px){.pbn{grid-template-columns:1fr}}</style>');
  const wrap = (id, show) => {
    const r = ROUTES.find(x => x.id === id); if (!r) return; const base = r.v;
    r.v = function () { let h = base(); const u = me(); if (!u || !show(u)) return h; if (!ST.loaded) load(); return (id === 'dashboard' ? banner() : '') + h + card(); };
  };
  wrap('dashboard', u => !['student', 'applicant'].includes(u.role));
  wrap('profile', () => true);
})();
