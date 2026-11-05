'use strict';
/* ADI attention guard.
   Most dialogs in the portal — forms, previews, the global search, confirmations with their own
   Yes/No buttons — are ordinary windows: the person may dismiss them at any time, by clicking outside,
   pressing Escape, or simply navigating elsewhere, exactly as international software conventions expect.

   A small minority of moments are different: a one-time credential screen, for instance, where leaving
   without saving it loses information that cannot be shown again. Those are marked up as
   role="alertdialog" (or an ordinary dialog opting in with data-guard="hard"). Only those are guarded
   here — and for those, the rule is absolute: the window does not close, and nothing behind it can be
   used, until the person completes the action the window asks for (its own Save/Confirm/"I understand"
   control, always reachable inside the window itself). A calm, explicit notice explains why, every time
   the person tries to leave; there is no bypass. */
(function () {
  if (window.__GUARD_INSTALLED) return; window.__GUARD_INSTALLED = true;
  const fr = () => typeof LANG !== 'undefined' && LANG === 'fr';
  const T = (en, f) => fr() ? f : en;
  const DIALOGS = '[role="alertdialog"],[role="dialog"][aria-modal="true"][data-guard="hard"]';
  const SINCE = new WeakMap();

  const shown = el => { try { const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none'; } catch (e) { return false; } };
  const z = el => { let n = 0, e = el; while (e && e !== document.body) { const v = parseInt(getComputedStyle(e).zIndex, 10); if (!isNaN(v)) n = Math.max(n, v); e = e.parentElement; } return n; };

  /* the window that currently holds the user's attention, or null */
  function current() {
    const found = [];
    document.querySelectorAll(DIALOGS).forEach(el => {
      if (!shown(el) || el.closest('#gd-toast')) return;
      const r = el.getBoundingClientRect(), cover = r.width >= innerWidth * 0.95 && r.height >= innerHeight * 0.95;
      found.push({ kind: 'dialog', root: el, panel: cover && el.firstElementChild ? el.firstElementChild : el, z: z(el), n: found.length });
    });
    const dl = [...document.querySelectorAll('#dlp-box .dlp:not(.ok):not(.bad)')].filter(shown);   // a finished or failed card never holds the page
    if (dl.length) {
      const box = document.getElementById('dlp-box'), now = Date.now();
      dl.forEach(e => { if (!SINCE.has(e)) SINCE.set(e, now); });
      if (dl.some(e => now - SINCE.get(e) < 5 * 60 * 1000)) found.push({ kind: 'download', root: box, panel: box, cards: dl, z: z(box), n: found.length });   // never block for more than 5 minutes
    }
    if (!found.length) return null;
    found.sort((a, b) => (b.z - a.z) || (b.n - a.n)); return found[0];
  }

  /* ---- the notice: a calm, literal explanation, a brief visual cue, no bypass ---- */
  let ac = null, lastAt = 0;
  function beep() {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume();
      const t0 = ac.currentTime; [[440, 0], [330, 0.16]].forEach(([f, d]) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.22, t0 + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.15); o.connect(g); g.connect(ac.destination); o.start(t0 + d); o.stop(t0 + d + 0.16); });
    } catch (e) {}
  }
  function buzz() { try { if (navigator.vibrate) navigator.vibrate([140, 60, 140]); } catch (e) {} }

  function toast(cur) {
    let t = document.getElementById('gd-toast'); if (!t) { t = document.createElement('div'); t.id = 'gd-toast'; t.setAttribute('role', 'alert'); t.setAttribute('aria-live', 'assertive'); document.body.appendChild(t); }
    const dl = cur.kind === 'download';
    t.innerHTML = '<b>⚠ ' + (dl ? T('Please wait', 'Veuillez patienter') : T('Action required', 'Action requise')) + '</b><span>' + (dl
      ? T('A file is being prepared. Wait for it to finish, or cancel it, before continuing.', 'Un fichier est en cours de préparation. Attendez la fin, ou annulez-le, avant de continuer.')
      : T('This window must be completed or saved before you can leave it. Use its own button to finish here.', 'Cette fenêtre doit être complétée ou enregistrée avant de pouvoir la quitter. Utilisez son propre bouton pour terminer ici.')) + '</span>';
    const r = cur.panel.getBoundingClientRect(), w = Math.min(420, innerWidth - 24);
    t.style.width = w + 'px';
    let left = r.left + r.width / 2 - w / 2; left = Math.max(12, Math.min(left, innerWidth - w - 12));
    const below = r.bottom + 12, top = below + 84 < innerHeight ? below : Math.max(12, r.top - 96);
    t.style.left = left + 'px'; t.style.top = top + 'px'; t.className = 'show';
    clearTimeout(toast._t); toast._t = setTimeout(() => { t.className = ''; }, 3200);
  }

  function notify(cur) {
    const now = Date.now(); if (now - lastAt < 450) return; lastAt = now;
    cur.panel.classList.remove('gd-hit'); void cur.panel.offsetWidth; cur.panel.classList.add('gd-hit'); setTimeout(() => cur.panel.classList.remove('gd-hit'), 650);
    toast(cur);
    beep(); buzz();
  }

  /* ---- block every pointer interaction outside the window: no click, tap, or navigation reaches
     anything else while a guarded window is open, and there is no way to dismiss it but its own control ---- */
  const BLOCK = ['pointerdown', 'mousedown', 'touchstart', 'click', 'dblclick', 'auxclick', 'contextmenu'];
  BLOCK.forEach(type => document.addEventListener(type, ev => {
    const cur = current(); if (!cur) return;
    const tg = ev.target; if (tg && tg.nodeType === 1 && (tg.closest && tg.closest('a[data-dlgo]') || cur.panel.contains(tg) || (tg.closest && tg.closest('#gd-toast')))) return;
    ev.preventDefault(); ev.stopPropagation(); if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    if (type === 'pointerdown' || type === 'mousedown' || type === 'touchstart' || type === 'click') notify(cur);
  }, { capture: true, passive: false }));

  /* Escape is not an exit either — it answers with the same notice, never a silent close */
  document.addEventListener('keydown', ev => {
    if (ev.key !== 'Escape') return;
    const cur = current(); if (!cur) return;
    ev.preventDefault(); ev.stopPropagation();
    notify(cur);
  }, true);

  /* ---- keep keyboard focus inside the window ---- */
  document.addEventListener('focusin', ev => {
    const cur = current(); if (!cur || cur.panel.contains(ev.target) || (ev.target.closest && ev.target.closest('#gd-toast'))) return;
    const f = cur.panel.querySelector('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'); if (f && f.focus) f.focus(); else if (cur.panel.focus) { cur.panel.tabIndex = -1; cur.panel.focus(); }
  }, true);

  const css = document.createElement('style'); css.id = 'gd-css';
  css.textContent = '@keyframes gdshake{0%,100%{transform:translateX(0)}15%{transform:translateX(-10px)}30%{transform:translateX(9px)}45%{transform:translateX(-7px)}60%{transform:translateX(5px)}75%{transform:translateX(-3px)}}' +
    '@keyframes gdglow{0%{box-shadow:0 0 0 0 rgba(179,38,30,.7)}60%{box-shadow:0 0 0 14px rgba(179,38,30,0)}100%{box-shadow:0 0 0 0 rgba(179,38,30,0)}}' +
    '.gd-hit{animation:gdshake .5s cubic-bezier(.36,.07,.19,.97),gdglow .8s ease-out;outline:3px solid #B3261E;outline-offset:2px}' +
    '#gd-toast{position:fixed;z-index:2147483000;display:flex;flex-direction:column;gap:2px;box-sizing:border-box;padding:12px 16px;border-radius:12px;background:#B3261E;color:#fff;font:600 14px/1.35 Inter,Arial,sans-serif;box-shadow:0 14px 36px rgba(0,0,0,.35);border-left:6px solid #C9A227;opacity:0;transform:translateY(8px);pointer-events:none;transition:opacity .18s,transform .18s}' +
    '#gd-toast.show{opacity:1;transform:none}#gd-toast b{font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;color:#FFE08A}#gd-toast span{font-weight:500}' +
    '@media (prefers-reduced-motion:reduce){.gd-hit{animation:gdglow .8s ease-out}}';
  document.head.appendChild(css);
})();
