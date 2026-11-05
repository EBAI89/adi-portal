'use strict';
/* ADI attention guard.
   Most dialogs in the portal — forms, previews, the global search, confirmations with their own
   Yes/No buttons — are ordinary windows: the person may dismiss them at any time, by clicking outside,
   pressing Escape, or simply navigating elsewhere, exactly as international software conventions expect.

   A small minority of moments are different: a one-time credential screen, for instance, where leaving
   without reading it loses information that cannot be shown again. Those are marked up as
   role="alertdialog" (or an ordinary dialog opting in with data-guard="hard"). Only those are guarded
   here, and even then the person is never trapped — the first attempt to leave shows a calm, explicit
   "Are you sure?" prompt with a real way out, never an indefinite lock. */
(function () {
  if (window.__GUARD_INSTALLED) return; window.__GUARD_INSTALLED = true;
  const fr = () => typeof LANG !== 'undefined' && LANG === 'fr';
  const T = (en, f) => fr() ? f : en;
  const DIALOGS = '[role="alertdialog"],[role="dialog"][aria-modal="true"][data-guard="hard"]';
  const SINCE = new WeakMap();
  const RELEASED = new WeakSet();   // dialogs the person explicitly chose to leave; no longer guarded

  const shown = el => { try { const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none'; } catch (e) { return false; } };
  const z = el => { let n = 0, e = el; while (e && e !== document.body) { const v = parseInt(getComputedStyle(e).zIndex, 10); if (!isNaN(v)) n = Math.max(n, v); e = e.parentElement; } return n; };

  /* the window that currently holds the user's attention, or null */
  function current() {
    const found = [];
    document.querySelectorAll(DIALOGS).forEach(el => {
      if (!shown(el) || RELEASED.has(el) || el.closest('#gd-toast,#gd-leave')) return;
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

  /* ---- download-in-progress: a brief, literal nudge; a real Cancel button always sits inside the panel ---- */
  let ac = null, lastAt = 0;
  function beep() {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume();
      const t0 = ac.currentTime; [[440, 0], [330, 0.16]].forEach(([f, d]) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.22, t0 + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.15); o.connect(g); g.connect(ac.destination); o.start(t0 + d); o.stop(t0 + d + 0.16); });
    } catch (e) {}
  }
  function buzz() { try { if (navigator.vibrate) navigator.vibrate([140, 60, 140]); } catch (e) {} }
  let toastTimer = 0;
  function toastDownload(cur) {
    let t = document.getElementById('gd-toast'); if (!t) { t = document.createElement('div'); t.id = 'gd-toast'; t.setAttribute('role', 'alert'); t.setAttribute('aria-live', 'assertive'); document.body.appendChild(t); }
    t.innerHTML = '<b>⚠ ' + T('Please wait', 'Veuillez patienter') + '</b><span>' + T('A file is being prepared. Wait for it to finish, or cancel it, before continuing.', 'Un fichier est en cours de préparation. Attendez la fin, ou annulez-le, avant de continuer.') + '</span>';
    const r = cur.panel.getBoundingClientRect(), w = Math.min(420, innerWidth - 24);
    t.style.width = w + 'px';
    let left = r.left + r.width / 2 - w / 2; left = Math.max(12, Math.min(left, innerWidth - w - 12));
    const below = r.bottom + 12, top = below + 84 < innerHeight ? below : Math.max(12, r.top - 96);
    t.style.left = left + 'px'; t.style.top = top + 'px'; t.className = 'show';
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = ''; }, 3200);
  }

  /* ---- a guarded dialog (alertdialog): a calm, explicit way out, never an indefinite lock ---- */
  let pending = null;
  function hit(panel) { panel.classList.remove('gd-hit'); void panel.offsetWidth; panel.classList.add('gd-hit'); setTimeout(() => panel.classList.remove('gd-hit'), 650); }
  function askToLeave(cur) {
    if (pending) return;
    pending = cur;
    hit(cur.panel);
    let box = document.getElementById('gd-leave');
    if (!box) { box = document.createElement('div'); box.id = 'gd-leave'; document.body.appendChild(box); }
    box.innerHTML = '<div class="gd-leave-bg"><div class="gd-leave-box" role="alertdialog" aria-modal="true" aria-labelledby="gd-leave-t">' +
      '<h3 id="gd-leave-t">' + T('Leave this window?', 'Quitter cette fenêtre ?') + '</h3>' +
      '<p>' + T('You have not finished here yet. If you leave now, what is on screen may not be shown again.', 'Vous n’avez pas terminé ici. Si vous quittez maintenant, ce qui est affiché pourrait ne plus être montré.') + '</p>' +
      '<div class="gd-leave-row"><button type="button" class="btn ghost" id="gd-stay">' + T('Stay here', 'Rester ici') + '</button><button type="button" class="btn red" id="gd-go">' + T('Leave anyway', 'Quitter quand même') + '</button></div></div></div>';
    box.className = 'show';
    const stay = document.getElementById('gd-stay'), go2 = document.getElementById('gd-go');
    const end = () => { box.className = ''; pending = null; };
    stay.onclick = end;
    go2.onclick = () => { RELEASED.add(cur.root); end(); };
    setTimeout(() => stay.focus(), 10);
  }

  /* ---- block pointer interaction outside the current window, and answer it ---- */
  const BLOCK = ['pointerdown', 'mousedown', 'touchstart', 'click', 'dblclick', 'auxclick', 'contextmenu'];
  BLOCK.forEach(type => document.addEventListener(type, ev => {
    const cur = current(); if (!cur) return;
    const tg = ev.target; if (tg && tg.nodeType === 1 && (tg.closest && tg.closest('a[data-dlgo]') || cur.panel.contains(tg) || (tg.closest && tg.closest('#gd-toast,#gd-leave')))) return;
    ev.preventDefault(); ev.stopPropagation(); if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    if (type !== 'click') return;
    if (cur.kind === 'download') { const now = Date.now(); if (now - lastAt < 450) return; lastAt = now; toastDownload(cur); beep(); buzz(); }
    else askToLeave(cur);
  }, { capture: true, passive: false }));

  /* Escape asks the same calm question, rather than doing nothing or silently blocking */
  document.addEventListener('keydown', ev => {
    if (ev.key !== 'Escape') return;
    const cur = current(); if (!cur || cur.kind === 'download') return;
    if (document.getElementById('gd-leave') && document.getElementById('gd-leave').className === 'show') return;
    askToLeave(cur);
  });

  /* ---- keep keyboard focus inside the window (or the leave-confirmation, while it is open) ---- */
  document.addEventListener('focusin', ev => {
    const leaveBox = document.getElementById('gd-leave');
    if (leaveBox && leaveBox.className === 'show') { if (leaveBox.contains(ev.target)) return; const f = leaveBox.querySelector('button'); if (f) f.focus(); return; }
    const cur = current(); if (!cur || cur.panel.contains(ev.target) || (ev.target.closest && ev.target.closest('#gd-toast'))) return;
    const f = cur.panel.querySelector('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'); if (f && f.focus) f.focus(); else if (cur.panel.focus) { cur.panel.tabIndex = -1; cur.panel.focus(); }
  }, true);

  const css = document.createElement('style'); css.id = 'gd-css';
  css.textContent = '@keyframes gdshake{0%,100%{transform:translateX(0)}15%{transform:translateX(-10px)}30%{transform:translateX(9px)}45%{transform:translateX(-7px)}60%{transform:translateX(5px)}75%{transform:translateX(-3px)}}' +
    '@keyframes gdglow{0%{box-shadow:0 0 0 0 rgba(179,38,30,.7)}60%{box-shadow:0 0 0 14px rgba(179,38,30,0)}100%{box-shadow:0 0 0 0 rgba(179,38,30,0)}}' +
    '.gd-hit{animation:gdshake .5s cubic-bezier(.36,.07,.19,.97),gdglow .8s ease-out;outline:3px solid #B3261E;outline-offset:2px}' +
    '#gd-toast{position:fixed;z-index:2147483000;display:flex;flex-direction:column;gap:2px;box-sizing:border-box;padding:12px 16px;border-radius:12px;background:#B3261E;color:#fff;font:600 14px/1.35 Inter,Arial,sans-serif;box-shadow:0 14px 36px rgba(0,0,0,.35);border-left:6px solid #C9A227;opacity:0;transform:translateY(8px);pointer-events:none;transition:opacity .18s,transform .18s}' +
    '#gd-toast.show{opacity:1;transform:none}#gd-toast b{font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;color:#FFE08A}#gd-toast span{font-weight:500}' +
    '#gd-leave{position:fixed;inset:0;z-index:2147483100;display:none}#gd-leave.show{display:block}' +
    '#gd-leave .gd-leave-bg{position:fixed;inset:0;background:rgba(5,12,32,.55);display:grid;place-items:center;padding:16px;animation:gdfade .15s ease-out}' +
    '#gd-leave .gd-leave-box{background:#fff;color:#0F1A33;max-width:380px;width:100%;border-radius:14px;padding:20px 22px;box-shadow:0 20px 50px rgba(0,0,0,.35);border-top:4px solid #B3131E;font:400 15px/1.5 Inter,Arial,sans-serif;animation:gdpop .18s cubic-bezier(.2,.8,.2,1) both}' +
    '#gd-leave h3{margin:0 0 8px;font-size:1.08rem;color:#0B2559}#gd-leave p{margin:0 0 16px;color:#5A6580;font-size:.92rem}' +
    '#gd-leave .gd-leave-row{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}' +
    '#gd-leave .btn{border-radius:8px;padding:9px 16px;font:600 .88rem/1 Inter,Arial,sans-serif;cursor:pointer;border:1px solid transparent}' +
    '#gd-leave .btn.ghost{background:#fff;border-color:#D9DFEC;color:#0F1A33}#gd-leave .btn.red{background:#B3131E;color:#fff}' +
    '@keyframes gdfade{from{opacity:0}to{opacity:1}}@keyframes gdpop{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}' +
    '@media (prefers-color-scheme:dark){#gd-leave .gd-leave-box{background:#121C38;color:#E7ECF8}#gd-leave h3{color:#E7ECF8}#gd-leave p{color:#9AA7C7}#gd-leave .btn.ghost{background:#18244A;border-color:#26335A;color:#E7ECF8}}' +
    '@media (prefers-reduced-motion:reduce){.gd-hit{animation:gdglow .8s ease-out}.gd-leave-bg,.gd-leave-box{animation:none}}';
  document.head.appendChild(css);
})();
