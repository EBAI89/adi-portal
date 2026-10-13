'use strict';
/* Web Push (RFC 8030 + VAPID, RFC 8292) with no external dependency.
   A push carries no payload: the service worker asks /api/push/pull for what is waiting.
   Keys and subscriptions live in the store's meta area, never in a synced collection. */

const crypto = require('crypto');
const https = require('https');

const b64u = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const clip = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
const hash = s => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 24);

module.exports = function ({ S, now, send, body, limited, E }) {
  let ST = null, PRIV = null, PUB = '';

  async function persist() { await S.setMeta('push', ST); }

  async function init() {
    ST = S.meta && S.meta.push && S.meta.push.jwk ? S.meta.push : null;
    if (!ST) {
      const kp = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
      ST = { jwk: kp.privateKey.export({ format: 'jwk' }), subs: {} };
      await persist();
    }
    ST.subs = ST.subs || {};
    PRIV = crypto.createPrivateKey({ key: ST.jwk, format: 'jwk' });
    PUB = b64u(Buffer.concat([Buffer.from([4]), Buffer.from(ST.jwk.x, 'base64'), Buffer.from(ST.jwk.y, 'base64')]));
  }

  function vapid(endpoint) {
    const aud = new URL(endpoint).origin;
    const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
    const pay = b64u(JSON.stringify({ aud, exp: Math.floor(now() / 1000) + 12 * 3600, sub: 'mailto:' + (E && E.INBOX_EMAIL || 'e.bill@adiuniversity.com') }));
    const sig = crypto.sign('sha256', Buffer.from(head + '.' + pay), { key: PRIV, dsaEncoding: 'ieee-p1363' });
    return 'vapid t=' + head + '.' + pay + '.' + b64u(sig) + ', k=' + PUB;
  }

  function ping(sub) {
    return new Promise(resolve => {
      let u; try { u = new URL(sub.endpoint); } catch (e) { return resolve(0); }
      if (u.protocol !== 'https:') return resolve(0);
      const req = https.request(u, { method: 'POST', timeout: 8000, headers: { Authorization: vapid(sub.endpoint), TTL: '86400', Urgency: 'high', 'Content-Length': '0' } }, res => {
        res.resume(); res.on('end', () => resolve(res.statusCode));
      });
      req.on('timeout', () => { req.destroy(); resolve(0); });
      req.on('error', () => resolve(0));
      req.end();
    });
  }

  /* queue an alert for every device of the user, then wake each device */
  async function notify(userId, title, text) {
    if (!ST || !userId) return;
    const mine = Object.entries(ST.subs).filter(([, s]) => s.userId === userId);
    if (!mine.length) return;
    for (const [, s] of mine) { s.pending = (s.pending || []).concat([{ title: clip(title, 120), body: clip(text, 300), at: now() }]).slice(-20); }
    await persist();
    for (const [k, s] of mine) {
      const code = await ping(s);
      if (code === 404 || code === 410) { delete ST.subs[k]; await persist(); }
      else if (code >= 400 || code === 0) console.error('[push] ' + (code || 'no answer') + ' from ' + (() => { try { return new URL(s.endpoint).host; } catch (e) { return '?'; } })());
    }
  }

  async function handle(req, res, u, p) {
    if (!ST) return false;
    if (p === '/api/push/key' && req.method === 'GET') { send(res, 200, { key: PUB }); return true; }
    if (p === '/api/push/pull' && req.method === 'POST') {
      if (limited && limited('pushpull:' + (req.socket && req.socket.remoteAddress || ''), 120, 3600e3)) { send(res, 429, { error: 'rate' }); return true; }
      const b = await body(req, 4000), s = ST.subs[hash(b && b.endpoint)];
      const items = s ? (s.pending || []) : []; if (s && items.length) { s.pending = []; await persist(); }
      send(res, 200, { items }); return true;
    }
    if (!u) { send(res, 401, { error: 'login' }); return true; }
    if (p === '/api/push/status' && req.method === 'GET') { send(res, 200, { devices: Object.values(ST.subs).filter(s => s.userId === u.id).length }); return true; }
    if (p === '/api/push/subscribe' && req.method === 'POST') {
      const b = await body(req, 6000), sub = b && b.subscription, ep = sub && String(sub.endpoint || '');
      if (!ep || !/^https:\/\//.test(ep) || ep.length > 1000) { send(res, 400, { error: 'subscription' }); return true; }
      const mine = Object.entries(ST.subs).filter(([, s]) => s.userId === u.id).sort((a, c) => a[1].at - c[1].at);
      while (mine.length >= 10) delete ST.subs[mine.shift()[0]];
      ST.subs[hash(ep)] = { endpoint: ep, userId: u.id, at: now(), ua: clip(req.headers['user-agent'], 120), pending: [] };
      await persist(); send(res, 200, { ok: true }); return true;
    }
    if (p === '/api/push/unsubscribe' && req.method === 'POST') {
      const b = await body(req, 4000), k = hash(b && b.endpoint), s = ST.subs[k];
      if (s && s.userId === u.id) { delete ST.subs[k]; await persist(); }
      send(res, 200, { ok: true }); return true;
    }
    if (p === '/api/push/test' && req.method === 'POST') {
      if (limited && limited('pushtest:' + u.id, 10, 3600e3)) { send(res, 429, { error: 'rate' }); return true; }
      await notify(u.id, 'American Ditek Institute', 'Test alert: notifications reach this device even when the portal is closed.');
      send(res, 200, { ok: true }); return true;
    }
    return false;
  }

  return { init, handle, notify, vapid, key: () => PUB };
};
