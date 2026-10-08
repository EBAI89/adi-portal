'use strict';
/* Institutional mailboxes @adiuniversity.com
   Issued automatically when a student is admitted or a lecturer/staff member is appointed.
   The one-time password is sealed on the server and shown only on the letter, to the
   person, and to an officer allowed to manage the directory — until the mailbox is activated. */

const crypto = require('crypto');

const DOMAIN = 'adiuniversity.com';
const ACADEMIC = new Set(['lecturer', 'senior', 'adjunct', 'assistant']);
const RESERVED = new Set(['admin', 'administrator', 'registry', 'admissions', 'admission', 'hr', 'finance', 'info', 'no-reply', 'noreply', 'postmaster', 'webmaster', 'support', 'rector', 'director', 'student', 'staff', 'lecturer', 'it', 'root', 'mail', 'abuse', 'security', 'help', 'contact', 'office', 'rectorat']);
const CAT = {
  lecturer: ['Lecturer', 'Enseignant'],
  senior: ['Senior lecturer', 'Maître de conférences'],
  adjunct: ['Adjunct lecturer', 'Enseignant vacataire'],
  assistant: ['Teaching assistant', 'Assistant d\'enseignement'],
  admin: ['Administrative staff', 'Personnel administratif'],
  technical: ['Technical staff', 'Personnel technique'],
  consultant: ['Consultant', 'Consultant'],
  intern: ['Intern', 'Stagiaire']
};

const clip = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);

