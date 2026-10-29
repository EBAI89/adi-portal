'use strict';
/* ADI document archive.
 * Every PDF the portal builds for someone (a transcript, a receipt, a rejection letter, a payment notice, a form) is kept here, so that the person can
 * open it again from "My downloads" on any device, and so that the super administrator can find, open and download the documents of every student and applicant.
 * Files live in the portal's blob store (the database on Render); the index is the collection `docfiles`, which is not sent to browsers by the sync.
 * Rules: a person sees only his or her own files; the super administrator sees all; staff may file a letter for an applicant (rejection letter, payment notice). */
const crypto = require('crypto');

const CATS = ['transcript', 'results', 'receipt', 'rejection', 'payment', 'admission', 'form', 'letter', 'other'];
const plain = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, n || 120);
const MAX = 6 * 1024 * 1024, PER_USER = 400;


/* A small self-contained PDF writer (A4, Helvetica) so that letters can be produced on the server, without a browser. */
function miniPdf(o) {
  const enc = t => Buffer.from(String(t == null ? '' : t).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/[^ -ÿ\n]/g, '?'), 'latin1');
  const esc = b => b.toString('latin1').replace(/([\\()])/g, '\\$1');
  const W = 595, H = 842, M = 56, pages = [[]]; let y = H - 150;
  const wrap = (t, size, width) => { const out = []; String(t).split('\n').forEach(par => { let line = ''; par.split(/\s+/).forEach(w => { const c = line ? line + ' ' + w : w; if (c.length * size * 0.5 > width && line) { out.push(line); line = w; } else line = c; }); out.push(line); }); return out; };
  const put = (txt, size, bold, x, col) => { pages[pages.length - 1].push({ t: txt, size, bold, x: x == null ? M : x, y, col: col || '0 0 0' }); };
  const nl = (n) => { y -= n; if (y < 90) { pages.push([]); y = H - 90; } };
  const para = (t, size, bold, col) => { wrap(t, size, W - 2 * M).forEach(l => { put(l, size, bold, M, col); nl(size * 1.5); }); };
  put('AMERICAN DITEK INSTITUTE (ADI)', 15, true, M, '0.04 0.15 0.35'); nl(16);
  put('Yaounde, Cameroon  -  www.adiuniversity.com  -  Authorised by the Ministry of Higher Education (MINESUP)', 8, false, M, '0.35 0.35 0.35'); nl(26);
  put(o.title, 13, true, M, '0.7 0.07 0.12'); nl(20);
  (o.meta || []).forEach(m => { put(m, 9, false, M, '0.3 0.3 0.3'); nl(13); }); nl(10);
  (o.sections || []).forEach(sec => { para(sec.h, 10.5, true, '0.04 0.15 0.35'); para(sec.t, 10.5, false); nl(8); });
  nl(10); para(o.footer || 'Registrar\'s Office, American Ditek Institute. Issued electronically; no signature is required.', 9, false, '0.35 0.35 0.35');
  const objs = []; const add = b => { objs.push(b); return objs.length; };
  add(Buffer.from('<< /Type /Catalog /Pages 2 0 R >>')); add(null);
  const fR = add(Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')), fB = add(Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'));
  const kids = [];
  pages.forEach((pg, i) => {
    const ops = ['0.04 0.15 0.35 rg 0 ' + (H - 8) + ' ' + W + ' 8 re f', '0.7 0.07 0.12 rg 0 ' + (H - 11) + ' ' + W + ' 2 re f'];
    pg.forEach(it => ops.push('BT ' + it.col + ' rg /' + (it.bold ? 'F2' : 'F1') + ' ' + it.size + ' Tf ' + it.x + ' ' + it.y.toFixed(1) + ' Td (' + esc(enc(it.t)) + ') Tj ET'));
    ops.push('BT 0.4 0.4 0.4 rg /F1 8 Tf ' + M + ' 40 Td (' + esc(enc((o.ref || '') + '   Page ' + (i + 1) + ' of ' + pages.length)) + ') Tj ET');
    const c = Buffer.from(ops.join('\n'), 'latin1'), cid = add(Buffer.concat([Buffer.from('<< /Length ' + c.length + ' >>\nstream\n'), c, Buffer.from('\nendstream')]));
    kids.push(add(Buffer.from('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /Font << /F1 ' + fR + ' 0 R /F2 ' + fB + ' 0 R >> >> /Contents ' + cid + ' 0 R >>')));
  });
  objs[1] = Buffer.from('<< /Type /Pages /Kids [' + kids.map(k => k + ' 0 R').join(' ') + '] /Count ' + kids.length + ' >>');
  const parts = [Buffer.from('%PDF-1.4\n')], offs = []; let len = parts[0].length;
  objs.forEach((b, i) => { offs.push(len); const x = Buffer.concat([Buffer.from((i + 1) + ' 0 obj\n'), b, Buffer.from('\nendobj\n')]); parts.push(x); len += x.length; });
  let xr = 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n'; offs.forEach(f => { xr += String(f).padStart(10, '0') + ' 00000 n \n'; });
  parts.push(Buffer.from(xr + 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + len + '\n%%EOF\n'));
  return Buffer.concat(parts);
}

