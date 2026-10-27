'use strict';
/* ADI document authenticity register.
 * Every official PDF the portal produces is entered here with a serial number and a verification code (HMAC of the serial and of the digest of the
 * printed text, keyed with the server secret). The QR code printed on the document opens /verify/<serial>?c=<code>, a public page that confirms the
 * document and — for transcripts and statements of results — shows the results held on file so the reader can compare them with the paper.
 * The client never supplies results: the server reads them from its own records, so a forged claim cannot be registered. */
const crypto = require('crypto');

const TYPES = {
  TR: ['Academic transcript', 'Relevé de notes'], SR: ['Statement of results', 'Relevé semestriel'], RC: ['Payment receipt', 'Reçu de paiement'],
  AL: ['Letter of admission', "Lettre d'admission"], FB: ["Student's Form B", "Fiche B de l'étudiant"], AP: ['Application document', 'Dossier de candidature'], GN: ['Official document', 'Document officiel']
};
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plain = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, n || 120);

module.exports = function makeDocReg(ctx) {
  const { S, now, limited, send, body, ip, audit, SECRET, core } = ctx;
  const COL = 'docreg';
  const codeOf = (serial, digest) => { const h = crypto.createHmac('sha256', SECRET).update('docreg|' + serial + '|' + digest).digest('hex').toUpperCase(); return h.slice(0, 5) + '-' + h.slice(5, 10); };
  const same = (a, b) => { a = Buffer.from(String(a)); b = Buffer.from(String(b)); return a.length === b.length && crypto.timingSafeEqual(a, b); };
  let maxN = 0, scanned = false;
  const nextN = () => { if (!scanned) { scanned = true; Object.keys(S.all(COL)).forEach(k => { const n = Number(String(k).split('-').pop()) || 0; if (n > maxN) maxN = n; }); } return ++maxN; };
  const isStaff = u => u && !['student', 'applicant'].includes(u.role);

  // ---- issue: called by the browser when it builds a PDF
  async function issue(u, b) {
    if (!u || u.status !== 'active') return { code: 401, out: { error: 'sign in' } };
    if (limited('docissue:' + u.id, 150, 3600e3)) return { code: 429, out: { error: 'Too many documents' } };
    const type = TYPES[b.type] ? b.type : 'GN', digest = String(b.digest || '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(digest)) return { code: 400, out: { error: 'bad digest' } };
    const matric = plain(b.matric, 24).toUpperCase(), st = matric ? S.get('students', matric) : null;
    if (type === 'TR' && !(u.role === 'super_admin' && st)) return { code: 403, out: { error: 'The transcript is issued by the super administrator only.' } };
    if (st && !isStaff(u) && st.userId !== u.id && u.matric !== st.matric) return { code: 403, out: { error: 'forbidden' } };
    const key = crypto.createHash('sha256').update([type, matric, plain(b.ay, 12), plain(b.sem, 4), digest].join('|')).digest('hex').slice(0, 24);
    let rec = Object.values(S.all(COL)).find(r => r.key === key);
    if (!rec) {
      const serial = 'ADI-' + type + '-' + new Date().getUTCFullYear() + '-' + String(nextN()).padStart(6, '0');
      rec = { id: serial, key, type, title: plain(b.title, 120), matric: st ? st.matric : '', name: st ? st.name : '', ay: plain(b.ay, 12), sem: plain(b.sem, 4), pages: Math.min(500, Number(b.pages) || 0), digest, at: now(), by: u.id, role: u.role, n: 0 };
      if (b.subject) rec.subject = plain(b.subject, 100);
    }
    rec.n = (rec.n || 0) + 1; rec.last = now(); await S.put(COL, rec.id, rec);
    if (type === 'TR') { try { await audit(u, 'transcript issued ' + rec.id + ' ' + rec.matric); } catch (e) {} }
    return { code: 200, out: { serial: rec.id, code: codeOf(rec.id, rec.digest), at: rec.at } };
  }

  // ---- what the portal itself holds for the student (never taken from the client)
  function records(st, ay, sem) {
    const enr = Object.values(S.all('enroll')).filter(e => e.matric === st.matric && (!ay || e.ay === ay) && (!sem || String(e.sem) === String(sem)));
    const rows = [];
    enr.forEach(e => {
      const c = S.get('courses', e.courseId), r = S.get('results', e.matric + '_' + e.courseId + '_' + String(e.ay).replace('/', '-'));
      if (c && r && r.state === 'published') rows.push({ ay: e.ay, sem: Number(e.sem) || 0, code: c.code, title: c.title, cv: Number(c.credits) || 0, total: r.total, grade: r.grade, gp: Number(r.gp) || 0, resit: !!r.resitUsed });
    });
    rows.sort((a, b) => String(a.ay).localeCompare(String(b.ay)) || a.sem - b.sem || String(a.code).localeCompare(String(b.code)));
    return rows;
  }
  const fmtD = t => new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Africa/Douala' });

  const CSS = `*{box-sizing:border-box}body{margin:0;background:#eef1f8;color:#16213e;font:15px/1.5 Georgia,'Times New Roman',serif}
.top{background:#0b2559;color:#fff;padding:18px 20px;border-bottom:4px solid #c9a227}.top h1{margin:0;font-size:19px;letter-spacing:.4px}.top p{margin:2px 0 0;font-size:12.5px;opacity:.85;font-style:italic}
.wrap{max-width:860px;margin:18px auto;padding:0 14px}.card{background:#fff;border:1px solid #d5dbea;border-top:3px solid #c9a227;border-radius:4px;padding:18px 20px;margin-bottom:14px}
.ok{border-left:6px solid #136f3f}.bad{border-left:6px solid #b3261e}.st{font-weight:bold;font-size:18px;margin:0 0 4px}.ok .st{color:#136f3f}.bad .st{color:#b3261e}
dl{display:grid;grid-template-columns:minmax(130px,200px) 1fr;gap:6px 14px;margin:10px 0 0}dt{color:#55607f;font-size:13px}dd{margin:0;font-weight:bold}
table{border-collapse:collapse;width:100%;font-size:13px;margin-top:8px}th{background:#0b2559;color:#fff;text-align:left;padding:5px 7px;font-weight:600}td{padding:4px 7px;border-bottom:1px solid #e3e7f2}tr:nth-child(even) td{background:#f6f8fc}
td.n,th.n{text-align:right}h2{font-size:14px;color:#0b2559;margin:16px 0 0;border-bottom:1px solid #c9a227;padding-bottom:2px}.note{font-size:12.5px;color:#55607f}
form{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}input{flex:1 1 200px;padding:9px 10px;border:1px solid #aab4cf;border-radius:3px;font:inherit}button{padding:9px 18px;background:#0b2559;color:#fff;border:0;border-radius:3px;font:inherit;cursor:pointer}
@media(max-width:560px){dl{grid-template-columns:1fr}dt{margin-top:6px}}`;
  const shell = (inner) => '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>ADI University — Document verification</title><style>' + CSS + '</style></head><body><div class="top"><h1>AMERICAN DITEK INSTITUTE (ADI UNIVERSITY)</h1><p>Document verification · Vérification de document</p></div><div class="wrap">' + inner + '<p class="note">This service confirms documents issued by ADI University. Compare every figure on the paper with this page. · Ce service confirme les documents délivrés par ADI University. Comparez chaque donnée du papier avec cette page.</p></div></body></html>';
  const form = (s, c) => '<div class="card"><form method="get" action="/verify"><input name="s" placeholder="Serial / Numéro : ADI-TR-2026-000001" value="' + esc(s) + '" required><input name="c" placeholder="Code : XXXXX-XXXXX" value="' + esc(c) + '" required><button>Verify · Vérifier</button></form></div>';

  function page(s, c) {
    s = plain(s, 40).toUpperCase(); c = plain(c, 20).toUpperCase();
    if (!s) return shell('<div class="card"><p class="st" style="color:#0b2559">Verify a document · Vérifier un document</p><p>Enter the serial number and the verification code printed on the document, or scan its QR code. · Saisissez le numéro de série et le code de vérification imprimés sur le document, ou scannez son code QR.</p></div>' + form('', ''));
    const rec = S.get(COL, s);
    if (!rec || !c || !same(codeOf(rec.id, rec.digest), c)) return shell('<div class="card bad"><p class="st">NOT VERIFIED · NON VÉRIFIÉ</p><p>No document matches this serial number and code. Treat the document as <b>not authentic</b> and contact the University. · Aucun document ne correspond à ce numéro et à ce code. Considérez le document comme <b>non authentique</b> et contactez l’Université.</p></div>' + form(s, c));
    const T = TYPES[rec.type] || TYPES.GN, st = rec.matric ? S.get('students', rec.matric) : null;
    let h = '<div class="card ok"><p class="st">AUTHENTIC · AUTHENTIQUE</p><p>This document was issued by ADI University and is registered in its official register. · Ce document a été délivré par ADI University et figure dans son registre officiel.</p><dl>' +
      '<dt>Document</dt><dd>' + esc(T[0]) + ' / ' + esc(T[1]) + '</dd><dt>Serial · Numéro</dt><dd>' + esc(rec.id) + '</dd><dt>Issued · Délivré le</dt><dd>' + esc(fmtD(rec.at)) + '</dd>' +
      (rec.pages ? '<dt>Pages</dt><dd>' + rec.pages + '</dd>' : '') + (rec.ay ? '<dt>Session</dt><dd>' + esc(rec.ay) + (rec.sem ? ' · S' + esc(rec.sem) : '') + '</dd>' : '') +
      (st ? '<dt>Student · Étudiant</dt><dd>' + esc(st.name) + '</dd><dt>Matricule</dt><dd>' + esc(st.matric) + '</dd>' : (rec.subject ? '<dt>Subject · Objet</dt><dd>' + esc(rec.subject) + '</dd>' : '')) + '</dl></div>';
    if (st && (rec.type === 'TR' || rec.type === 'SR')) {
      const sp = (core && core.SPEC && core.SPEC[st.specId]) || {}, grp = (core && core.GRP && core.GRP[st.gid || sp.gid]) || {};
      h = h.replace('</dl></div>', '<dt>Programme</dt><dd>' + esc(sp.name || st.specId || '—') + (st.level ? ' (' + esc(st.level) + ')' : '') + '</dd>' + (grp.en ? '<dt>School · Faculté</dt><dd>' + esc(grp.en) + '</dd>' : '') + '</dl></div>');
      const rows = records(st, rec.type === 'SR' ? rec.ay : '', rec.type === 'SR' ? rec.sem : ''); let cr = 0, wp = 0, earn = 0, cur = '';
      let t = '<div class="card"><h2 style="margin-top:0">Results on file at ADI University · Résultats détenus par ADI University</h2><table><tr><th>Code</th><th>Course · Cours</th><th class="n">CV</th><th class="n">Mark</th><th>Grade</th><th class="n">GP</th></tr>';
      rows.forEach(r => { const k = r.ay + ' · S' + r.sem; if (k !== cur) { cur = k; t += '<tr><td colspan="6" style="background:#e9eef8;font-weight:bold">' + esc(k) + '</td></tr>'; } cr += r.cv; wp += r.gp * r.cv; if (r.grade !== 'F') earn += r.cv; t += '<tr><td>' + esc(r.code) + '</td><td>' + esc(r.title) + '</td><td class="n">' + r.cv + '</td><td class="n">' + esc(r.total) + (r.resit ? ' #' : '') + '</td><td>' + esc(r.grade) + '</td><td class="n">' + r.gp.toFixed(1) + '</td></tr>'; });
      t += '</table>' + (rows.length ? '<dl><dt>Credits attempted · tentés</dt><dd>' + cr + '</dd><dt>Credits earned · acquis</dt><dd>' + earn + '</dd><dt>' + (rec.type === 'SR' ? 'GPA' : 'CGPA') + '</dt><dd>' + (cr ? (wp / cr).toFixed(2) : '—') + '</dd></dl><p class="note"># = resit mark retained. The figures above are the results published today; a document issued earlier shows the results published at its date. · # = note de rattrapage retenue. Les chiffres ci-dessus sont les résultats publiés aujourd’hui ; un document délivré plus tôt présente les résultats publiés à sa date.</p>' : '<p>No published results.</p>') + '</div>';
      h += t;
    }
    return shell(h + form('', ''));
  }

  // structured result for the portal's own verification page
  function detail(s, c) {
    s = plain(s, 40).toUpperCase(); c = plain(c, 20).toUpperCase();
    const rec = S.get(COL, s); if (!rec || !c || !same(codeOf(rec.id, rec.digest), c)) return { valid: false };
    const T = TYPES[rec.type] || TYPES.GN, st = rec.matric ? S.get('students', rec.matric) : null;
    const out = { valid: true, serial: rec.id, type: rec.type, typeEn: T[0], typeFr: T[1], issued: rec.at, pages: rec.pages || 0, ay: rec.ay || '', sem: rec.sem || '', subject: rec.subject || '' };
    if (st) {
      const sp = (core && core.SPEC && core.SPEC[st.specId]) || {}, grp = (core && core.GRP && core.GRP[st.gid || sp.gid]) || {};
      out.student = { name: st.name, matric: st.matric, programme: sp.name || st.specId || '', level: st.level || '', school: grp.en || '' };
      if (rec.type === 'TR' || rec.type === 'SR') {
        const rows = records(st, rec.type === 'SR' ? rec.ay : '', rec.type === 'SR' ? rec.sem : ''); let cr = 0, wp = 0, earn = 0;
        rows.forEach(r => { cr += r.cv; wp += r.gp * r.cv; if (r.grade !== 'F') earn += r.cv; });
        out.results = rows; out.totals = { attempted: cr, earned: earn, gpa: cr ? Math.round(wp / cr * 100) / 100 : null };
      }
    }
    return out;
  }

  async function handle(req, res, u, url, p) {
    if (p === '/api/docs/issue' && req.method === 'POST') { const r = await issue(u, await body(req, 4000)); send(res, r.code, r.out); return true; }
    if (p === '/verify' || p.startsWith('/verify/') || p === '/api/verify') {
      if (limited('verify:' + ip(req), 80, 3600e3)) { res.writeHead(429, { 'Content-Type': 'text/plain' }); res.end('Too many requests'); return true; }
      const q = url.searchParams, s = p.startsWith('/verify/') ? decodeURIComponent(p.slice(8)) : (q.get('s') || ''), c = q.get('c') || '';
      if (p === '/api/verify') { send(res, 200, detail(s, c)); return true; }
      if (p !== '/verify' && !q.get('plain') && s) { res.writeHead(302, { Location: '/#/verify/' + encodeURIComponent(s) + '?c=' + encodeURIComponent(c), 'Cache-Control': 'no-store' }); res.end(); return true; }   // the portal page does the checking
      const html = page(s, c);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'" });
      res.end(html); return true;
    }
    return false;
  }
  return { handle, issue, page, codeOf };
};
