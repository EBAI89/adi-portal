/* ADI staff app — runs after the portal's own scripts: saves files through the phone, opens on the Transcript Office and adds the app's own bar. */
(function () {
  'use strict';
  if (!window.__ADI_OFF) return;
  const fr = () => typeof LANG !== 'undefined' && LANG === 'fr';
  const b64 = data => { const u = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data.buffer ? data.buffer : data); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const say = (m, bad) => { if (typeof toast === 'function') toast(m, bad ? 1 : 0); };
  /* files: handed to the phone, which stores them in Downloads and offers to open or share them */
  let hooked = false;
  function hook() {   // the portal's scripts are deferred: its save function exists only once they have run
    if (hooked || typeof saveFile !== 'function') return; hooked = true;
    if (!(window.AdiStaff && typeof window.AdiStaff.saveFile === 'function')) return;
    const safe = n => String(n || 'ADI-document').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120);
    window.saveFile = async function (name, data, mime) {
      try { const where = window.AdiStaff.saveFile(safe(name), b64(data), mime || 'application/octet-stream'); say((fr() ? 'Enregistré : ' : 'Saved: ') + (where || safe(name))); return true; }
      catch (e) { say((fr() ? 'Enregistrement impossible : ' : 'Could not save the file: ') + ((e && e.message) || ''), 1); return false; }
    };
  }
  const exportAll = async () => {
    const d = window.__ADI_OFF.export(), name = 'ADI-offline-register-' + d.device + '-' + new Date().toISOString().slice(0, 10) + '.json';
    if (typeof saveFile === 'function') await saveFile(name, JSON.stringify(d, null, 1), 'application/json', true);
  };
  function bar() {
    if (document.getElementById('adi-off-bar') || !document.body) return;
    const p = window.__ADI_OFF.profile(), b = document.createElement('div'); b.id = 'adi-off-bar';
    b.style.cssText = 'background:#3B2A00;color:#fff;font:600 13px/1.35 system-ui,Arial,sans-serif;padding:8px 12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;position:relative;z-index:100020';
    const t = document.createElement('span'); t.style.cssText = 'flex:1;min-width:180px;font-weight:500';
    t.textContent = (fr() ? 'Application du personnel, hors ligne — les dossiers restent sur ce téléphone. Appareil ' : 'Staff app, offline — records stay on this phone. Device ') + 'OF' + p.tag + ' · ' + p.name;
    const mk = (txt, fn) => { const x = document.createElement('button'); x.type = 'button'; x.textContent = txt; x.style.cssText = 'border:1px solid #C9A227;background:transparent;color:#F4E9C1;font:inherit;border-radius:6px;padding:7px 10px;min-height:36px'; x.addEventListener('click', fn); return x; };
    b.append(t, mk(fr() ? 'Bureau des relevés' : 'Transcript Office', () => { location.hash = '#/transcript-office'; }), mk(fr() ? 'Exporter les dossiers' : 'Export records', exportAll), mk(fr() ? 'Verrouiller' : 'Lock', () => window.__ADI_OFF.lock()));
    document.body.insertBefore(b, document.body.firstChild);
  }
  let routed = false;
  const tick = setInterval(() => {
    bar(); hook();
    if (typeof BOOT_DONE !== 'undefined' && BOOT_DONE && !routed) {
      routed = true;
      let first = true; try { first = sessionStorage.getItem('adi_off_routed') !== '1'; sessionStorage.setItem('adi_off_routed', '1'); } catch (e) {}
      if (first) location.hash = '#/transcript-office';
    }
  }, 400);
  setTimeout(() => clearInterval(tick), 60000);
})();