function foldName(name) {
  return String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function suggestLocal(name, matric) {
  const p = foldName(name).split(' ').filter(w => w.length >= 2);
  let local = p.length >= 2 ? p[0] + '.' + p[1] : (p[0] || '');
  if (!local) {
    const m = String(matric || 'user').toLowerCase().replace(/[^a-z0-9]/g, '');
    local = 's.' + (m || 'user');
  }
  return local.replace(/\.{2,}/g, '.').replace(/^\.+|\.+$/g, '').slice(0, 64);
}

function localOk(local) {
  return /^[a-z](?:[a-z0-9]|[.](?=[a-z0-9])){0,62}[a-z0-9]$/.test(local) && local.length >= 3 && local.length <= 64 && !RESERVED.has(local);
}

module.exports = function makeMailbox(ctx) {
  const { S, save, audit, now, uid, R, E, limited, notifyUser, send, body, bi, hashPw, checkPw, PROD } = ctx;
  const SECRET = E.SESSION_SECRET || 'dev-secret-change-me';

  function fail(status, msg, code) { const e = new Error(msg || code || 'error'); e.status = status; e.code = code || msg; throw e; }

  function key() { return crypto.createHash('sha256').update(String(SECRET) + '|adi-mailbox-v1').digest(); }
  function seal(plain) {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
    const enc = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
    return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
  }
  function unseal(packed) {
    try {
      const buf = Buffer.from(String(packed || ''), 'base64');
      if (buf.length < 29) return '';
      const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), enc = buf.subarray(28);
      const d = crypto.createDecipheriv('aes-256-gcm', key(), iv);
      d.setAuthTag(tag);
      return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
    } catch (e) { return ''; }
  }

  function otpPlain() {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const r = crypto.randomBytes(12);
    let s = '';
    for (let i = 0; i < 12; i++) s += A[r[i] % A.length];
    return s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8);
  }

  function acl() {
    const a = S.meta && S.meta.mailAcl;
    return { admin: !a || a.admin !== false, users: Array.isArray(a && a.users) ? a.users.filter(x => typeof x === 'string') : [] };
  }
  function officer(u) {
    if (!u || u.status !== 'active') return false;
    if (R.isSuper(u)) return true;
    const a = acl();
    if (u.role === 'admin' && a.admin) return true;
    return a.users.includes(u.id);
  }
  const needOfficer = u => { if (!officer(u)) fail(403, 'Only the super administrator, or an administrator granted this role, can manage institutional mailboxes.', 'forbidden'); };

  function all() { return Object.values(S.all('mailbox') || {}).filter(m => m && m.email); }
  function byUser(id) { return all().find(m => m.userId === id && m.status !== 'revoked') || null; }
  function byHr(id) { return all().find(m => m.hrId === id && m.status !== 'revoked') || null; }
  function byEmail(email) { return all().find(m => m.email === email) || null; }

  function taken(local, exceptMailboxId) {
    const email = local + '@' + DOMAIN;
    if (RESERVED.has(local)) return true;
    if (all().some(m => m.local === local && m.status !== 'revoked' && m.id !== exceptMailboxId)) return true;
    const owner = exceptMailboxId && (S.get('mailbox', exceptMailboxId) || {}).userId;
    return Object.values(S.all('users')).some(u => u && u.id !== owner && (String(u.email || '').toLowerCase() === email || String(u.altEmail || '').toLowerCase() === email));
  }
  function uniqueLocal(base, exceptId) {
    let n = base, i = 2;
    while (taken(n, exceptId) || !localOk(n)) {
      const stem = base.replace(/\d+$/, '').replace(/\.$/, '');
      n = (stem || base).slice(0, 58) + String(i);
      i += 1;
      if (i > 80) fail(409, 'No free address could be formed from this name.', 'collision');
    }
    return n;
  }

  function pub(m) {
    if (!m) return null;
    return {
      id: m.id, email: m.email, local: m.local, domain: DOMAIN,
      kind: m.kind, role: m.role || '', name: m.name, userId: m.userId || '',
      matric: m.matric || '', hrId: m.hrId || '', hrRef: m.hrRef || '',
      personalEmail: m.personalEmail || '', phone: m.phone || '',
      title: m.title || '', titleFr: m.titleFr || '',
      status: m.status, ref: m.ref, issuedAt: m.issuedAt, issuedBy: m.issuedBy || '',
      issuedByName: m.issuedByName || '', setupAt: m.setupAt || null
    };
  }
  function withOtp(m, u) {
    const row = pub(m);
    if (!row) return null;
    const may = m.status === 'pending_setup' && u && (m.userId === u.id || officer(u) || m.issuedBy === u.id);
    row.otp = may ? unseal(m.otpSeal) : '';
    return row;
  }

  async function nextRef() {
    const y = new Date(now()).getUTCFullYear();
    const k = Number(S.meta.mailn || 0) + 1;
    await S.setMeta('mailn', k);
    return 'ADI/MAIL/' + y + '/' + String(k).padStart(4, '0');
  }

  async function persist(doc, plain) {
    const id = doc.id || uid('mb');
    const otp = plain || otpPlain();
    const rec = Object.assign({
      domain: DOMAIN, status: 'pending_setup', issuedAt: now(), setupAt: null, pw: ''
    }, doc, {
      id,
      email: doc.local + '@' + DOMAIN,
      otpHash: await hashPw(otp),
      otpSeal: seal(otp)
    });
    await save('mailbox', id, rec);
    return { rec, otp };
  }

  async function tell(userId, email) {
    if (!userId) return;
    try {
      await notifyUser(userId, bi('Your ADI email address is ready', 'Votre adresse électronique ADI est prête'), email + ' — ' + bi('The one-time password is on your admission or appointment letter. Sign in with that address and set your own password.', 'Le mot de passe à usage unique figure sur votre lettre d\'admission ou de nomination. Connectez-vous avec cette adresse et choisissez votre mot de passe.'));
    } catch (e) { /* notification must not block issuance */ }
  }

  async function issueFromAdmission(actor, app) {
    if (!app || app.status !== 'admitted') return null;
    const userId = app.userId;
    const existing = byUser(userId);
    if (existing) return pub(existing);
    const p = app.p || {};
    const name = clip(p.name || '', 160);
    const matric = clip((app.decision || {}).matric || '', 40);
    const local = uniqueLocal(suggestLocal(name, matric));
    const { rec, otp } = await persist({
      local, kind: 'student', role: 'student', name, userId,
      matric, personalEmail: clip(p.email || '', 160).toLowerCase(),
      phone: clip(p.phone || '', 40),
      title: 'Student', titleFr: 'Étudiant(e)',
      ref: await nextRef(),
      issuedBy: actor && actor.id, issuedByName: actor && actor.name || 'Registry'
    });
    await audit(actor, 'mailbox issued ' + rec.email + ' student ' + (matric || userId));
    await tell(userId, rec.email);
    return Object.assign(pub(rec), { otp });
  }

  async function issueFromHire(actor, hra) {
    if (!hra || hra.stage !== 'hired' || hra.anon) return null;
    const existing = byHr(hra.id);
    if (existing) return withOtp(existing, actor);
    const a = hra.a || {};
    const name = clip(a.name || '', 160);
    const personal = clip(a.email || '', 160).toLowerCase();
    const cat = hra.cat || 'lecturer';
    const kind = ACADEMIC.has(cat) ? 'lecturer' : 'staff';
    const role = kind === 'lecturer' ? 'lecturer' : 'x_staff';
    const titles = CAT[cat] || ['Staff', 'Personnel'];
    let user = Object.values(S.all('users')).find(u => u && (String(u.email || '').toLowerCase() === personal || String(u.altEmail || '').toLowerCase() === personal || String(u.adiEmail || '').toLowerCase() === personal));
    const local = uniqueLocal(suggestLocal(name));
    const otp = otpPlain();
    if (!user) {
      const id = uid('u');
      user = {
        id, email: local + '@' + DOMAIN, altEmail: personal,
        name, phone: clip(a.phone || '', 40), role, status: 'active', lang: hra.lang === 'fr' ? 'fr' : 'en',
        createdAt: now(), pw: await hashPw(otp), mustChange: true
      };
      await save('users', id, user);
    } else if (user.role === 'applicant') {
      user = Object.assign({}, user, { role });
      await save('users', user.id, user);
    }
    const { rec } = await persist({
      local, kind, role: user.role, name: user.name || name, userId: user.id,
      hrId: hra.id, hrRef: hra.ref || '', personalEmail: personal,
      phone: clip(a.phone || user.phone || '', 40),
      title: titles[0] + (hra.vacTitle ? ' — ' + clip(hra.vacTitle, 120) : ''),
      titleFr: titles[1] + (hra.vacTitle ? ' — ' + clip(hra.vacTitle, 120) : ''),
      ref: await nextRef(),
      issuedBy: actor && actor.id, issuedByName: actor && actor.name || 'Human Resources'
    }, otp);
    if (user.email === rec.email) {
      await save('users', user.id, Object.assign({}, S.get('users', user.id), { pw: await hashPw(otp), mustChange: true }));
    }
    await audit(actor, 'mailbox issued ' + rec.email + ' ' + kind + ' ' + (hra.ref || ''));
    await tell(user.id, rec.email);
    return Object.assign(pub(rec), { otp });
  }

  async function issueManual(actor, b) {
    needOfficer(actor);
    if (b.hrId) {
      const h = S.get('hra', String(b.hrId));
      if (!h || h.stage !== 'hired') fail(400, 'Only an appointed candidate can receive an ADI address.', 'not_hired');
      return issueFromHire(actor, h);
    }
    const userId = String(b.userId || '');
    const user = S.get('users', userId);
    if (!user) fail(404, 'Account not found.', 'not_found');
    if (byUser(user.id)) return withOtp(byUser(user.id), actor);
    const st = Object.values(S.all('students')).find(s => s && s.userId === user.id);
    const app = Object.values(S.all('apps')).find(a => a && a.userId === user.id && a.status === 'admitted');
    if (user.role === 'student' || (st && ['admitted', 'registered'].includes(st.status)) || app) {
      const synthetic = app || { status: 'admitted', userId: user.id, p: { name: (st && st.name) || user.name, email: (st && st.email) || user.email, phone: user.phone }, decision: { matric: st && st.matric } };
      synthetic.status = 'admitted';
      const localWant = clip(b.local || '', 64).toLowerCase();
      const made = await issueFromAdmission(actor, synthetic);
      if (localWant && made && localOk(localWant) && !taken(localWant, made.id)) {
        return rename(actor, { id: made.id, local: localWant });
      }
      return made;
    }
    fail(400, 'Issue an address when the person is admitted or appointed.', 'not_eligible');
  }

  async function rename(actor, b) {
    needOfficer(actor);
    const m = S.get('mailbox', String(b.id || ''));
    if (!m || m.status === 'revoked') fail(404, 'Mailbox not found.', 'not_found');
    if (m.status !== 'pending_setup') fail(409, 'The address can be changed only before activation.', 'locked');
    const local = clip(b.local || '', 64).toLowerCase();
    if (!localOk(local)) fail(400, 'Use a short lowercase address: surname.given — letters, digits and a single dot.', 'local');
    if (taken(local, m.id)) fail(409, 'That address is already in use.', 'taken');
    const email = local + '@' + DOMAIN;
    const prev = m.email;
    const next = Object.assign({}, m, { local, email });
    await save('mailbox', m.id, next);
    const usr = m.userId && S.get('users', m.userId);
    if (usr && usr.email === prev) await save('users', usr.id, Object.assign({}, usr, { email }));
    await audit(actor, 'mailbox renamed ' + prev + ' → ' + email);
    return withOtp(S.get('mailbox', m.id), actor);
  }

  async function setStatus(actor, id, status) {
    needOfficer(actor);
    const m = S.get('mailbox', String(id || ''));
    if (!m) fail(404, 'Mailbox not found.', 'not_found');
    if (!['suspended', 'pending_setup', 'active'].includes(status)) fail(400, 'status');
    if (status === 'pending_setup' && m.status === 'active') fail(409, 'Reset the one-time password instead of reopening an active mailbox.', 'locked');
    const next = Object.assign({}, m, { status: status === 'pending_setup' ? m.status : status });
    if (status === 'suspended') next.status = 'suspended';
    else if (status === 'active') next.status = (m.setupAt || m.pw) ? 'active' : 'pending_setup';
    await save('mailbox', m.id, next);
    const usr = m.userId && S.get('users', m.userId);
    if (usr && usr.email === m.email && ['suspended', 'active'].includes(status)) {
      await save('users', usr.id, Object.assign({}, usr, { status: status === 'suspended' ? 'suspended' : 'active' }));
    }
    await audit(actor, 'mailbox ' + status + ' ' + m.email);
    return pub(next);
  }

  async function reset(actor, id) {
    needOfficer(actor);
    const m = S.get('mailbox', String(id || ''));
    if (!m || m.status === 'revoked') fail(404, 'Mailbox not found.', 'not_found');
    const otp = otpPlain();
    const next = Object.assign({}, m, { status: 'pending_setup', setupAt: null, pw: '', otpHash: await hashPw(otp), otpSeal: seal(otp) });
    await save('mailbox', m.id, next);
    const usr = m.userId && S.get('users', m.userId);
    if (usr && usr.email === m.email) await save('users', usr.id, Object.assign({}, usr, { pw: await hashPw(otp), mustChange: true, status: 'active' }));
    await audit(actor, 'mailbox one-time password reset ' + m.email);
    return Object.assign(pub(next), { otp });
  }

  async function setup(u, b) {
    if (!u) fail(401, 'auth');
    if (limited('mailsetup:' + u.id, 8, 900e3)) fail(429, 'Too many attempts. Wait 15 minutes.', 'rate');
    const m = byUser(u.id);
    if (!m) fail(404, 'You do not have an ADI mailbox yet.', 'not_found');
    if (m.status === 'suspended' || m.status === 'revoked') fail(403, 'This mailbox is suspended. Contact the Registry or Human Resources.', 'suspended');
    if (m.status !== 'pending_setup') fail(409, 'This mailbox is already activated.', 'active');
    const otp = String(b.otp || '').trim();
    const pw = String(b.password || '');
    if (!(await checkPw(otp, m.otpHash))) fail(400, 'The one-time password is not correct.', 'otp');
    if (pw.length < 10 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) fail(400, 'Choose a password of at least 10 characters, with a letter and a digit.', 'pw_short');
    if (pw === otp) fail(400, 'The new password must be different from the one-time password.', 'pw_same');
    const next = Object.assign({}, m, { status: 'active', setupAt: now(), pw: await hashPw(pw), otpHash: '', otpSeal: '' });
    await save('mailbox', m.id, next);
    const usr = S.get('users', u.id);
    if (usr) await save('users', usr.id, Object.assign({}, usr, { pw: next.pw, mustChange: false }));
    await audit(u, 'mailbox activated ' + m.email);
    return pub(next);
  }

  async function onUserPassword(user) {
    const m = byUser(user.id);
    if (!m || m.status !== 'pending_setup') return;
    if (user.email !== m.email) return;
    await save('mailbox', m.id, Object.assign({}, m, { status: 'active', setupAt: now(), pw: user.pw, otpHash: '', otpSeal: '' }));
    await audit(user, 'mailbox activated ' + m.email);
  }

  async function login(email, password) {
    const m = byEmail(String(email || '').toLowerCase());
    if (!m || m.status === 'revoked') return null;
    const owner = m.userId && S.get('users', m.userId);
    if (!owner) return { error: 'bad_login', status: 401 };
    if (m.status === 'suspended' || owner.status === 'suspended') return { error: 'suspended', status: 403 };
    if (owner.status === 'pending') return { error: 'pending', status: 403 };
    if (owner.status !== 'active') return { error: 'suspended', status: 403 };
    if (m.status === 'pending_setup') {
      if (!(await checkPw(password, m.otpHash))) return { error: 'bad_login', status: 401 };
      return { user: owner };
    }
    if (m.pw && (await checkPw(password, m.pw))) return { user: owner };
    return { error: 'bad_login', status: 401 };
  }

  async function setAcl(actor, b) {
    if (!R.isSuper(actor)) fail(403, 'Only the super administrator sets who may manage mailboxes.', 'forbidden');
    const users = [];
    for (const raw of Array.isArray(b.emails) ? b.emails : String(b.email || '').split(/[\s,;]+/)) {
      const email = String(raw || '').trim().toLowerCase();
      if (!email) continue;
      const u = Object.values(S.all('users')).find(x => x && (x.email === email || x.adiEmail === email || x.altEmail === email));
      if (!u) fail(404, 'No account for ' + email, 'not_found');
      if (['applicant', 'student'].includes(u.role)) fail(400, 'Students cannot manage the mailbox directory.', 'role');
      if (!users.includes(u.id)) users.push(u.id);
    }
    const admin = b.admin !== false && b.admin !== 'false';
    await S.setMeta('mailAcl', { admin, users });
    await audit(actor, 'mailbox access updated admin=' + admin + ' users=' + users.length);
    return describeAcl();
  }

  function describeAcl() {
    const a = acl();
    const people = a.users.map(id => {
      const u = S.get('users', id);
      return u ? { id, name: u.name, email: u.adiEmail || u.email, role: u.role } : { id, name: 'Removed account', email: '', role: '' };
    });
    return { admin: a.admin, people };
  }

  function desk(u) {
    if (!u) fail(401, 'auth');
    const mine = byUser(u.id);
    const off = officer(u);
    const hired = off ? Object.values(S.all('hra') || {}).filter(h => h && h.stage === 'hired' && !h.anon && !byHr(h.id)).map(h => ({
      id: h.id, ref: h.ref, name: (h.a || {}).name, email: (h.a || {}).email, cat: h.cat, title: h.vacTitle || ''
    })) : [];
    const waiting = off ? Object.values(S.all('students') || {}).filter(s => s && s.userId && ['admitted', 'registered'].includes(s.status) && !byUser(s.userId)).slice(0, 40).map(s => ({
      userId: s.userId, name: s.name, matric: s.matric, email: s.email, status: s.status
    })) : [];
    return {
      officer: off,
      super: R.isSuper(u),
      domain: DOMAIN,
      mine: mine ? withOtp(mine, u) : null,
      rows: off ? all().filter(m => m.status !== 'revoked').map(m => withOtp(m, u)).sort((a, b) => (b.issuedAt || 0) - (a.issuedAt || 0)) : [],
      hired, waiting,
      acl: R.isSuper(u) ? describeAcl() : null
    };
  }

  async function handle(req, res, u, p) {
    if (!p.startsWith('/api/mail')) return false;
    try {
      if (p === '/api/mail/desk' && req.method === 'GET') return send(res, 200, desk(u)), true;
      if (req.method !== 'POST') return send(res, 405, { error: 'method' }), true;
      const b = await body(req, 20000);
      if (p === '/api/mail/setup') return send(res, 200, await setup(u, b)), true;
      if (p === '/api/mail/issue') return send(res, 200, { mailbox: await issueManual(u, b) }), true;
      if (p === '/api/mail/rename') return send(res, 200, { mailbox: await rename(u, b) }), true;
      if (p === '/api/mail/suspend') return send(res, 200, { mailbox: await setStatus(u, b.id, 'suspended') }), true;
      if (p === '/api/mail/restore') return send(res, 200, { mailbox: await setStatus(u, b.id, 'active') }), true;
      if (p === '/api/mail/reset') return send(res, 200, { mailbox: await reset(u, b.id) }), true;
      if (p === '/api/mail/reveal') {
        let m = b.id ? S.get('mailbox', String(b.id)) : null;
        const app = b.appId ? S.get('apps', String(b.appId)) : null;
        if (!m && app && app.userId) m = byUser(app.userId);
        if (!m && u) m = byUser(u.id);
        if (!m && app && app.status === 'admitted' && u && (officer(u) || app.userId === u.id)) {
          await issueFromAdmission(u, app);
          m = byUser(app.userId);
        }
        if (!m && u) {
          const own = Object.values(S.all('apps') || {}).find(a => a && a.userId === u.id && a.status === 'admitted');
          if (own) { await issueFromAdmission(u, own); m = byUser(u.id); }
        }
        if (!m) return send(res, 200, { mailbox: null }), true;
        if (!(u && (m.userId === u.id || officer(u) || m.issuedBy === u.id))) return send(res, 403, { error: 'forbidden' }), true;
        return send(res, 200, { mailbox: withOtp(m, u) }), true;
      }
      if (p === '/api/mail/acl') return send(res, 200, { acl: await setAcl(u, b) }), true;
      return send(res, 404, { error: 'not found' }), true;
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500) console.error('[mail]', e);
      return send(res, status, { error: e.code || e.message || 'server' }), true;
    }
  }

  function staffRole(role) {
    return role === 'lecturer' || role === 'admin' || role === 'accountant' || String(role || '').indexOf('x_') === 0;
  }
  function staffPaper(role) {
    if (role === 'lecturer') return { kind: 'lecturer', title: 'Lecturer', titleFr: 'Enseignant' };
    if (role === 'admin') return { kind: 'staff', title: 'Administrator', titleFr: 'Administrateur' };
    if (role === 'accountant') return { kind: 'staff', title: 'Accountant', titleFr: 'Comptable' };
    return { kind: 'staff', title: 'Staff', titleFr: 'Personnel' };
  }
  async function issueForStaff(actor, user) {
    const personal = String(user.email || '').trim().toLowerCase();
    const alreadyAdi = personal.endsWith('@' + DOMAIN);
    let local = alreadyAdi ? personal.slice(0, -('@' + DOMAIN).length) : '';
    if (!localOk(local) || taken(local)) local = uniqueLocal(suggestLocal(user.name || personal));
    const paper = staffPaper(user.role);
    const { rec } = await persist({
      local, kind: paper.kind, role: user.role, name: clip(user.name || '', 160), userId: user.id,
      personalEmail: alreadyAdi ? '' : personal,
      phone: clip(user.phone || '', 40),
      title: paper.title, titleFr: paper.titleFr,
      ref: await nextRef(),
      issuedBy: actor && actor.id, issuedByName: actor && actor.name || 'Human Resources'
    });
    await audit(actor, 'mailbox issued ' + rec.email + ' ' + paper.kind + ' existing ' + user.role);
    await tell(user.id, rec.email);
    return rec;
  }

  async function ensureIssued() {
    const actor = { id: 'system', name: 'Human Resources' };
    for (const app of Object.values(S.all('apps') || {})) {
      if (!app || app.status !== 'admitted' || !app.userId || byUser(app.userId)) continue;
      try { await issueFromAdmission(actor, app); }
      catch (e) { console.error('[mail] backfill', app.ref || app.id, e && e.message || e); }
    }
    for (const user of Object.values(S.all('users') || {})) {
      if (!user || !staffRole(user.role) || user.status === 'suspended' || user.status === 'rejected') continue;
      const have = byUser(user.id);
      try {
        if (!have) { await issueForStaff(actor, user); continue; }
        if (have.status === 'pending_setup' && have.kind === 'student') {
          const paper = staffPaper(user.role);
          await save('mailbox', have.id, Object.assign({}, have, { kind: paper.kind, role: user.role, title: paper.title, titleFr: paper.titleFr }));
        }
      } catch (e) { console.error('[mail] staff', user.email || user.id, e && e.message || e); }
    }
  }

  async function seed() {
    await ensureIssued();
    if (PROD) return;
    if (!S.meta.mailAcl) await S.setMeta('mailAcl', { admin: true, users: [] });
    const users = Object.values(S.all('users'));
    const paid = users.find(u => u.email === 'hnd.student@adiuniversity.com');
    const due = users.find(u => u.email === 'fees.due@adiuniversity.com');
    async function ensureStudent(user, mode) {
      if (!user || byUser(user.id)) return;
      const st = Object.values(S.all('students')).find(s => s.userId === user.id);
      const app = {
        status: 'admitted', userId: user.id,
        p: { name: (st && st.name) || user.name, email: user.email, phone: user.phone },
        decision: { matric: st && st.matric }
      };
      const actor = users.find(u => u.role === 'super_admin') || user;
      const made = await issueFromAdmission(actor, app);
      if (!made) return;
      const m = S.get('mailbox', made.id);
      if (!m) return;
      if (mode === 'active') {
        const pw = await hashPw('Student@2026');
        await save('mailbox', m.id, Object.assign({}, m, { status: 'active', setupAt: now(), pw, otpHash: '', otpSeal: '' }));
      }
    }
    await ensureStudent(paid, 'active');
    await ensureStudent(due, 'pending');
    if (!users.some(u => u.email === 'akono.paul@adiuniversity.com') && !all().some(m => m.email === 'akono.paul@adiuniversity.com')) {
      const actor = users.find(u => u.role === 'super_admin');
      const hra = {
        id: 'demo-hire-akono', ref: 'ADI/APP/DEMO/0001', stage: 'hired', cat: 'lecturer', lang: 'en', anon: false,
        vacTitle: 'Software Engineering',
        a: { name: 'Akono Paul', email: 'akono.paul.personal@example.com', phone: '+237655001122' }
      };
      await issueFromHire(actor, hra);
      const m = all().find(x => x.hrId === hra.id);
      if (m) {
        const otp = 'Lecturer@2026';
        const hash = await hashPw(otp);
        await save('mailbox', m.id, Object.assign({}, m, { otpHash: hash, otpSeal: seal(otp) }));
        const usr = S.get('users', m.userId);
        if (usr) await save('users', usr.id, Object.assign({}, usr, { pw: hash, mustChange: true }));
      }
    }
  }

  return { handle, issueFromAdmission, issueFromHire, onUserPassword, login, seed, officer, DOMAIN };
};
