/* ADI staff app — the portal's server, replaced by a small one that lives inside the page.
 * The portal's own pages and its own Transcript Office run unchanged; the calls they would send to the server are answered here, from data
 * packed in the app and from records kept on this phone. The document register is the portal's own module (adi-docreg.js), so special-case
 * records are checked, graded and issued exactly as on the portal. Nothing is ever sent over the network. */
(function () {
  'use strict';
  const SS = { get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }, del(k) { try { sessionStorage.removeItem(k); } catch (e) {} } };
  const LS = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } } };
  let PROF = null; try { PROF = JSON.parse(LS.get('adi_off_profile') || 'null'); } catch (e) {}
  if (!PROF || !PROF.dk || SS.get('adi_off_unlocked') !== '1') { location.replace('/offline-app/gate.html'); return; }
  /* Coming back from another app (to read marks from a photo, say) must not close the session and lose a record being typed:
     the portal's own check runs after this one and then finds the session fresh. The PIN is asked again whenever the app is reopened,
     and the portal's 15-minute idle warning still applies. */
  const fresh = () => { if (!document.hidden) LS.set('adi_last', String(Date.now())); };
  document.addEventListener('visibilitychange', fresh, true); window.addEventListener('pageshow', fresh, true); window.addEventListener('focus', fresh, true);
  try { if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.reject(new Error('offline app')); } catch (e) {}

  /* ---- SHA-256 and HMAC, synchronous (the register module expects Node's crypto) ---- */
  const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  function sha256(bytes) {
    const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const l = bytes.length, n = ((l + 9 + 63) >> 6) << 6, m = new Uint8Array(n); m.set(bytes); m[l] = 0x80;
    const dv = new DataView(m.buffer); dv.setUint32(n - 8, Math.floor(l / 0x20000000)); dv.setUint32(n - 4, (l << 3) >>> 0);
    const w = new Uint32Array(64);
    for (let o = 0; o < n; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
      for (let i = 16; i < 64; i++) { const a = w[i - 15], b = w[i - 2]; w[i] = (w[i - 16] + (((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3)) + w[i - 7] + (((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10))) >>> 0; }
      let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
        const t2 = ((((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0; H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    const out = new Uint8Array(32), ov = new DataView(out.buffer); H.forEach((x, i) => ov.setUint32(i * 4, x)); return out;
  }
  const utf8 = s => new TextEncoder().encode(String(s)), hex = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  const cat = (a, b) => { const o = new Uint8Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; };
  function hmac(key, msg) { let k = utf8(key); if (k.length > 64) k = sha256(k); const p = new Uint8Array(64); p.set(k); const i = p.map(x => x ^ 0x36), o = p.map(x => x ^ 0x5c); return sha256(cat(o, sha256(cat(i, msg)))); }
  const nodeCrypto = {
    createHash() { let s = ''; const o = { update(x) { s += String(x); return o; }, digest() { return hex(sha256(utf8(s))); } }; return o; },
    createHmac(alg, key) { let s = ''; const o = { update(x) { s += String(x); return o; }, digest() { return hex(hmac(key, utf8(s))); } }; return o; },
    randomBytes(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return { toString() { return hex(a); } }; },
    timingSafeEqual(a, b) { return a.length === b.length && a.every((x, i) => x === b[i]); }
  };
  const NodeBuffer = { from: s => Array.from(utf8(s)) };
  window.__ADI_OFF_SELFTEST = () => hex(sha256(utf8('abc'))) === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' && hex(hmac('key', utf8('The quick brown fox jumps over the lazy dog'))) === 'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8';

  /* ---- data: packed with the app (read only) and kept on this phone (records composed and documents issued here) ---- */
  const realFetch = window.fetch.bind(window);
  const packed = n => realFetch('/offline-app/api/' + n + '.json').then(r => { if (!r.ok) throw new Error('missing ' + n); return r.json(); });
  /* the students' records, the seal and the signatures are packed sealed; the key was drawn from the activation code at first use (gate.html) */
  const unhex = h => new Uint8Array(String(h).match(/../g).map(x => parseInt(x, 16)));
  const dataKey = crypto.subtle.importKey('raw', unhex(PROF.dk), 'AES-GCM', false, ['decrypt']);
  const opened = async n => { const b = await packed(n + '.enc'), raw = Uint8Array.from(atob(b.ct), c => c.charCodeAt(0)); return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unhex(b.iv) }, await dataKey, raw))); };
  const SEED = { health: packed('health'), sync: opened('sync'), sig: opened('sig') };
  SEED.sync.catch(() => {}); SEED.sig.catch(() => {});
  let DB = { cols: {}, meta: {}, audit: [] }; try { DB = Object.assign(DB, JSON.parse(LS.get('adi_off_db') || '{}')); } catch (e) {}
  const LOCAL = ['sptr', 'docreg'];
  const flush = () => { if (!LS.set('adi_off_db', JSON.stringify(DB))) throw Object.assign(new Error('The phone storage is full: export the records, then free some space.'), { status: 507 }); };
  let seedCols = {};
  const S = {
    meta: DB.meta,
    all(c) { return LOCAL.includes(c) ? (DB.cols[c] || (DB.cols[c] = {})) : (seedCols[c] || {}); },
    get(c, id) { return this.all(c)[id] || null; },
    async put(c, id, doc) { if (!LOCAL.includes(c)) throw new Error('read only'); this.all(c)[id] = doc; flush(); },
    async del(c, id) { if (!LOCAL.includes(c)) throw new Error('read only'); delete this.all(c)[id]; flush(); },
    async setMeta(k, v) { DB.meta[k] = v; flush(); }
  };
  let REG = null, ME = null;
  const ready = (async () => {
    const sync = await SEED.sync; seedCols = sync.cols || {};
    ME = Object.assign({}, (seedCols.users || {})[sync.me] || { id: sync.me, role: 'super_admin', status: 'active' }, { name: PROF.name || 'Super Administrator' });
    if (seedCols.users) seedCols.users[sync.me] = ME;
    const mod = { exports: {} }; window.__ADI_DOCREG(n => { if (n === 'crypto') return nodeCrypto; throw new Error('no module ' + n); }, mod, NodeBuffer);
    REG = mod.exports({ S, now: () => Date.now(), limited: () => false, ip: () => 'device', SECRET: PROF.secret, core: {}, serialTag: 'OF' + PROF.tag + '-', seedRecs: sync.__spSeed || [],
      send(res, code, obj) { res.code = code; res.out = obj; }, body: async req => req.body || {},
      audit: async (u, action) => { DB.audit.push({ at: Date.now(), user: (u && u.name) || '', action: String(action) }); if (DB.audit.length > 2000) DB.audit.splice(0, DB.audit.length - 2000); flush(); } });
    return sync;
  })();
  window.__ADI_OFF = { profile: () => ({ name: PROF.name, tag: PROF.tag }), export: () => ({ app: 'ADI staff app (offline)', device: PROF.tag, officer: PROF.name, exportedAt: new Date().toISOString(), records: Object.values(DB.cols.sptr || {}), register: Object.values(DB.cols.docreg || {}), audit: DB.audit }), lock() { SS.del('adi_off_unlocked'); location.replace('/offline-app/gate.html'); } };

  const NA = { error: 'Not available in the offline app · Indisponible dans l’application hors ligne' };
  async function answer(method, path, q, body) {
    const sync = await ready;
    if (path === '/api/health') return [200, Object.assign({}, await SEED.health, { me: sync.me, ai: false, momo: null, demo: false, demoAccounts: null })];
    if (path === '/api/sync' && method === 'GET') {
      if (String(q.get('since') || '0') === '0' || q.get('epoch') !== sync.epoch) return [200, Object.assign({}, sync, { full: true, __spSeed: undefined })];
      return [200, { epoch: sync.epoch, seq: sync.seq, vk: sync.vk, me: sync.me, full: false, cols: {}, del: [] }];
    }
    if (path === '/api/sig') return [200, await SEED.sig];
    if (path === '/api/outlines') return [200, { o: {} }];
    if (path === '/api/docs/issue' || path === '/api/sptr' || path.startsWith('/api/sptr/')) {
      const res = {}; if (await REG.handle({ method, body }, res, ME, null, path)) return [res.code || 500, res.out || {}];
      return [404, NA];
    }
    if (path === '/api/files/save') return [200, { id: 'f' + Date.now().toString(36) }];
    if (path === '/api/chat/status') return [200, { on: false, staffOnline: false, ai: false }];
    if (path === '/api/push/status') return [200, { devices: 0 }];
    if (path === '/api/studio/co') return [200, { cassign: {} }];
    if (path === '/api/rates') return [200, { base: 'XAF', rates: { XAF: 1 }, date: null, updated: null, source: '', url: '', peg: { EUR: 655.957 }, stale: true }];
    if (path === '/api/vis/hit') return [200, {}];
    if (path === '/api/session/ping') return [200, { me: sync.me }];
    if (path === '/api/logout') { setTimeout(() => window.__ADI_OFF.lock(), 50); return [200, { ok: true }]; }
    return [404, NA];
  }
  window.fetch = function (input, init) {
    let u; try { u = new URL(typeof input === 'string' ? input : input.url, location.href); } catch (e) { return realFetch(input, init); }
    if (u.origin !== location.origin || !u.pathname.startsWith('/api/')) return realFetch(input, init);
    const method = String((init && init.method) || (typeof input !== 'string' && input.method) || 'GET').toUpperCase();
    let body = {}; try { if (init && typeof init.body === 'string' && init.body) body = JSON.parse(init.body); } catch (e) {}
    return answer(method, u.pathname, u.searchParams, body)
      .catch(e => [e && e.status ? e.status : 500, { error: (e && e.message) || 'Error' }])
      .then(([code, obj]) => new Response(JSON.stringify(obj), { status: code, headers: { 'Content-Type': 'application/json; charset=utf-8' } }));
  };
})();
