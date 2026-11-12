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

  /* ---- special-case transcripts: a record composed by the super administrator (holder particulars, courses and marks) for a person whose results are not,
   * or not fully, held in the portal. Kept in its own collection, never sent to any other user. Grades and grade points are always computed here from the mark. */
  const SP = 'sptr', GR = [[80, 'A', 4], [70, 'B+', 3.5], [60, 'B', 3], [55, 'C+', 2.5], [50, 'C', 2], [45, 'D+', 1.5], [40, 'D', 1], [0, 'F', 0]];
  const gradeOf = m => { const g = GR.find(x => m >= x[0]) || GR[GR.length - 1]; return { grade: g[1], gp: g[2] }; };
  const isSuper = u => !!u && u.status === 'active' && u.role === 'super_admin';
  function cleanSp(b) {
    const err = m => ({ err: m });
    const o = { name: plain(b.name, 90), matric: plain(b.matric, 24).toUpperCase(), dob: /^\d{4}-\d{2}-\d{2}$/.test(String(b.dob || '')) ? String(b.dob) : '', pob: plain(b.pob, 60), sex: /^[MF]$/.test(String(b.sex || '')) ? String(b.sex) : '',
      entryYear: /^\d{4}$/.test(String(b.entryYear || '')) ? String(b.entryYear) : '', level: plain(b.level, 8).toUpperCase(), programme: plain(b.programme, 90), field: plain(b.field, 90), specialty: plain(b.specialty, 110), basis: plain(b.basis, 400), from: plain(b.from, 24).toUpperCase(), terms: [] };
    if (o.name.length < 3) return err('Enter the holder\'s full name.');
    if (o.matric.length < 3) return err('Enter the registration number (matricule).');
    if (!o.programme) return err('Enter the programme of study.');
    if (o.basis.length < 10) return err('State the basis for this special case (at least ten characters).');
    const seen = new Set();
    for (const t of (Array.isArray(b.terms) ? b.terms : []).slice(0, 16)) {
      const ay = plain(t && t.ay, 9), sem = Number(t && t.sem) === 2 ? 2 : 1;
      if (!/^\d{4}\/\d{4}$/.test(ay)) return err('Each semester needs an academic year written as 2024/2025.');
      if (seen.has(ay + sem)) return err('Semester ' + sem + ' of ' + ay + ' appears twice.'); seen.add(ay + sem);
      const rows = [];
      for (const r of (Array.isArray(t.rows) ? t.rows : []).slice(0, 24)) {
        const code = plain(r && r.code, 14).toUpperCase(), title = plain(r && r.title, 120); if (!code && !title && (r.mark === '' || r.mark == null)) continue;
        const cv = Number(r.cv), mark = Math.round(Number(r.mark) * 100) / 100;
        if (!title) return err('A course in ' + ay + ' semester ' + sem + ' has no title.');
        if (!(cv > 0 && cv <= 30)) return err('The credit value of "' + title + '" must be between 1 and 30.');
        if (r.mark === '' || r.mark == null || !(mark >= 0 && mark <= 100)) return err('The mark of "' + title + '" must be between 0 and 100.');
        rows.push(Object.assign({ code, title, cv, mark }, gradeOf(mark)));
      }
      if (rows.length) o.terms.push({ ay, sem, rows });
    }
    if (!o.terms.length) return err('Enter at least one course with its mark.');
    o.terms.sort((a, b2) => a.ay.localeCompare(b2.ay) || a.sem - b2.sem);
    return { rec: o };
  }
  const spRows = sp => { const out = []; (sp.terms || []).forEach(t => (t.rows || []).forEach(r => out.push({ ay: t.ay, sem: t.sem, code: r.code, title: r.title, cv: r.cv, total: r.mark, grade: r.grade, gp: r.gp, resit: false }))); return out; };
  async function spSave(u, b) {
    if (!isSuper(u)) return { code: 403, out: { error: 'Special-case transcripts are composed by the super administrator only.' } };
    if (limited('sptr:' + u.id, 200, 3600e3)) return { code: 429, out: { error: 'Too many changes' } };
    const c = cleanSp(b || {}); if (c.err) return { code: 400, out: { error: c.err } };
    const id = /^sp[a-z0-9]{6,24}$/.test(String(b.id || '')) ? String(b.id) : '', old = id ? S.get(SP, id) : null;
    if (id && !old) return { code: 404, out: { error: 'Unknown record' } };
    const rec = Object.assign(c.rec, { id: old ? old.id : 'sp' + now().toString(36) + crypto.randomBytes(3).toString('hex'), at: old ? old.at : now(), by: old ? old.by : (u.name || u.email || ''), updatedAt: now(), updatedBy: u.name || u.email || '', gen: old ? old.gen || null : null });
    await S.put(SP, rec.id, rec);
    try { await audit(u, 'special transcript record ' + (old ? 'amended ' : 'created ') + rec.id + ' ' + rec.matric + ' ' + rec.name); } catch (e) {}
    return { code: 200, out: { rec } };
  }

  // ---- issue: called by the browser when it builds a PDF
  async function issue(u, b) {
    if (!u || u.status !== 'active') return { code: 401, out: { error: 'sign in' } };
    if (limited('docissue:' + u.id, 150, 3600e3)) return { code: 429, out: { error: 'Too many documents' } };
    const type = TYPES[b.type] ? b.type : 'GN', digest = String(b.digest || '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(digest)) return { code: 400, out: { error: 'bad digest' } };
    const spx = b.special ? S.get(SP, plain(b.special, 40)) : null;
    if (b.special && !(spx && isSuper(u) && type === 'TR')) return { code: 403, out: { error: 'Special-case transcripts are issued by the super administrator only.' } };
    const matric = spx ? spx.matric : plain(b.matric, 24).toUpperCase(), st = spx ? null : (matric ? S.get('students', matric) : null);
    if (type === 'TR' && !spx && !(st && (ctx.canTranscript ? ctx.canTranscript(u, st.matric) : u.role === 'super_admin'))) return { code: 403, out: { error: 'The transcript is issued by the super administrator, or by an authorised officer for a student whose application is on file.' } };
    if (st && !isStaff(u) && st.userId !== u.id && u.matric !== st.matric) return { code: 403, out: { error: 'forbidden' } };
    let pay = null;
    if (type === 'RC' && b.pay) {
      pay = S.get('payments', plain(b.pay, 60));
      if (pay && !isStaff(u) && pay.userId !== u.id && !(pay.matric && u.matric === pay.matric)) return { code: 403, out: { error: 'forbidden' } };
    }
    const key = crypto.createHash('sha256').update([type, matric, plain(b.ay, 12), plain(b.sem, 4), digest, spx ? 'sp:' + spx.id + ':' + spx.updatedAt : ''].join('|')).digest('hex').slice(0, 24);
    let rec = Object.values(S.all(COL)).find(r => r.key === key);
    if (!rec) {
      const serial = 'ADI-' + type + '-' + new Date().getUTCFullYear() + '-' + String(nextN()).padStart(6, '0');
      rec = { id: serial, key, type, title: plain(b.title, 120), matric: st ? st.matric : '', name: st ? st.name : '', ay: plain(b.ay, 12), sem: plain(b.sem, 4), pages: Math.min(500, Number(b.pages) || 0), digest, at: now(), by: u.id, role: u.role, n: 0 };
      if (b.subject) rec.subject = plain(b.subject, 100);
      // a special-case transcript carries its own record, frozen at the moment of issue: the verification page shows exactly what was printed
      if (spx) { rec.matric = spx.matric; rec.name = spx.name; rec.sp = { id: spx.id, name: spx.name, matric: spx.matric, dob: spx.dob, pob: spx.pob, sex: spx.sex, level: spx.level, programme: spx.programme, field: spx.field, specialty: spx.specialty, rows: spRows(spx) }; }
    }
    if (pay && !rec.rc) applyPay(rec, pay);
    rec.n = (rec.n || 0) + 1; rec.last = now(); await S.put(COL, rec.id, rec);
    if (type === 'TR') { try { await audit(u, 'transcript issued ' + rec.id + ' ' + rec.matric); } catch (e) {} if (ctx.onTranscript && st) { try { await ctx.onTranscript(u, st, rec); } catch (e) {} } if (spx) { spx.gen = { at: now(), by: u.name || u.email || '', serial: rec.id, n: ((spx.gen && spx.gen.n) || 0) + 1 }; try { await S.put(SP, spx.id, spx); } catch (e) {} } }
    return { code: 200, out: { serial: rec.id, code: codeOf(rec.id, rec.digest), at: rec.at } };
  }

  /* HND / BTS: a semester stands at 30 credits (same rule as the portal's transcript). Courses of another semester (carry-over / repeat, recognised by the year-and-semester digits of
   * the code) and courses beyond the 30-credit load are listed but not counted, so a resit or repeated course is counted once, in its own semester. `pend` marks the semesters in which
   * a registered course has no published result yet; those are summed as they stand. Works on copies, never on the stored rows. */
  const SEM_LOAD = 30, stemOf = c => { const m = /^[A-Za-z]{2,4}\s*-?\s*(\d)(\d)\d/.exec(String(c || '').trim()); return m ? m[1] + m[2] : ''; };
  function loadTotals(rows0, level, pend) {
    const std = level === 'HND' || level === 'BTS', rows = rows0.map(r => Object.assign({}, r, { flag: 0 })), by = {};
    rows.forEach(r => { const k = r.ay + '|' + r.sem; (by[k] = by[k] || []).push(r); });
    let cr = 0, wp = 0, earn = 0;
    Object.keys(by).forEach(k => {
      const g = by[k];
      if (std && g.reduce((a, r) => a + (Number(r.cv) || 0), 0) > SEM_LOAD) {
        const cnt = {}; let best = '', bn = 0; g.forEach(r => { const s = stemOf(r.code); if (!s) return; cnt[s] = (cnt[s] || 0) + (Number(r.cv) || 0); if (cnt[s] > bn) { bn = cnt[s]; best = s; } });
        if (best) g.forEach(r => { const s = stemOf(r.code); if (s && s !== best) r.flag = 1; });
        let acc = 0; g.map((r, i) => i).sort((a, b) => String(g[a].code || '').localeCompare(String(g[b].code || ''))).forEach(i => { if (g[i].flag) return; const c = Number(g[i].cv) || 0; if (acc + c <= SEM_LOAD) acc += c; else g[i].flag = 2; });
      }
      let a = 0; g.forEach(r => { if (r.flag) return; const c = Number(r.cv) || 0; a += c; wp += (Number(r.gp) || 0) * c; if (r.grade !== 'F') earn += c; });
      cr += std && !(pend && pend[k]) ? SEM_LOAD : a;
    });
    return { cr, wp, earn, rows };
  }

  // ---- what the portal itself holds for the student (never taken from the client)
  function records(st, ay, sem) {
    const enr = Object.values(S.all('enroll')).filter(e => e.matric === st.matric && (!ay || e.ay === ay) && (!sem || String(e.sem) === String(sem)));
    const rows = [], pend = {};
    enr.forEach(e => {
      const c = S.get('courses', e.courseId), r = S.get('results', e.matric + '_' + e.courseId + '_' + String(e.ay).replace('/', '-'));
      if (c && !(r && r.state === 'published')) pend[e.ay + '|' + (Number(e.sem) || 0)] = 1;
      if (c && r && r.state === 'published') rows.push({ ay: e.ay, sem: Number(e.sem) || 0, code: c.code, title: c.title, cv: Number(c.credits) || 0, total: r.total, grade: r.grade, gp: Number(r.gp) || 0, resit: !!r.resitUsed });
    });
    rows.sort((a, b) => String(a.ay).localeCompare(String(b.ay)) || a.sem - b.sem || String(a.code).localeCompare(String(b.code)));
    rows.pend = pend; return rows;
  }
  const fmtD = t => new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Africa/Douala' });


  // ---- the genuine owner of a document: identity and bio data as held by the University (never supplied by the client)
  const LV = (core && core.LEVELS) || {};
  function owner(st) {
    if (!st) return null;
    const sp = (core && core.SPEC && core.SPEC[st.specId]) || {}, grp = (core && core.GRP && core.GRP[st.gid || sp.gid]) || {};
    let app = null;
    if (st.userId) { const mine = Object.values(S.all('apps')).filter(a => a && a.userId === st.userId && a.p); app = mine.find(a => a.status === 'admitted' && a.p.dob) || mine.find(a => a.p.dob) || mine[0] || null; }
    const p = (app && app.p) || {}, us = st.userId ? S.get('users', st.userId) : null, ph = st.photo || (app && app.photo) || (us && us.photo) || '';
    const lv = LV[st.level] || {};
    return {
      name: st.name, matric: st.matric || '', level: st.level || '', programme: (lv.en || st.level || ''), programmeFr: (lv.fr || lv.en || st.level || ''), school: grp.en || '', schoolFr: grp.fr || grp.en || '', specialty: sp.name || '',
      dob: /^\d{4}-\d{2}-\d{2}$/.test(String(p.dob || '')) ? p.dob : '', pob: plain(p.pob, 60), gender: /^[MF]$/i.test(String(p.gender || '')) ? String(p.gender).toUpperCase() : '', nat: plain(p.nat, 40),
      photo: process.env.DOCREG_PHOTO !== '0' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(String(ph)) && String(ph).length <= 150000 ? String(ph) : ''
    };
  }
  // ---- a payment receipt carries the payment itself and the programme the payer is registered for (read from the portal's own records, never from the browser)
  function applyPay(rec, pay) {
    rec.rc = { payer: plain(pay.payerName, 120), amount: Number(pay.amount) || 0, label: plain(pay.label || pay.kind, 120), ay: plain(pay.ay, 12), receiptNo: plain(pay.receiptNo, 40), status: plain(pay.status, 20), paidAt: pay.at || 0 };
    rec.uid = pay.userId || '';
    let st = pay.matric ? S.get('students', String(pay.matric).toUpperCase()) : null;
    if (!st && pay.userId) st = Object.values(S.all('students')).find(x => x && x.userId === pay.userId) || null;
    if (st) { rec.matric = st.matric; rec.name = st.name; rec.prog = { specId: st.specId || '', level: st.level || '', gid: st.gid || '' }; return; }
    const apps = pay.userId ? Object.values(S.all('apps')).filter(a => a && a.userId === pay.userId && a.decision && a.decision.specId) : [];
    const a = apps.find(x => x.status === 'admitted') || apps[0];
    if (a) { const sp = (core && core.SPEC && core.SPEC[a.decision.specId]) || {}; rec.prog = { specId: a.decision.specId, level: a.decision.level || a.level || sp.level || '', gid: sp.gid || '' }; }
  }
  // who a document belongs to: the enrolled student, or — for a receipt paid before enrolment — the applicant and the programme offered
  function ownerOf(rec) {
    if (rec.sp) { const x = rec.sp; return { name: x.name, matric: x.matric, level: x.level || '', programme: x.programme || '', programmeFr: x.programme || '', school: x.field || '', schoolFr: x.field || '', specialty: x.specialty || '', dob: x.dob || '', pob: x.pob || '', gender: x.sex || '', nat: '', photo: '' }; }
    const st = rec.matric ? S.get('students', rec.matric) : null; if (st) return owner(st);
    if (rec.prog && rec.rc) return owner({ name: rec.rc.payer || rec.name, matric: '', level: rec.prog.level, specId: rec.prog.specId, gid: rec.prog.gid, userId: rec.uid });
    return null;
  }
  // the particulars that apply to this document: they drive the verification form, so only relevant fields are asked for
  function idFields(rec, ow) {
    if (rec.type === 'RC') return ow ? ['name', 'matric', 'programme', 'school', 'specialty', 'amount'] : ['name', 'amount'];
    if (!ow) return [];
    return rec.type === 'FB' ? ['name', 'matric', 'programme', 'school', 'specialty'] : ['name', 'matric', 'dob', 'programme', 'school', 'specialty'];
  }
  // ---- identity cross-check: what the person presenting the document claims, compared field by field with the register
  const norm = x => String(x == null ? '' : x).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const toks = x => norm(x).split(' ').filter(Boolean);
  function cmpName(a, b) {
    const A = [...new Set(toks(a))], B = [...new Set(toks(b))]; if (!B.length) return 'unknown'; if (!A.length) return 'blank';
    const n = A.filter(t => B.includes(t)).length, m = Math.max(A.length, B.length);
    if (n === A.length && n === B.length) return 'match'; if (n >= 2 && n / m >= 0.67) return 'partial'; return 'mismatch';
  }
  function cmpText(a, b) {
    const x = norm(a), y = norm(b); if (!y) return 'unknown'; if (!x) return 'blank'; if (x === y || x.includes(y) || y.includes(x)) return 'match';
    const A = [...new Set(toks(a))], B = [...new Set(toks(b))], n = A.filter(t => B.includes(t)).length; return n / Math.max(A.length, B.length) >= 0.6 ? 'partial' : 'mismatch';
  }
  function isoDate(v) {
    v = String(v || '').trim(); let m = /^(\d{4})[-\/. ](\d{1,2})[-\/. ](\d{1,2})$/.exec(v); if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
    m = /^(\d{1,2})[-\/. ](\d{1,2})[-\/. ](\d{4})$/.exec(v); return m ? m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0') : '';
  }
  const cmpExact = (a, b) => { const x = norm(a).replace(/ /g, ''), y = norm(b).replace(/ /g, ''); return !y ? 'unknown' : !x ? 'blank' : x === y ? 'match' : 'mismatch'; };
  function compare(rec, ow, claim) {
    claim = claim || {}; const f = [], add = (k, st) => f.push({ k, st });
    if (ow) {
      add('name', cmpName(claim.name, ow.name)); add('matric', cmpExact(claim.matric, ow.matric));
      const cd = isoDate(claim.dob); add('dob', !String(claim.dob || '').trim() ? 'blank' : !ow.dob ? 'unknown' : !cd ? 'mismatch' : cd === ow.dob ? 'match' : 'mismatch');
      add('pob', cmpText(claim.pob, ow.pob)); add('gender', !String(claim.gender || '').trim() ? 'blank' : !ow.gender ? 'unknown' : String(claim.gender).trim().toUpperCase()[0] === ow.gender ? 'match' : 'mismatch');
      add('programme', Math.max(cmpText(claim.programme, ow.programme) === 'match' ? 1 : 0, cmpText(claim.programme, ow.programmeFr) === 'match' ? 1 : 0) ? 'match' : cmpText(claim.programme, ow.programme));
      add('school', cmpText(claim.school, ow.school) === 'mismatch' && cmpText(claim.school, ow.schoolFr) !== 'mismatch' ? cmpText(claim.school, ow.schoolFr) : cmpText(claim.school, ow.school)); add('specialty', cmpText(claim.specialty, ow.specialty));
      if (rec.rc) { const ca = String(claim.amount || '').replace(/\D/g, ''); add('amount', !ca ? 'blank' : !rec.rc.amount ? 'unknown' : ca === String(rec.rc.amount) ? 'match' : 'mismatch'); }
    } else {
      const subj = String(rec.subject || rec.name || ''), who = rec.rc ? rec.rc.payer : subj.split(/\s+[—–-]\s+/)[0], amt = rec.rc ? String(rec.rc.amount) : (subj.match(/[—–-]\s*([\d.,\s]+)\s*[A-Za-z]{2,4}\s*$/) || [])[1];
      add('name', cmpName(claim.name, who));
      const ca = String(claim.amount || '').replace(/\D/g, ''), ra = String(amt || '').replace(/\D/g, ''); add('amount', !ca ? 'blank' : !ra ? 'unknown' : ca === ra ? 'match' : 'mismatch');
    }
    const given = f.filter(x => x.st !== 'blank'), bad = given.filter(x => x.st === 'mismatch').length, part = given.filter(x => x.st === 'partial').length, ok = given.filter(x => x.st === 'match').length;
    const nm = (f.find(x => x.k === 'name') || {}).st;
    const verdict = !given.length ? 'none' : bad ? 'mismatch' : part ? 'review' : (nm === 'match' && (ok >= 2 || !ow)) ? 'confirmed' : 'insufficient';
    return { fields: f, verdict };
  }
  async function check(ipAddr, s, c, claim) {
    s = plain(s, 40).toUpperCase(); c = plain(c, 20).toUpperCase(); const rec = S.get(COL, s);
    if (!rec || !c || !same(codeOf(rec.id, rec.digest), c)) return { valid: false };
    const cl = {}; ['name', 'matric', 'dob', 'pob', 'gender', 'programme', 'school', 'specialty', 'amount'].forEach(k => { cl[k] = plain((claim || {})[k], 120); });
    const ow0 = ownerOf(rec), ow = ow0 || null, idf = idFields(rec, ow0);
    if (!idf.length) return { valid: true, status: 'confirmed', verdict: 'confirmed', fields: [], idFields: [], doc: detail(s, c) };   // a document not issued to a named person is authenticated by its serial number and code alone
    const r = compare(rec, ow || (rec.name && rec.matric ? { name: rec.name, matric: rec.matric, dob: '', pob: '', gender: '', programme: '', programmeFr: '', school: '', schoolFr: '', specialty: '' } : null), cl);
    if (r.verdict === 'mismatch') {
      rec.mm = (rec.mm || 0) + 1; rec.mmAt = now(); const alert = !rec.mmAlert || now() - rec.mmAlert > 3600e3; if (alert) rec.mmAlert = now(); await S.put(COL, rec.id, rec);
      try { await audit(null, 'verification identity mismatch on ' + rec.id + ' (' + r.fields.filter(x => x.st === 'mismatch').map(x => x.k).join(', ') + ') — possible impersonation or copied serial number'); } catch (e) {}
      if (alert && ctx.notifyUser && ctx.usersWith) { try { for (const a of ctx.usersWith('__super')) await ctx.notifyUser(a.id, 'Possible impersonation detected', 'A verification of document ' + rec.id + ' found that the identity presented does not match the register (' + r.fields.filter(x => x.st === 'mismatch').map(x => x.k).join(', ') + '). The serial number may have been copied.'); } catch (e) {} }
    }
    const det = detail(s, c), mask = n => String(n || '').split(/\s+/).filter(Boolean).map(w => w[0] + '*'.repeat(Math.max(2, Math.min(6, w.length - 1)))).join(' ');
    // one verdict: the document is shown as authentic only when the register entry AND the identity presented agree; on a mismatch the holder's particulars are withheld
    const doc = r.verdict === 'mismatch' ? { valid: true, serial: det.serial, type: det.type, typeEn: det.typeEn, typeFr: det.typeFr, issued: det.issued, pages: det.pages, holderMask: mask(ow ? ow.name : (rec.rc ? rec.rc.payer : String(rec.subject || rec.name || '').split(/\s+[—–-]\s+/)[0])), idFields: idf } : det;
    return { valid: true, status: r.verdict === 'none' ? 'registered' : r.verdict, verdict: r.verdict, fields: r.fields, idFields: idf, doc };
  }

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
    const T = TYPES[rec.type] || TYPES.GN, st = rec.sp ? ownerOf(rec) : ((rec.matric ? S.get('students', rec.matric) : null) || ownerOf(rec));
    let h = '<div class="card ok"><p class="st">AUTHENTIC · AUTHENTIQUE</p><p>This document was issued by ADI University and is registered in its official register. · Ce document a été délivré par ADI University et figure dans son registre officiel.</p><dl>' +
      '<dt>Document</dt><dd>' + esc(T[0]) + ' / ' + esc(T[1]) + '</dd><dt>Serial · Numéro</dt><dd>' + esc(rec.id) + '</dd><dt>Issued · Délivré le</dt><dd>' + esc(fmtD(rec.at)) + '</dd>' +
      (rec.pages ? '<dt>Pages</dt><dd>' + rec.pages + '</dd>' : '') + (rec.ay ? '<dt>Session</dt><dd>' + esc(rec.ay) + (rec.sem ? ' · S' + esc(rec.sem) : '') + '</dd>' : '') +
      (st ? '<dt>Student · Étudiant</dt><dd>' + esc(st.name) + '</dd><dt>Matricule</dt><dd>' + esc(st.matric) + '</dd>' : (rec.subject ? '<dt>Subject · Objet</dt><dd>' + esc(rec.subject) + '</dd>' : '')) + '</dl></div>';
    if (st && (rec.type === 'TR' || rec.type === 'SR')) {
      const sp = (core && core.SPEC && core.SPEC[st.specId]) || {}, grp = (core && core.GRP && core.GRP[st.gid || sp.gid]) || {};
      const ow = rec.sp ? st : owner(st), gl = ow.gender === 'F' ? 'Female · Féminin' : ow.gender === 'M' ? 'Male · Masculin' : '';
      h = h.replace('</dl></div>', '<dt>Programme</dt><dd>' + esc(ow.programme || '—') + '</dd>' + (ow.school ? '<dt>School · Faculté</dt><dd>' + esc(ow.school) + '</dd>' : '') + (ow.specialty ? '<dt>Department / Specialty · Spécialité</dt><dd>' + esc(ow.specialty) + '</dd>' : '') + (ow.dob ? '<dt>Date of birth · Né(e) le</dt><dd>' + esc(fmtD(Date.parse(ow.dob + 'T12:00:00Z'))) + '</dd>' : '') + (ow.pob ? '<dt>Place of birth · Lieu</dt><dd>' + esc(ow.pob) + '</dd>' : '') + (gl ? '<dt>Sex · Sexe</dt><dd>' + gl + '</dd>' : '') + (ow.nat ? '<dt>Nationality · Nationalité</dt><dd>' + esc(ow.nat) + '</dd>' : '') + '</dl>' + (ow.photo ? '<p><img alt="Holder photograph" src="' + ow.photo + '" style="width:110px;height:130px;object-fit:cover;border:1px solid #d5dbea;margin-top:10px"></p>' : '') + '<p class="note">Compare these particulars, and the photograph, with the identity of the person presenting the document. · Comparez ces données, et la photographie, avec l\'identité de la personne qui présente le document.</p></div>');
      const rows0 = rec.sp ? rec.sp.rows : records(st, rec.type === 'SR' ? rec.ay : '', rec.type === 'SR' ? rec.sem : ''), TT = loadTotals(rows0, (rec.sp && rec.sp.level) || st.level, rows0.pend), rows = TT.rows, cr = TT.cr, wp = TT.wp, earn = TT.earn; let cur = '';
      let t = '<div class="card"><h2 style="margin-top:0">Results on file at ADI University · Résultats détenus par ADI University</h2><table><tr><th>Code</th><th>Course · Cours</th><th class="n">CV</th><th class="n">Mark</th><th>Grade</th><th class="n">GP</th></tr>';
      rows.forEach(r => { const k = r.ay + ' · S' + r.sem; if (k !== cur) { cur = k; t += '<tr><td colspan="6" style="background:#e9eef8;font-weight:bold">' + esc(k) + '</td></tr>'; } t += '<tr><td>' + esc(r.code) + '</td><td>' + esc(r.title) + '</td><td class="n">' + r.cv + (r.flag ? ' †' : '') + '</td><td class="n">' + esc(r.total) + (r.resit ? ' #' : '') + '</td><td>' + esc(r.grade) + '</td><td class="n">' + r.gp.toFixed(1) + '</td></tr>'; });
      t += '</table>' + (rows.length ? '<dl><dt>Credits attempted · tentés</dt><dd>' + cr + '</dd><dt>Credits earned · acquis</dt><dd>' + earn + '</dd><dt>' + (rec.type === 'SR' ? 'GPA' : 'CGPA') + '</dt><dd>' + (cr ? (wp / cr).toFixed(2) : '—') + '</dd></dl><p class="note"># = resit mark retained. † = carry-over or additional course, not counted in the 30-credit semester load. The figures above are the results published today; a document issued earlier shows the results published at its date. · # = note de rattrapage retenue. † = cours reporté ou supplémentaire, non compté dans la charge semestrielle de 30 crédits. Les chiffres ci-dessus sont les résultats publiés aujourd’hui ; un document délivré plus tôt présente les résultats publiés à sa date.</p>' : '<p>No published results.</p>') + '</div>';
      h += t;
    }
    return shell(h + form('', ''));
  }

  // structured result for the portal's own verification page
  function detail(s, c) {
    s = plain(s, 40).toUpperCase(); c = plain(c, 20).toUpperCase();
    const rec = S.get(COL, s); if (!rec || !c || !same(codeOf(rec.id, rec.digest), c)) return { valid: false };
    const T = TYPES[rec.type] || TYPES.GN, st = rec.matric ? S.get('students', rec.matric) : null, ow0 = ownerOf(rec);
    const out = { idFields: idFields(rec, ow0), valid: true, serial: rec.id, type: rec.type, typeEn: T[0], typeFr: T[1], issued: rec.at, pages: rec.pages || 0, ay: rec.ay || '', sem: rec.sem || '', subject: rec.subject || '' };
    if (ow0) { out.student = Object.assign({ programme: ow0.specialty, level: ow0.level }, ow0, { programmeName: ow0.programme, specialty: ow0.specialty }); }
    if ((st || rec.sp) && (rec.type === 'TR' || rec.type === 'SR')) {
      const rows0 = rec.sp ? rec.sp.rows : records(st, rec.type === 'SR' ? rec.ay : '', rec.type === 'SR' ? rec.sem : ''), TT = loadTotals(rows0, (rec.sp && rec.sp.level) || (st && st.level) || '', rows0.pend), rows = TT.rows, cr = TT.cr, wp = TT.wp, earn = TT.earn;
      out.results = rows; out.totals = { attempted: cr, earned: earn, gpa: cr ? Math.round(wp / cr * 100) / 100 : null };
    }
    if (rec.rc) out.pay = { payer: rec.rc.payer, amount: rec.rc.amount, label: rec.rc.label, ay: rec.rc.ay, receiptNo: rec.rc.receiptNo, status: rec.rc.status, paidAt: rec.rc.paidAt };
    return out;
  }

  async function handle(req, res, u, url, p) {
    if (p === '/api/sptr' && req.method === 'GET') { if (!isSuper(u)) { send(res, 403, { error: 'forbidden' }); return true; } send(res, 200, { recs: Object.values(S.all(SP)).filter(Boolean).sort((a, b2) => (b2.updatedAt || 0) - (a.updatedAt || 0)) }); return true; }
    if (p === '/api/sptr/save' && req.method === 'POST') { const r = await spSave(u, await body(req, 200000)); send(res, r.code, r.out); return true; }
    if (p.startsWith('/api/sptr/') && p.endsWith('/delete') && req.method === 'POST') {
      if (!isSuper(u)) { send(res, 403, { error: 'forbidden' }); return true; }
      const id = decodeURIComponent(p.slice(10, -7)), old = S.get(SP, id); if (!old) { send(res, 404, { error: 'Unknown record' }); return true; }
      await S.del(SP, id); try { await audit(u, 'special transcript record deleted ' + id + ' ' + old.matric + ' ' + old.name); } catch (e) {}
      send(res, 200, { ok: true }); return true;
    }
    if (p === '/api/docs/issue' && req.method === 'POST') { const r = await issue(u, await body(req, 4000)); send(res, r.code, r.out); return true; }
    if (p === '/verify' || p.startsWith('/verify/') || p === '/api/verify' || p === '/api/verify/check') {
      if (limited('verify:' + ip(req), 80, 3600e3)) { res.writeHead(429, { 'Content-Type': 'text/plain' }); res.end('Too many requests'); return true; }
      const q = url.searchParams, s = p.startsWith('/verify/') ? decodeURIComponent(p.slice(8)) : (q.get('s') || ''), c = q.get('c') || '';
      if (p === '/api/verify/check') {
        if (req.method !== 'POST') { send(res, 405, { error: 'POST' }); return true; }
        if (limited('vcheck:' + ip(req), 40, 3600e3)) { send(res, 429, { error: 'Too many checks' }); return true; }
        const b = await body(req, 4000); send(res, 200, await check(ip(req), b.s, b.c, b.claim)); return true;
      }
      if (p === '/api/verify') { send(res, 200, detail(s, c)); return true; }
      if (p !== '/verify' && !q.get('plain') && s) { res.writeHead(302, { Location: '/#/verify/' + encodeURIComponent(s) + '?c=' + encodeURIComponent(c), 'Cache-Control': 'no-store' }); res.end(); return true; }   // the portal page does the checking
      const html = page(s, c);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'" });
      res.end(html); return true;
    }
    return false;
  }
  return { handle, issue, page, codeOf };
};