module.exports = function makeFiles(ctx) {
  const { S, now, limited, send, body, audit } = ctx, MS = ctx.ms || null;
  const COL = 'docfiles';
  const isStaff = u => u && !['student', 'applicant'].includes(u.role);
  const meta = r => ({ id: r.id, name: r.name, cat: r.cat, title: r.title, ref: r.ref, serial: r.serial, matric: r.matric, ownerId: r.ownerId, ownerName: r.ownerName, gate: r.gate || '', by: r.byName, at: r.at, last: r.last, size: r.size, pages: r.pages });

  async function save(u, b) {
    if (!u || u.status !== 'active') return { code: 401, out: { error: 'sign in' } };
    if (limited('filesave:' + u.id, 200, 3600e3)) return { code: 429, out: { error: 'Too many files' } };
    const buf = Buffer.from(String(b.b64 || ''), 'base64');
    if (buf.length < 200 || buf.length > MAX) return { code: 413, out: { error: 'File size not accepted' } };
    if (buf.slice(0, 5).toString('latin1') !== '%PDF-') return { code: 400, out: { error: 'Only PDF files are archived' } };
    let owner = u;
    if (b.ownerId && b.ownerId !== u.id) {
      const o = S.get('users', String(b.ownerId));
      if (!o) return { code: 404, out: { error: 'Unknown recipient' } };
      if (!isStaff(u)) return { code: 403, out: { error: 'forbidden' } };
      owner = o;
    }
    const cat = CATS.includes(b.cat) ? b.cat : 'other';
    if (cat === 'transcript' && u.role !== 'super_admin') return { code: 403, out: { error: 'The transcript is filed by the super administrator only.' } };
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    const mine = Object.values(S.all(COL)).filter(r => r.ownerId === owner.id && !r.gate);
    let rec = mine.find(r => r.hash === hash);
    if (rec) { rec.last = now(); await S.put(COL, rec.id, rec); return { code: 200, out: { id: rec.id, again: true } }; }
    if (mine.length >= PER_USER) { const old = mine.sort((a, b2) => a.at - b2.at)[0]; try { await S.delBlob('docf_' + old.id); await S.del(COL, old.id); } catch (e) {} }
    const id = 'f' + now().toString(36) + crypto.randomBytes(4).toString('hex');
    rec = { id, hash, name: plain(b.name, 120).replace(/[\\/:*?"<>|]+/g, '_') || 'ADI-document.pdf', cat, title: plain(b.title, 140), ref: plain(b.ref, 60), serial: plain(b.serial, 40), matric: plain(b.matric, 24).toUpperCase(), ownerId: owner.id, ownerName: owner.name || owner.email || '', byId: u.id, byName: u.name || u.email || '', at: now(), last: now(), size: buf.length, pages: Math.min(500, Number(b.pages) || 0) };
    await S.putBlob('docf_' + id, buf); await S.put(COL, id, rec);
    return { code: 200, out: { id } };
  }


  /* The ministry's scanned transcript: stored exactly as received (the bytes are never changed) and tied to the student's record, not to one login. */
  async function ministry(u, b) {
    if (!u || u.status !== 'active' || u.role !== 'super_admin') return { code: 403, out: { error: 'Only the super administrator files the ministry transcript.' } };
    const st = MS && MS.student(String(b.matric || '').trim()); if (!st) return { code: 404, out: { error: 'Unknown student record.' } };
    const buf = Buffer.from(String(b.b64 || ''), 'base64');
    if (buf.length < 200 || buf.length > MAX) return { code: 413, out: { error: 'File size not accepted' } };
    if (buf.slice(0, 5).toString('latin1') !== '%PDF-') return { code: 400, out: { error: 'Only PDF files are accepted' } };
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    let rec = Object.values(S.all(COL)).find(r => r.gate === 'ministry' && r.matric === st.matric && r.hash === hash);
    if (rec) return { code: 200, out: { id: rec.id, again: true, sha256: hash, size: buf.length, name: st.name } };
    const id = 'f' + now().toString(36) + crypto.randomBytes(4).toString('hex');
    rec = { id, hash, name: plain(b.name, 120).replace(/[\\/:*?"<>|]+/g, '_') || 'MINESUP-transcript.pdf', cat: 'transcript', gate: 'ministry', title: plain(b.title, 140) || ('MINESUP transcript — ' + st.name), ref: '', serial: plain(st.msNo, 24), matric: st.matric, ownerId: '', ownerName: st.name || '', byId: u.id, byName: u.name || u.email || '', at: now(), last: now(), size: buf.length, pages: Math.min(500, Number(b.pages) || 0) };
    await S.putBlob('docf_' + id, buf); await S.put(COL, id, rec);
    try { await audit(u, 'ministry transcript filed ' + st.matric + ' ' + hash.slice(0, 12)); } catch (e) {}
    try { await MS.notifyLinked(st.matric, 'Your MINESUP transcript is available', 'Your scanned MINESUP transcript has been uploaded. Complete the service fee and your tuition balance, then open MINESUP > Transcript to download it.'); } catch (e) {}
    return { code: 200, out: { id, sha256: hash, size: buf.length, name: st.name } };
  }
  const forMatric = matric => Object.values(S.all(COL)).filter(r => r.gate === 'ministry' && r.matric === matric).sort((a, b) => b.at - a.at).map(r => ({ id: r.id, name: r.name, title: r.title, at: r.at, size: r.size }));
  const sees = (u, r) => !!u && (r.ownerId === u.id || u.role === 'super_admin' || (r.gate === 'ministry' && MS && MS.match(u, r.matric)));

  /* A letter built by the portal itself (rejection letter, payment notice): filed for the person, and returned so that it can be e-mailed. */
  async function letter(o) {
    const buf = miniPdf(o), owner = o.owner, id = 'f' + now().toString(36) + crypto.randomBytes(4).toString('hex');
    const rec = { id, hash: crypto.createHash('sha256').update(buf).digest('hex'), name: plain(o.name, 120).replace(/[\\/:*?"<>|]+/g, '_'), cat: CATS.includes(o.cat) ? o.cat : 'letter', title: plain(o.title, 140), ref: plain(o.ref, 60), serial: '', matric: plain(o.matric, 24).toUpperCase(), ownerId: owner.id, ownerName: owner.name || owner.email || '', byId: o.by ? o.by.id : '', byName: o.by ? (o.by.name || '') : 'ADI portal', at: now(), last: now(), size: buf.length, pages: 1 };
    await S.putBlob('docf_' + id, buf); await S.put(COL, id, rec);
    return { id, buf, name: rec.name };
  }

  function list(u, q) {
    if (!u || u.status !== 'active') return { code: 401, out: { error: 'sign in' } };
    const cat = q.get('cat') || '', s = String(q.get('q') || '').toLowerCase().trim(), all = u.role === 'super_admin' && q.get('all') === '1';
    let rows = Object.values(S.all(COL)).filter(r => all || sees(u, r));
    if (cat && CATS.includes(cat)) rows = rows.filter(r => r.cat === cat);
    if (s) rows = rows.filter(r => (r.name + ' ' + r.title + ' ' + r.ref + ' ' + r.serial + ' ' + r.matric + ' ' + r.ownerName).toLowerCase().includes(s));
    const counts = {}; Object.values(S.all(COL)).filter(r => all || sees(u, r)).forEach(r => { counts[r.cat] = (counts[r.cat] || 0) + 1; });
    rows.sort((a, b) => b.at - a.at);
    return { code: 200, out: { files: rows.slice(0, 400).map(r => { const m = meta(r); if (r.gate === 'ministry' && u.role !== 'super_admin' && MS) { const g = MS.gate(u, r.matric); m.locked = !g.ok; } return m; }), total: rows.length, counts } };
  }

  async function handle(req, res, u, url, p) {
    if (p === '/api/files/save' && req.method === 'POST') { const r = await save(u, await body(req, 9 * 1024 * 1024)); send(res, r.code, r.out); return true; }
    if (p === '/api/files/ministry' && req.method === 'POST') { const r = await ministry(u, await body(req, 9 * 1024 * 1024)); send(res, r.code, r.out); return true; }
    if (p === '/api/files' && req.method === 'GET') { const r = list(u, url.searchParams); send(res, r.code, r.out); return true; }
    const m = /^\/api\/files\/(f[0-9a-z]+)(\/delete)?$/.exec(p);
    if (m) {
      const rec = S.get(COL, m[1]);
      if (!rec) return false;          // not an archived PDF: ids of attachments (payment screenshots) are handled by the attachment routes
      if (!u || u.status !== 'active') { send(res, 401, { error: 'sign in' }); return true; }
      if (!sees(u, rec)) { send(res, 404, { error: 'Not found' }); return true; }
      if (rec.gate === 'ministry' && u.role !== 'super_admin') {
        if (m[2]) { send(res, 403, { error: 'forbidden' }); return true; }
        const g = MS ? MS.gate(u, rec.matric) : { ok: false };
        if (!g.ok) { send(res, 402, { error: 'locked', reason: !g.service ? 'service' : !g.linked ? 'link' : (g.balance > 0 || !g.tuition) ? 'tuition' : 'fees', balance: g.balance || 0, awaiting: g.awaiting || 0 }); return true; }
      }
      if (m[2] && req.method === 'POST') { await S.delBlob('docf_' + rec.id); await S.del(COL, rec.id); try { await audit(u, 'archived file removed ' + rec.name); } catch (e) {} send(res, 200, { ok: true }); return true; }
      if (req.method !== 'GET') { send(res, 405, { error: 'method' }); return true; }
      const buf = await S.getBlob('docf_' + rec.id);
      if (!buf) { send(res, 404, { error: 'File missing' }); return true; }
      if (rec.gate === 'ministry' && u.role !== 'super_admin' && MS && MS.notifySuper && !(rec.lastNote && rec.lastNote[u.id] > now() - 600e3)) { rec.lastNote = Object.assign({}, rec.lastNote, { [u.id]: now() }); try { await S.put(COL, rec.id, rec); } catch (e) {} MS.notifySuper(u, rec); }
      if (rec.ownerId !== u.id && u.role === 'super_admin') { try { await audit(u, 'archived file opened ' + rec.name + ' (' + rec.ownerName + ')'); } catch (e) {} }
      const dl = url.searchParams.get('dl') === '1', safe = rec.name.replace(/[^\w.\-]+/g, '_');
      res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Length': buf.length, 'Content-Disposition': (dl ? 'attachment' : 'inline') + '; filename="' + safe + '"', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
      res.end(buf); return true;
    }
    return false;
  }
  return { handle, letter, forMatric };
};
