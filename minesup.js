'use strict';
/* MINESUP HND/BTS transcript or diploma — ADI portal page. */
(function () {
  if (window.__MS_INSTALLED) return;
  window.__MS_INSTALLED = true;
  if (!Array.isArray(COLS)) return;
  if (!COLS.includes('msapp')) COLS.push('msapp');
  if (!S.msapp) S.msapp = {};
  ['photo', 'police', 'auth'].forEach(k => { if (!DOC_TYPES.includes(k)) DOC_TYPES.push(k); });
  L.dt_photo = ['Passport photograph', "Photo d'identité"];
  L.dt_police = ['Police or loss declaration', 'Déclaration de perte'];
  L.dt_auth = ['Authorisation letter', "Lettre d'autorisation"];
  L.ms_menu = ['MINESUP transcript / diploma', 'Relevé / diplôme MINESUP'];
  L.ms_admin = ['MINESUP applications', 'Demandes MINESUP'];

  const LBL = (en, fr) => LANG === 'fr' ? fr : en;
  const both = (en, fr) => `<span class="ms-lab"><span>${en}</span><span class="ms-fr">${fr}</span></span>`;
  const feeGateKey = 'ms_fee_gate';

  /* An independent MINESUP account (purpose = minesup) is cleared by matricule on the server: it is not linked to any student account. */
  let CLEAR = null;
  const isOwn = u => !!u && u.purpose === 'minesup';
  function loadClear(done) {
    const u = me(); if (!u) return;
    api('/api/minesup/clearance').then(d => { CLEAR = Object.assign({ _for: u.id }, d); if (done) done(); else render(); }).catch(() => { CLEAR = { _for: u.id, error: true, service: false, student: null }; render(); });
  }
  const clearFor = u => (CLEAR && u && CLEAR._for === u.id) ? CLEAR : null;
  const stOf = u => !u ? null : isOwn(u) ? ((clearFor(u) || {}).student || null) : (typeof studentOf === 'function' ? studentOf(u.id) : null);

  function tuitionOk(st) {
    if (isOwn(me())) return !!(clearFor(me()) && clearFor(me()).cleared);
    if (!st || typeof feeBook !== 'function') return false;
    try { if (typeof feesDueNow === 'function' && feesDueNow(st)) return false; const fb = feeBook(st); return !!(fb && fb.regOk && Number(fb.balance) <= 0); }
    catch (e) { return false; }
  }
  const levelOk = st => !!st && (st.level === 'HND' || st.level === 'BTS');
  const mine = () => Object.values(S.msapp || {}).filter(a => a && a.userId === (me() && me().id)).sort((a, b) => (b.at || 0) - (a.at || 0));
  const filesFor = id => Object.values(S.files || {}).filter(f => f && f.ctx === 'ms:' + id);
  const hasD = (id, k) => filesFor(id).some(f => f.dtype === k);

  function ctaLabel() {
    return LANG === 'fr'
      ? '<span class="ms-cta-l">MINESUP RELEVÉ/DIPLÔME — postuler ICI<small>MINESUP TRANSCRIPT/DIPLOMA apply HERE</small></span>'
      : '<span class="ms-cta-l">MINESUP TRANSCRIPT/DIPLOMA apply HERE<small>MINESUP RELEVÉ/DIPLÔME — postuler ICI</small></span>';
  }
  function cta(cls) {
    return `<a class="btn gold ${cls || ''} ms-cta" href="#/minesup" data-a="msgo">${ctaLabel()}</a>`;
  }

  let hopping = false;
  function hopFees() {
    if (isOwn(me())) { loadClear(); return; }
    try { sessionStorage.setItem(feeGateKey, '1'); } catch (e) {}
    if (hopping) return;
    hopping = true;
    const due = typeof feesDueNow === 'function' && typeof studentOf === 'function' && me() ? feesDueNow(stOf(me())) : null;
    toast(due ? LBL('Please complete first: ', 'Veuillez d\'abord régler : ') + due.label + '.' : LBL('Tuition is not fully paid and confirmed. Opening the fees page.', 'La scolarité n\'est pas entièrement payée et confirmée. Ouverture de la page des frais.'), 1);
    setTimeout(() => { hopping = false; go('fees-me'); }, 40);
  }

  function enter() {
    const u = me();
    if (!u) { try { sessionStorage.setItem('adi_next', 'minesup'); } catch (e) {} go('login'); return; }
    if (isOwn(u)) { if (typeof servicePaid === 'function' && !servicePaid(u)) { go('service-fee'); return; } go('minesup'); return; }
    if (u.role !== 'student') {
      if (can('manage_students') || can('manage_transcripts') || u.role === 'super_admin') { go('minesup-admin'); return; }
      go('minesup'); return;
    }
    const st = stOf(u);
    if (!st || !levelOk(st)) { go('minesup'); return; }
    { const c = clearFor(u); if (!c) { loadClear(); return head() + `<div class="card">${LBL('Checking your clearance…', 'Vérification de votre situation…')}</div>`; } if (!c.msOk) { if (!FORMS.msc) FORMS.msc = { matric: '', msNo: '' }; return head() + criteria() + msNoCard(false); } }
    if (!tuitionOk(st)) { hopFees(); return; }
    try { sessionStorage.removeItem(feeGateKey); } catch (e) {}
    go('minesup');
  }
  ACT.msgo = () => enter();
  ACT.msdemo = async el => {
    const r = await doLogin(el.dataset.email, el.dataset.pw);
    if (r.err) { const box = document.getElementById('aerr'); if (box) box.innerHTML = `<div class="note bad">${esc(r.err)}</div>`; else toast(r.err, 1); return; }
    try { if (sessionStorage.getItem('adi_next') === 'minesup') { sessionStorage.removeItem('adi_next'); enter(); return; } } catch (e) {}
    go('dashboard');
  };

  const _login = ACT.dologin;
  ACT.dologin = async () => {
    await _login();
    if (!me()) return;
    try {
      if (sessionStorage.getItem('adi_next') === 'minesup') { sessionStorage.removeItem('adi_next'); enter(); }
    } catch (e) {}
  };

  function demoCard() {
    const list = window.MS_DEMO_ACCOUNTS;
    if (!list || !list.length) return '';
    return `<div class="card gap ms-pop" style="margin-top:14px"><h3>${LBL('Try the MINESUP form', 'Essayer le formulaire MINESUP')}</h3><p class="small muted">${LBL('These demonstration accounts exist only on this preview.', 'Ces comptes de démonstration n\'existent que sur cet aperçu.')}</p>${list.map(a => `<div class="row" style="margin:8px 0"><div class="grow"><b>${esc(LANG === 'fr' ? a.roleFr : a.role)}</b><div class="small muted">${esc(a.email)}</div></div><button class="btn sm gold" data-a="msdemo" data-email="${esc(a.email)}" data-pw="${esc(a.password)}">${LBL('Sign in', 'Connexion')}</button></div>`).join('')}</div>`;
  }

  if (PUBLIC && PUBLIC.home) {
    const home0 = PUBLIC.home;
    PUBLIC.home = function () {
      let h = home0();
      const btn = cta('lg');
      const mark = 'class="btn gold lg" href="#/signup"';
      const i = h.indexOf(mark);
      if (i < 0) return `<div class="wrap" style="padding:18px 0">${btn}</div>` + h;
      const a = h.lastIndexOf('<a', i);
      const e = h.indexOf('</a>', i) + 4;
      const hand = '<span class="ptr-hand" aria-hidden="true">\u{1F446}</span>';
      h = h.slice(0, a) + '<span class="ptr-wrap">' + btn + hand + '</span><span class="ptr-wrap">' + h.slice(a, e) + hand + '</span>' + h.slice(e);
      return h;
    };
  }
  if (PUBLIC && PUBLIC.login) {
    const login0 = PUBLIC.login;
    PUBLIC.login = function () { return login0() + `<div class="auth">${demoCard()}</div>`; };
  }

  const dash = ROUTES.find(r => r.id === 'dashboard');
  if (dash) {
    const base = dash.v;
    dash.v = function () {
      let h = base();
      const u = me(); if (!u) return h;
      if (u.role === 'student') {
        const st = stOf(u);
        const ok = st && levelOk(st) && tuitionOk(st);
        h += `<div class="card gap ms-pop" style="border-top:4px solid var(--gold)"><p class="ms-kicker">MINESUP · HND / BTS</p><h3>${LBL('Transcript or diploma', 'Relevé de notes ou diplôme')}</h3><p class="muted">${ok ? LBL('Your tuition is confirmed. You may complete the official bilingual application.', 'Votre scolarité est confirmée. Vous pouvez remplir la demande officielle bilingue.') : LBL('An ADI student account is required. The form opens only after Finance confirms that tuition is fully paid.', 'Un compte étudiant ADI est requis. Le formulaire s\'ouvre seulement après confirmation du paiement intégral de la scolarité.')}</p><div class="row">${cta()}</div></div>`;
      } else if (isOwn(u)) {
        h += `<div class="card gap ms-pop" style="border-top:4px solid var(--gold)"><p class="ms-kicker">MINESUP · HND / BTS</p><h3>${LBL('Transcript or diploma', 'Relevé de notes ou diplôme')}</h3><p class="muted">${LBL('Pay the 2,000 XAF service fee, enter your MINESUP matricule (like 26SWE0762), and clear your registration and tuition. Then the application form opens.', 'Réglez les frais de service de 2 000 XAF, saisissez votre matricule MINESUP (comme 26SWE0762) et soldez inscription et scolarité. Le formulaire s\'ouvre ensuite.')}</p><div class="row">${cta()}</div></div>`;
      } else if (can('manage_students') || u.role === 'super_admin') {
        const n = Object.values(S.msapp || {}).filter(a => a && a.status === 'submitted').length;
        h += `<div class="card gap ms-pop" style="border-top:4px solid var(--crimson)"><p class="ms-kicker">MINESUP</p><h3>${LBL('Applications to review', 'Demandes à examiner')}</h3><div class="kpi">${n}</div><p class="muted small">${LBL('Check eligibility, then approve or reject. Download carries the ADI round seal on every page.', 'Vérifiez l\'éligibilité, puis approuvez ou rejetez. Le téléchargement porte le sceau rond ADI sur chaque page.')}</p><a class="btn" href="#/minesup-admin">${LBL('Open the desk', 'Ouvrir le bureau')}</a></div>`;
      }
      return h;
    };
  }
  const feesRoute = ROUTES.find(r => r.id === 'fees-me');
  if (feesRoute) {
    const baseF = feesRoute.v;
    feesRoute.v = function () {
      const u = me(), st = u && stOf(u);
      let gate = '';
      try {
        if (st && tuitionOk(st)) sessionStorage.removeItem(feeGateKey);
        else if (sessionStorage.getItem(feeGateKey) === '1') gate = `<div class="note bad ms-pop"><b>${LBL('MINESUP form locked', 'Formulaire MINESUP verrouillé')}</b><br>${LBL('Pay the full tuition. The form opens only after the officer in charge confirms the payment.', 'Payez la totalité de la scolarité. Le formulaire s\'ouvre seulement après confirmation par le responsable.')}</div>`;
      } catch (e) {}
      return gate + baseF();
    };
  }

  const at = Math.max(0, ROUTES.findIndex(r => r.id === 'fees-me'));
  ROUTES.splice(at + 1, 0, { id: 'minesup', k: 'ms_menu', perm: 'apply', v: viewMinesup });
  const at2 = ROUTES.findIndex(r => r.id === 'students');
  ROUTES.splice(at2 < 0 ? ROUTES.length : at2 + 1, 0, { id: 'minesup-admin', k: 'ms_admin', perm: 'manage_students', v: viewMinesupAdmin });


  /* ===== Super-administrator desk: accounts, ADI addresses, forms and receipts ===== */
  L.sa_desk = ['Accounts and documents', 'Comptes et documents'];
  ROUTES.splice(Math.max(0, ROUTES.findIndex(r => r.id === 'users')) + 1, 0, { id: 'sa-desk', k: 'sa_desk', perm: '__super', v: viewDesk });
  function viewDesk() {
    if (!me() || me().role !== 'super_admin') return `<div class="note bad">${LBL('Forbidden', 'Accès refusé')}</div>`;
    if (!FORMS.sa) FORMS.sa = { role: 'student', adi: true, q: '', dq: '' };
    const f = FORMS.sa, q = String(f.q || '').toLowerCase(), dq = String(f.dq || '').toLowerCase();
    const users = Object.values(S.users).filter(x => x && (!q || (x.name + ' ' + x.email + ' ' + x.role).toLowerCase().includes(q))).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 80);
    const roles = (typeof roleList === 'function' ? roleList() : ['student', 'applicant', 'lecturer', 'accountant', 'admin']).map(r => [r, typeof roleName === 'function' ? roleName(r) : r]);
    const made = f.made ? `<div class="note"><b>${LBL('Account created', 'Compte créé')}</b><br>${esc(f.made.email)}<br>${LBL('Temporary password: ', 'Mot de passe temporaire : ')}<b>${esc(f.made.temp)}</b><br><span class="small muted">${LBL('Give it to the person. They must change it at first sign-in.', 'Remettez-le à la personne. Elle doit le changer à la première connexion.')}</span></div>` : '';
    const urow = x => [esc(x.name), esc(x.email), esc(x.role), esc(x.status),
      (x.id === SESSION ? '' : `<button class="btn sm ghost" data-a="useract" data-id="${esc(x.id)}" data-s="${x.status === 'active' ? 'suspended' : 'active'}">${x.status === 'active' ? LBL('Deactivate', 'Désactiver') : LBL('Activate', 'Activer')}</button> <button class="btn sm ghost" data-a="pwreset" data-id="${esc(x.id)}">🔑 ${LBL('Reset password', 'Réinitialiser')}</button> <button class="btn sm ghost" data-a="saissue" data-id="${esc(x.id)}">@ ${LBL('ADI email', 'Email ADI')}</button> <button class="btn sm red" data-a="sadel" data-id="${esc(x.id)}">${LBL('Delete', 'Supprimer')}</button>`)];
    const apps = Object.values(S.msapp || {}).filter(a => a && (!dq || (a.name + ' ' + a.ref + ' ' + a.matric).toLowerCase().includes(dq))).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 60);
    const pays = Object.values(S.payments || {}).filter(p => p && p.status === 'confirmed' && (!dq || ((p.payerName || '') + ' ' + (p.ref || '') + ' ' + (p.matric || '')).toLowerCase().includes(dq))).sort((a, b) => (b.confirmedAt || b.at || 0) - (a.confirmedAt || a.at || 0)).slice(0, 60);
    const studs = Object.values(S.students || {}).filter(x => x && (!dq || (x.name + ' ' + x.matric).toLowerCase().includes(dq))).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 60);
    return `<h2>${LBL('Accounts and documents', 'Comptes et documents')}</h2>
    <div class="card gap"><h3>${LBL('Create an account', 'Créer un compte')}</h3><div class="grid g2">${inp('sa.name', LBL('Full name', 'Nom complet'))}${sel('sa.role', LBL('Role', 'Rôle'), roles, { blank: false })}${inp('sa.phone', LBL('Phone', 'Téléphone'), { type: 'tel' })}${inp('sa.email', LBL('Personal email (optional)', 'Email personnel (facultatif)'), { type: 'email' })}</div>
      <label class="small"><input type="checkbox" data-f="sa.adi" ${f.adi ? 'checked' : ''}> ${LBL('Generate an @adiuniversity.com address as the sign-in email', 'Générer une adresse @adiuniversity.com comme identifiant de connexion')}</label>
      <p><button class="btn gold" data-a="sacreate">${LBL('Create account', 'Créer le compte')}</button></p>${made}</div>
    <div class="card gap"><h3>${LBL('Accounts', 'Comptes')}</h3>${inp('sa.q', LBL('Search by name, email or role', 'Rechercher par nom, email ou rôle'))}${table([LBL('Name', 'Nom'), 'Email', LBL('Role', 'Rôle'), LBL('Status', 'Statut'), ''], users.map(urow))}</div>
    <div class="card gap"><h3>${LBL('Forms and receipts', 'Formulaires et reçus')}</h3>${inp('sa.dq', LBL('Search by name, matricule or reference', 'Rechercher par nom, matricule ou référence'))}
      <h4>${LBL('MINESUP applications', 'Demandes MINESUP')}</h4>${apps.length ? table([LBL('Reference', 'Référence'), LBL('Name', 'Nom'), LBL('Status', 'Statut'), ''], apps.map(a => [esc(a.ref || '—'), esc(a.name || ''), esc(a.status || ''), `<button class="btn sm gold" data-a="mspdf" data-id="${esc(a.id)}">${LBL('Download', 'Télécharger')}</button>`])) : `<p class="muted">${LBL('None.', 'Aucune.')}</p>`}
      <h4>${LBL('Payment receipts', 'Reçus de paiement')}</h4>${pays.length ? table([LBL('Student', 'Étudiant'), LBL('Item', 'Objet'), LBL('Amount', 'Montant'), ''], pays.map(p => [esc(p.payerName || p.matric || ''), esc(p.label || p.kind), esc(typeof xaf === 'function' ? xaf(p.amount) : p.amount), `<button class="btn sm gold" data-a="receipt" data-id="${esc(p.id)}">${LBL('Download', 'Télécharger')}</button>`])) : `<p class="muted">${LBL('None.', 'Aucun.')}</p>`}
      <h4>Form B</h4>${table([LBL('Student', 'Étudiant'), 'Matricule', ''], studs.map(x => [esc(x.name), esc(x.matric), `<button class="btn sm ghost" data-a="formb" data-m="${esc(x.matric)}" data-s="1">S1</button> <button class="btn sm ghost" data-a="formb" data-m="${esc(x.matric)}" data-s="2">S2</button>`]))}</div>`;
  }
  ACT.sacreate = async el => {
    const f = FORMS.sa || {}, name = String(f.name || '').trim();
    if (name.length < 3) return focusField('sa.name', LBL('Enter the full name.', 'Saisissez le nom complet.'));
    if (el) el.disabled = true;
    try { const r = await api('/api/admin/users/create', { body: { name, role: f.role || 'student', phone: f.phone || '', email: f.email || '', adiEmail: !!f.adi } }); FORMS.sa = { role: f.role, adi: f.adi, q: f.q, dq: f.dq, made: r }; if (typeof apiSync === 'function') await apiSync(); render(); }
    catch (e) { if (el) el.disabled = false; toast(e.message || 'Error', 1); }
  };
  ACT.sadel = async el => {
    const x = S.users[el.dataset.id]; if (!x || !window.confirm(LBL('Delete the account of ', 'Supprimer le compte de ') + x.name + ' (' + x.email + ') ?')) return;
    try { await api('/api/admin/users/delete', { body: { userId: x.id } }); if (typeof apiSync === 'function') await apiSync(); toast(LBL('Account deleted.', 'Compte supprimé.')); render(); } catch (e) { toast(e.message || 'Error', 1); }
  };
  ACT.saissue = async el => {
    try { const r = await api('/api/mail/issue', { body: { userId: el.dataset.id } }); const m = r.mailbox || {}; toast(LBL('ADI address issued: ', 'Adresse ADI émise : ') + (m.email || m.address || '')); } catch (e) { toast(e.message || 'Error', 1); }
  };

  function blankForm(st, u) {
    return {
      id: uid('ms'), _matric: st.matric,
      certName: st.name, dob: '', pob: '', sex: '', nationality: 'Cameroonian',
      nid: '', phone: u.phone || st.phone || '', email: u.email || '',
      postal: '', gradYear: '', session: '', resultDate: '',
      tDiploma: false, tTranscript: true, tDuplicate: false, tCopy: false,
      reason: 'studies', reasonOther: '', delivery: 'person', destName: '', destAddr: '',
      photos2: false, agree: false, signName: st.name, place: 'Yaoundé',
      declDate: new Date().toISOString().slice(0, 10)
    };
  }
  function formOf(st, u) {
    if (!FORMS.ms || FORMS.ms._matric !== st.matric) FORMS.ms = blankForm(st, u);
    return FORMS.ms;
  }

  function head() {
    return `<p class="ms-kicker">MINESUP · ${LBL('Ministry of Higher Education', 'Ministère de l\'Enseignement Supérieur')}</p><h2>${LBL('Application for HND/BTS transcript or diploma', 'Demande de relevé ou de diplôme HND/BTS')}</h2><p class="muted">${LBL('The form is bilingual. Read every line before you submit. A false declaration may lead to rejection and legal action.', 'Le formulaire est bilingue. Lisez chaque ligne avant l\'envoi. Toute fausse déclaration peut entraîner le rejet et des poursuites.')}</p><div class="note">${LBL('The transcript or diploma cannot be downloaded online. After approval you collect it in person from the office in charge of issuing transcripts. You can download your application form as proof that you applied, and you are notified at each step.', 'Le relevé ou le diplôme ne peut pas être téléchargé en ligne. Après approbation, vous le retirez en personne au service chargé de leur délivrance. Vous pouvez télécharger votre formulaire de demande comme preuve de dépôt, et vous êtes notifié à chaque étape.')}</div>`;
  }
  function criteria() {
    const items = [
      ['You are an ADI student with a portal account, and you give the unique MINESUP matricule from your HND/BTS registration form (like 26SWE0762).', 'Vous êtes étudiant(e) à ADI, avec un compte du portail, et vous indiquez le matricule unique MINESUP de votre fiche d\'inscription HND/BTS (comme 26SWE0762).'],
      ['The qualification is HND or BTS (MINESUP).', 'Le diplôme est le HND ou le BTS (MINESUP).'],
      ['Registration and full tuition for this academic year are paid and confirmed by Finance.', 'L\'inscription et la totalité de la scolarité de cette année sont payées et confirmées par les Finances.'],
      ['You attach a national ID, birth certificate, result slip or success attestation, fee receipt, and two passport photographs.', 'Vous joignez la CNI, l\'acte de naissance, le relevé ou l\'attestation de réussite, le reçu des frais et deux photos d\'identité.'],
      ['A lost document needs a police declaration. A representative needs an authorisation letter.', 'Un document perdu exige une déclaration de police. Un mandataire exige une lettre d\'autorisation.'],
      ['The Registry checks these points before approval.', 'Le service de la scolarité vérifie ces points avant approbation.']
    ];
    return `<div class="note"><b>${LBL('Eligibility', 'Éligibilité')}</b><ul class="ms-criteria">${items.map(x => `<li><span class="ms-dot"></span><span>${esc(x[0])}<br><span class="ms-fr">${esc(x[1])}</span></span></li>`).join('')}</ul></div>`;
  }
  function lock(en, fr, val) {
    return `<div class="fld"><div class="f">${both(en, fr)}</div><div class="ms-lock"><b>${esc(val || '—')}</b></div></div>`;
  }
  function radios(path, options) {
    const cur = fv(path);
    return `<div class="ms-choice">${options.map(o => `<label class="${cur === o[0] ? 'on' : ''}"><input type="radio" name="${esc(path)}" data-f="${path}" data-r="1" value="${esc(o[0])}" ${cur === o[0] ? 'checked' : ''}><span>${both(o[1], o[2])}</span></label>`).join('')}</div>`;
  }
  function ticks(items) {
    return `<div class="ms-choice">${items.map(o => `<label class="${fv(o[0]) ? 'on' : ''}"><input type="checkbox" data-f="${o[0]}" data-r="1" ${fv(o[0]) ? 'checked' : ''}><span>${both(o[1], o[2])}</span></label>`).join('')}</div>`;
  }

  function statusBadge(s) {
    if (s === 'approved') return badge(LBL('Approved', 'Approuvé'), 'ok');
    if (s === 'rejected') return badge(LBL('Rejected', 'Rejeté'), 'bad');
    return badge(LBL('Pending review', 'En examen'), 'warn');
  }
  function history(rows) {
    if (!rows.length) return '';
    return `<h3>${LBL('Your applications', 'Vos demandes')}</h3>` + table(
      [LBL('Reference', 'Référence'), LBL('Date', 'Date'), LBL('Status', 'Statut'), ''],
      rows.map(a => [esc(a.ref || '—'), fmtD(a.at), statusBadge(a.status) + (a.remark ? `<div class="small">${esc(a.remark)}</div>` : ''), `<button class="btn sm gold" data-a="mspdf" data-id="${esc(a.id)}">${LBL('Download', 'Télécharger')}</button>`])
    );
  }


  let DIR = null, DIRBUSY = false;
  function loadDir() {
    if (DIR || DIRBUSY) return; DIRBUSY = true;
    api('/api/minesup/directory').then(d => { DIR = d.students || []; DIRBUSY = false; render(); }).catch(() => { DIR = []; DIRBUSY = false; });
  }
  function msNoCard(withAdi) {
    loadDir();
    const list = DIR || [], pick = (FORMS.msc && FORMS.msc.pick) || '';
    const opts = list.map(x => `<option value="${esc(x.matric)}" ${pick === x.matric ? 'selected' : ''}>${esc(x.name)} — ADI ${esc(x.matric)}${x.msNo ? ' — MINESUP ' + esc(x.msNo) : ''}</option>`).join('');
    return `<div class="card gap ms-pop"><h3>${LBL('Step 2 — Verify your identity', 'Étape 2 — Vérifiez votre identité')}</h3>
      <p class="muted">${withAdi ? LBL('This account stays independent: it is not linked to any other account. Your name here must match the name on the ADI student record and on the MINESUP list.', 'Ce compte reste indépendant : il n\'est lié à aucun autre compte. Votre nom doit correspondre à celui du dossier ADI et de la liste du MINESUP.') : ''}</p>
      <div class="fld"><label class="f" for="ms-pick">${LBL('Cannot remember your matricules? Select your name', 'Matricules oubliés ? Sélectionnez votre nom')}</label><select id="ms-pick" data-f="msc.pick"><option value="">${list.length ? LBL('— Select your name —', '— Sélectionnez votre nom —') : LBL('Loading the list…', 'Chargement de la liste…')}</option>${opts}</select></div>
      ${inp('msc.matric', LBL('ADI matricule number', 'Matricule ADI'), { ph: 'ADI/ACC/HND/25/001' })}
      ${inp('msc.msNo', LBL('Unique HND/BTS matricule assigned by MINESUP', 'Matricule unique HND/BTS attribué par le MINESUP'), { ph: '26ABC1234' })}
      <p class="small muted">${LBL('The MINESUP number is printed on your HND/BTS registration form (for example 26SWE0762: year, field code, number). Both numbers must belong to the same person. Choosing your name above fills both fields.', 'Le numéro MINESUP figure sur votre fiche d\'inscription HND/BTS (par exemple 26SWE0762 : année, code de filière, numéro). Les deux numéros doivent appartenir à la même personne. Le choix de votre nom remplit les deux champs.')}</p>
      <button class="btn gold ms-cta" data-a="msclear">${LBL('Verify', 'Vérifier')}</button></div>`;
  }
  document.addEventListener('change', e => {
    const el = e.target; if (!el || !el.dataset || el.dataset.f !== 'msc.pick') return;
    const x = (DIR || []).find(r => r.matric === el.value); if (!FORMS.msc) FORMS.msc = {};
    FORMS.msc.pick = el.value; FORMS.msc.matric = x ? x.matric : ''; FORMS.msc.msNo = x ? x.msNo : '';
    const a = document.querySelector('[data-f="msc.matric"]'), b = document.querySelector('[data-f="msc.msNo"]');
    if (a) a.value = FORMS.msc.matric; if (b) b.value = FORMS.msc.msNo;
  });
  function ownGate(u) {
    const fr = LANG === 'fr';
    if (typeof servicePaid === 'function' && !servicePaid(u)) {
      setTimeout(() => { if (typeof go === 'function') go('service-fee'); }, 60);
      return head() + `<div class="note bad">${LBL('The service fee of 2,000 XAF must be paid and confirmed first. Opening the service-fee page.', 'Les frais de service de 2 000 XAF doivent d\'abord être payés et confirmés. Ouverture de la page des frais de service.')}</div>`;
    }
    const c = clearFor(u);
    if (!c) { loadClear(); return head() + `<div class="card">${LBL('Checking your clearance…', 'Vérification de votre situation…')}</div>`; }
    if (c.error) return head() + `<div class="note bad">${LBL('Could not check your clearance. Try again.', 'Vérification impossible. Réessayez.')}</div><p><button class="btn" data-a="msrecheck">${LBL('Try again', 'Réessayer')}</button></p>`;
    if (!c.student) {
      if (!FORMS.msc) FORMS.msc = { matric: '' };
      return head() + criteria() + msNoCard(true);
    }
    if (!c.msOk) { if (!FORMS.msc) FORMS.msc = { matric: '' }; return head() + criteria() + msNoCard(false); }
    if (!c.cleared) return head() + feePanel(c);
    return '';
  }
  const money = n => (typeof xaf === 'function' ? xaf(n) : Number(n).toLocaleString('en') + ' XAF');
  function feePanel(c) {
    const f = c.fee || {}, st = c.student || {}, pay = f.pay, momo = (typeof cfg === 'function' ? cfg().momo : '') || '';
    const done = f.balance <= 0;
    let h = `<div class="card gap ms-pop"><h3>${LBL('Step 3 — Tuition status', 'Étape 3 — Situation de scolarité')}</h3>
      <p><b>${esc(st.name || '')}</b> · ADI ${esc(st.adi || st.matric || '')} · MINESUP ${esc(c.msNo || '')}</p>
      <div class="ms-fee"><div><span>${LBL('Official tuition', 'Scolarité officielle')}</span><b>${money(f.total || 0)}</b></div><div><span>${LBL('Paid and confirmed', 'Payé et confirmé')}</span><b>${money(f.paid || 0)}</b></div><div><span>${LBL('Outstanding balance', 'Solde restant')}</span><b class="${done ? 'ms-pass' : 'ms-fail'}">${money(f.balance || 0)}</b></div></div>`;
    if (f.exempt) h += `<p class="small muted">${LBL('Level 2 student: exempt from registration, T-shirt and bank-account fees.', 'Étudiant de niveau 2 : exonéré des frais d\'inscription, de T-shirt et de compte bancaire.')}</p>`;
    if (done && !pay) h += `<div class="note">${LBL('Your tuition is complete. Press Continue to open the application form.', 'Votre scolarité est complète. Appuyez sur Continuer pour ouvrir le formulaire.')}</div><p><button class="btn gold" data-a="msrecheck">${LBL('Continue', 'Continuer')}</button></p>`;
    else {
      h += `<div class="note bad">${done ? LBL('Tuition is complete, but one charge is still due before the form opens.', 'La scolarité est complète, mais un frais reste dû avant l\'ouverture du formulaire.') : LBL('Your tuition is not complete. The application form is locked until the balance is paid and confirmed by the Finance Office.', 'Votre scolarité n\'est pas complète. Le formulaire reste verrouillé jusqu\'au paiement et à la confirmation du solde par le service des Finances.')}</div>`;
      if (pay && pay.pending) h += `<div class="note">${LBL('Your payment of ', 'Votre paiement de ')}<b>${money(pay.amount)}</b>${LBL(' is waiting for verification by the accountant. You will be notified here as soon as it is confirmed.', ' attend la vérification du comptable. Vous serez notifié ici dès sa confirmation.')}</div><p><button class="btn" data-a="msrecheck">${LBL('Check again', 'Vérifier à nouveau')}</button></p>`;
      else if (pay) {
        h += `<h4>${LBL('Pay now: ', 'Payer maintenant : ')}${esc(pay.kind === 'platform' ? LBL('Platform charge', 'Frais de plateforme') : pay.kind === 'tuition_balance' ? LBL('Outstanding tuition balance', 'Solde de scolarité restant') : pay.label)} — ${money(pay.amount)}</h4>
        <p>${LBL('Send exactly this amount by Mobile Money to ', 'Envoyez exactement ce montant par Mobile Money au ')}<b class="ms-momo">${esc(momo)}</b>${LBL('. Then enter the transaction ID from the confirmation message.', '. Puis saisissez l\'identifiant de transaction du message de confirmation.')}</p>
        ${inp('msp.ref', LBL('MoMo transaction ID', 'Identifiant de transaction MoMo'), { ph: 'e.g. 1234567890' })}${inp('msp.phone', LBL('Phone number used to pay', 'Numéro utilisé pour payer'), { ph: '6XXXXXXXX', type: 'tel' })}
        <p><button class="btn gold" data-a="mspay">${LBL('Submit payment for verification', 'Soumettre le paiement pour vérification')}</button></p>`;
      }
    }
    return h + `</div>`;
  }
  ACT.mspay = async el => {
    const c = clearFor(me()) || {}, f = c.fee || {}, pay = f.pay, w = FORMS.msp || {};
    if (!pay || !c.student) return;
    const ref = String(w.ref || '').trim(), phone = String(w.phone || '').trim();
    if (ref.length < 6) return focusField('msp.ref', LBL('Enter the MoMo transaction ID (at least 6 characters).', 'Saisissez l\'identifiant de transaction MoMo (6 caractères minimum).'));
    if (phone.length < 8) return focusField('msp.phone', LBL('Enter the phone number you paid from.', 'Saisissez le numéro utilisé pour payer.'));
    if (el) el.disabled = true;
    try {
      const id = uid('pay');
      await api('/api/doc/payments/' + id, { method: 'PUT', body: { id, userId: me().id, matric: c.student.matric, kind: pay.kind, label: pay.label, amount: pay.amount, ref, payerPhone: phone, status: 'pending', momoTo: (typeof cfg === 'function' ? cfg().momo : '') } });
      FORMS.msp = {}; toast(LBL('Payment sent. The accountant will verify it and notify you.', 'Paiement envoyé. Le comptable le vérifiera et vous notifiera.')); if (typeof apiSync === 'function') await apiSync(); CLEAR = null; render();
    } catch (e) { if (el) el.disabled = false; const m = e.message || LBL('Could not send the payment', 'Envoi impossible'); focusField('msp.ref', m); toast(m, 1); }
  };
  ACT.msrecheck = () => { CLEAR = null; render(); };
  ACT.msclear = async el => {
    const f = FORMS.msc || {}, own = isOwn(me()), c = clearFor(me()) || {};
    const m = String(f.matric || '').trim(), no = String(f.msNo || '').trim();
    if (!no) return focusField('msc.msNo', LBL('Enter the unique HND/BTS matricule from your MINESUP registration form.', 'Indiquez le matricule unique HND/BTS de votre fiche d\'inscription MINESUP.'));
    if (el) el.disabled = true;
    try {
      const d = await api('/api/minesup/clearance', { body: { matric: m, msNo: no } });
      CLEAR = Object.assign({ _for: me().id }, d); FORMS.msc = { matric: '', msNo: '' }; render();
    } catch (e) {
      if (el) el.disabled = false;
      const msg = e.code === 'service_fee' ? LBL('Pay the service fee first.', 'Payez d\'abord les frais de service.') : (e.message || LBL('Could not verify', 'Vérification impossible'));
      focusField('msc.msNo', msg); toast(msg, 1);
    }
  };

  function viewMinesup() {
    const u = me();
    if (!u) return `<h2>MINESUP</h2><div class="note">${LBL('Create an ADI portal account and sign in. Only ADI students can apply.', 'Créez un compte sur le portail ADI et connectez-vous. Seuls les étudiants ADI peuvent postuler.')}</div><p><a class="btn" href="#/login">${LBL('Sign in', 'Connexion')}</a> <a class="btn ghost" href="#/signup">${LBL('Create account', 'Créer un compte')}</a></p>`;
    if (isOwn(u)) { const g = ownGate(u); if (g) return g; }
    else if (u.role !== 'student') {
      return head() + `<div class="note">${LBL('This application is only for ADI students.', 'Cette demande est réservée aux étudiants ADI.')}</div>` + (can('manage_students') ? `<p><a class="btn" href="#/minesup-admin">${LBL('Review applications', 'Examiner les demandes')}</a></p>` : '');
    }
    const st = stOf(u);
    if (!st) return head() + `<div class="note bad">${LBL('Your account is not linked to a student record. Ask the Registry to link your account to your student record.', 'Votre compte n\'est pas lié à un dossier étudiant. Demandez à la scolarité de lier votre compte à votre dossier étudiant.')}</div>`;
    if (!levelOk(st)) return head() + `<div class="note bad">${LBL('This MINESUP form is only for HND and BTS students. Your programme is ', 'Ce formulaire MINESUP est réservé au HND et au BTS. Votre programme est ')}${esc(st.level)}.</div>`;
    if (!tuitionOk(st)) { hopFees(); return head() + `<div class="note bad">${LBL('Full tuition is not yet confirmed. You are being taken to the fees page.', 'La scolarité complète n\'est pas encore confirmée. Vous êtes dirigé vers la page des frais.')}</div>`; }
    const rows = mine();
    const waiting = rows.find(a => a.status === 'submitted');
    let h = head() + criteria();
    h += history(rows);
    if (waiting) {
      h += `<div class="card gap ms-pop"><h3>${esc(waiting.ref)}</h3><p>${statusBadge('submitted')}</p><p class="muted">${LBL('The Registry is checking your eligibility. You can download the form you submitted.', 'La scolarité vérifie votre éligibilité. Vous pouvez télécharger le formulaire envoyé.')}</p><button class="btn gold" data-a="mspdf" data-id="${esc(waiting.id)}">${LBL('Download application', 'Télécharger la demande')}</button></div>`;
      return h;
    }
    if (rows.some(a => a.status === 'approved') && !FORMS.msNew) {
      h += `<div class="card gap"><p class="muted">${LBL('Your last application was approved. You may file another request if you need a further copy.', 'Votre dernière demande a été approuvée. Vous pouvez en déposer une autre si vous avez besoin d\'une copie supplémentaire.')}</p><button class="btn" data-a="msnew">${LBL('New application', 'Nouvelle demande')}</button></div>`;
      return h;
    }
    h += editor(st, u);
    return h;
  }

  function editor(st, u) {
    formOf(st, u);
    const spec = (typeof progName === 'function' ? progName(st.specId) : st.specId);
    const f = FORMS.ms;
    return `<div class="ms-paper"><form class="ms-form" onsubmit="return false">
      <section class="ms-sec"><h3><span class="ms-num">A</span> ${both('Personal information', 'Informations personnelles')}</h3>
        <div class="grid g2">${lock('Full name on the student record', 'Nom au dossier', st.name)}${inp('ms.certName', both('Full name as on the certificate', 'Nom et prénoms tels qu\'ils figurent sur le diplôme'))}${inp('ms.dob', both('Date of birth', 'Date de naissance'), { type: 'date' })}${inp('ms.pob', both('Place of birth', 'Lieu de naissance'))}${sel('ms.sex', both('Sex', 'Sexe'), [['F', LBL('Female', 'Féminin')], ['M', LBL('Male', 'Masculin')]], { blank: false })}${inp('ms.nationality', both('Nationality', 'Nationalité'))}${inp('ms.nid', both('National ID number', 'Numéro de la carte nationale d\'identité'))}${inp('ms.phone', both('Telephone or WhatsApp', 'Téléphone ou WhatsApp'), { type: 'tel' })}${inp('ms.email', both('Email address', 'Adresse électronique'), { type: 'email' })}${inp('ms.postal', both('Postal address', 'Adresse postale'))}</div>
      </section>
      <section class="ms-sec"><h3><span class="ms-num">B</span> ${both('Academic information', 'Informations académiques')}</h3>
        <div class="grid g2">${lock('Qualification', 'Diplôme', st.level)}${lock('Specialty or option', 'Spécialité ou option', spec)}${lock('Institution', 'Établissement', 'American Ditek Institute (ADI University)')}${lock('MINESUP matricule (HND/BTS)', 'Matricule MINESUP (HND/BTS)', (clearFor(u) || {}).msNo || '')}${inp('ms.gradYear', both('Academic year of graduation', 'Année d\'obtention'), { type: 'number', ph: String(new Date().getFullYear()) })}${inp('ms.session', both('Examination session', 'Session d\'examen'), { ph: 'June 2026 / Juin 2026' })}${inp('ms.resultDate', both('Date of result publication', 'Date de publication des résultats'), { type: 'date' })}</div>
      </section>
      <section class="ms-sec"><h3><span class="ms-num">1</span> ${both('Type of request', 'Type de demande')}</h3>
        ${ticks([['ms.tDiploma', 'Diploma', 'Diplôme'], ['ms.tTranscript', 'Transcript', 'Relevé de notes'], ['ms.tDuplicate', 'Duplicate', 'Duplicata'], ['ms.tCopy', 'Certified true copy', 'Copie certifiée conforme']])}
      </section>
      <section class="ms-sec"><h3><span class="ms-num">C</span> ${both('Reason for the request', 'Motif de la demande')}</h3>
        ${radios('ms.reason', [['first', 'First issue', 'Première délivrance'], ['lost', 'Lost document', 'Document perdu'], ['damaged', 'Damaged document', 'Document endommagé'], ['studies', 'Further studies', 'Poursuite d\'études'], ['job', 'Employment', 'Emploi'], ['other', 'Other', 'Autre']])}
        ${f.reason === 'other' ? inp('ms.reasonOther', both('Specify', 'Préciser')) : ''}
      </section>
      <section class="ms-sec"><h3><span class="ms-num">D</span> ${both('Delivery', 'Modalités de remise')}</h3>
        ${radios('ms.delivery', [['person', 'Collect in person', 'Retrait en personne'], ['rep', 'Authorised representative', 'Retrait par un mandataire'], ['school', 'Send to an institution', 'Envoi à un établissement']])}
        ${f.delivery === 'school' ? `<div class="grid g2">${inp('ms.destName', both('Institution name', 'Nom de l\'établissement'))}${inp('ms.destAddr', both('Institution address', 'Adresse de l\'établissement'))}</div>` : ''}
      </section>
      <section class="ms-sec" id="ms-docs"><h3><span class="ms-num">E</span> ${both('Documents attached', 'Pièces jointes')}</h3>
        <p class="small muted">${LBL('Choose the document type, then upload a PDF or a clear photo (JPG, PNG). Two passport photographs may be one scan.', 'Choisissez le type de pièce, puis envoyez un PDF ou une photo nette (JPG, PNG). Les deux photos d\'identité peuvent être sur un seul scan.')}</p>
        ${fileBox('ms:' + f.id, { edit: true, types: true })}
        ${chk('ms.photos2', both('I attach two passport photographs', 'Je joins deux photos d\'identité'))}
      </section>
      <section class="ms-sec"><h3><span class="ms-num">F</span> ${both('Declaration', 'Déclaration du demandeur')}</h3>
        <p class="small">${LBL('I certify that the information above is accurate and complete. I understand that any false declaration may result in rejection and legal action.', 'Je certifie que les informations ci-dessus sont exactes et complètes. Je reconnais que toute fausse déclaration peut entraîner le rejet de la demande et des poursuites judiciaires.')}</p>
        <div class="grid g2">${inp('ms.declDate', both('Date', 'Date'), { type: 'date' })}${inp('ms.place', both('Place', 'Lieu'))}${inp('ms.signName', both('Signature (type your full name)', 'Signature (saisissez votre nom complet)'))}</div>
        ${chk('ms.agree', both('I accept this declaration', 'J\'accepte cette déclaration'))}
      </section>
      <p class="row gap"><button class="btn gold ms-cta" data-a="msask">${LBL('Review and submit', 'Vérifier et envoyer')}</button></p>
    </form></div>`;
  }

  function payload(st) {
    const f = FORMS.ms;
    return {
      userId: me().id, matric: st.matric, status: 'submitted',
      certName: f.certName, dob: f.dob, pob: f.pob, sex: f.sex, nationality: f.nationality,
      nid: f.nid, phone: f.phone, email: f.email, postal: f.postal,
      gradYear: String(f.gradYear || ''), session: f.session, resultDate: f.resultDate,
      types: { diploma: !!f.tDiploma, transcript: !!f.tTranscript, duplicate: !!f.tDuplicate, copy: !!f.tCopy },
      reason: f.reason, reasonOther: f.reasonOther || '', delivery: f.delivery,
      destName: f.destName || '', destAddr: f.destAddr || '',
      photos2: !!f.photos2, agree: !!f.agree, signName: f.signName, place: f.place, declDate: f.declDate
    };
  }
  let BAD = '';
  function clientError(st) {
    BAD = '';
    const p = payload(st), id = FORMS.ms.id;
    const bad = (field, en, fr) => { BAD = field; return LBL(en, fr); };
    if (!p.types.diploma && !p.types.transcript && !p.types.duplicate && !p.types.copy) return bad('ms.tTranscript', 'Choose at least one document.', 'Cochez au moins un document.');
    const personal = [['certName', 'Enter the full name as on the certificate.', 'Indiquez le nom tel qu\'il figure sur le diplôme.'], ['dob', 'Enter the date of birth.', 'Indiquez la date de naissance.'], ['pob', 'Enter the place of birth.', 'Indiquez le lieu de naissance.'], ['sex', 'Choose the sex.', 'Choisissez le sexe.'], ['nationality', 'Enter the nationality.', 'Indiquez la nationalité.'], ['nid', 'Enter the national ID number.', 'Indiquez le numéro de la CNI.'], ['phone', 'Enter a telephone number.', 'Indiquez un numéro de téléphone.'], ['email', 'Enter an email address.', 'Indiquez une adresse électronique.'], ['postal', 'Enter the postal address.', 'Indiquez l\'adresse postale.']];
    for (const x of personal) if (!p[x[0]]) return bad('ms.' + x[0], x[1], x[2]);
    if (!/^\S+@\S+\.\S+$/.test(p.email)) return bad('ms.email', 'That email address is not valid.', 'Cette adresse électronique n\'est pas valable.');
    if (!/^\d{4}$/.test(p.gradYear)) return bad('ms.gradYear', 'Enter the four-digit year of graduation.', 'Indiquez l\'année d\'obtention sur quatre chiffres.');
    if (!p.session) return bad('ms.session', 'Enter the examination session.', 'Indiquez la session d\'examen.');
    if (!p.resultDate) return bad('ms.resultDate', 'Enter the date the results were published.', 'Indiquez la date de publication des résultats.');
    if (p.reason === 'other' && !(p.reasonOther || '').trim()) return bad('ms.reasonOther', 'Specify the other reason.', 'Précisez le motif.');
    if (p.delivery === 'school' && !(p.destName || '').trim()) return bad('ms.destName', 'Enter the institution name.', 'Indiquez le nom de l\'établissement.');
    if (p.delivery === 'school' && !(p.destAddr || '').trim()) return bad('ms.destAddr', 'Enter the institution address.', 'Indiquez l\'adresse de l\'établissement.');
    if (!p.photos2) return bad('ms.photos2', 'Confirm the two passport photographs.', 'Confirmez les deux photos d\'identité.');
    const docs = [['id', 'the national ID'], ['birth', 'the birth certificate'], ['results', 'the result slip or success attestation'], ['receipt', 'the fee receipt'], ['photo', 'a passport photograph']];
    const miss = docs.filter(d => !hasD(id, d[0]));
    if (miss.length) { BAD = '#ms-docs'; return LBL('Upload ' + miss.map(d => d[1]).join(', ') + '. Set the correct document type on each file.', 'Envoyez la CNI, l\'acte de naissance, le relevé, le reçu des frais et une photo d\'identité, avec le bon type pour chaque fichier.'); }
    if (p.reason === 'lost' && !hasD(id, 'police')) { BAD = '#ms-docs'; return LBL('Upload the police loss declaration.', 'Envoyez la déclaration de perte.'); }
    if (p.delivery === 'rep' && !hasD(id, 'auth')) { BAD = '#ms-docs'; return LBL('Upload the authorisation letter.', 'Envoyez la lettre d\'autorisation.'); }
    if (!p.declDate) return bad('ms.declDate', 'Enter the declaration date.', 'Indiquez la date de la déclaration.');
    if (!p.place) return bad('ms.place', 'Enter the place of declaration.', 'Indiquez le lieu de la déclaration.');
    if (!p.signName) return bad('ms.signName', 'Type your full name as your signature.', 'Saisissez votre nom complet comme signature.');
    if (!p.agree) return bad('ms.agree', 'Accept the declaration.', 'Acceptez la déclaration.');
    return '';
  }
  function jumpToBad(err) {
    if (BAD && BAD.charAt(0) === '#') { const el = document.querySelector(BAD); if (el) { el.classList.add('fld-bad'); try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {} } }
    else if (BAD && typeof focusField === 'function') focusField(BAD, err);
  }
  function summary(st) {
    const p = payload(st);
    const docs = ['diploma', 'transcript', 'duplicate', 'copy'].filter(k => p.types[k]).join(', ');
    const rows = [
      ['Name / Nom', p.certName], ['MINESUP matricule', (clearFor(me()) || {}).msNo || ''], ['Programme', st.level + ' — ' + progName(st.specId)],
      ['Documents', docs], ['Reason / Motif', p.reason], ['Delivery / Remise', p.delivery],
      ['Phone / Téléphone', p.phone], ['Email', p.email]
    ];
    return `<ul class="ms-criteria">${rows.map(r => `<li><span class="ms-dot"></span><span><b>${esc(r[0])}:</b> ${esc(r[1])}</span></li>`).join('')}</ul>`;
  }

  ACT.msnew = () => { FORMS.msNew = true; FORMS.ms = null; render(); };
  ACT.msask = () => {
    const u = me(), st = u && stOf(u);
    if (!st || !tuitionOk(st)) { hopFees(); return; }
    const err = clientError(st);
    if (err) { jumpToBad(err); return toast(err, 1); }
    confirmBox({
      title: LBL('Proofread before final submission', 'Relisez avant l\'envoi définitif'),
      warn: LBL('Check every name, date and document. After you submit, this application cannot be edited. A false declaration may cause rejection and legal action.', 'Vérifiez chaque nom, date et pièce. Après l\'envoi, cette demande ne pourra plus être modifiée. Toute fausse déclaration peut entraîner le rejet et des poursuites judiciaires.'),
      body: summary(st),
      action: 'mssubmit',
      ok: LBL('Submit application', 'Envoyer la demande')
    });
    const box = document.querySelector('#cfm .box');
    if (box) box.classList.add('ms-pop');
  };
  ACT.mssubmit = async el => {
    const u = me(), st = u && stOf(u);
    if (!st) return;
    if (el) { el.disabled = true; el.textContent = '…'; }
    const id = FORMS.ms.id;
    try {
      await api('/api/doc/msapp/' + encodeURIComponent(id), { method: 'PUT', body: payload(st) });
      FORMS.ms = null; FORMS.msNew = false;
      closeCfm();
      await apiSync();
      toast(LBL('Application submitted. Download your copy below.', 'Demande envoyée. Téléchargez votre copie ci-dessous.'));
      render();
    } catch (e) {
      if (el) { el.disabled = false; el.textContent = LBL('Submit application', 'Envoyer la demande'); }
      toast(e.message || LBL('Could not submit', 'Envoi impossible'), 1);
    }
  };

  const REASON_L = { first: ['First issue', 'Première délivrance'], lost: ['Lost document', 'Document perdu'], damaged: ['Damaged document', 'Document endommagé'], studies: ['Further studies', 'Poursuite d\'études'], job: ['Employment', 'Emploi'], other: ['Other', 'Autre'] };
  const DELIV_L = { person: ['Collect in person', 'Retrait en personne'], rep: ['Authorised representative', 'Mandataire autorisé'], school: ['Send to an institution', 'Envoi à un établissement'] };
  const TYPE_L = { diploma: ['Diploma', 'Diplôme'], transcript: ['Transcript', 'Relevé de notes'], duplicate: ['Duplicate', 'Duplicata'], copy: ['Certified true copy', 'Copie certifiée conforme'] };

  function auditApp(a) {
    const st = S.students[a.matric];
    const has = k => hasD(a.id, k);
    const checks = [
      [!!(st && (st.userId || a.msNo)), LBL('ADI student record confirmed', 'Dossier étudiant ADI confirmé')],
      [!!a.msNo, LBL('MINESUP matricule verified on the official list: ', 'Matricule MINESUP vérifié sur la liste officielle : ') + (a.msNo || '—')],
      [levelOk(a) || levelOk(st), LBL('HND or BTS qualification', 'Diplôme HND ou BTS')],
      [!!(st && tuitionOk(st)), LBL('Full tuition paid and confirmed', 'Scolarité intégralement payée et confirmée')],
      [has('id'), LBL('National ID', 'CNI')],
      [has('birth'), LBL('Birth certificate', 'Acte de naissance')],
      [has('results'), LBL('Result slip or success attestation', 'Relevé ou attestation de réussite')],
      [has('receipt'), LBL('Receipt of complete fees', 'Reçu des frais complets')],
      [has('photo'), LBL('Passport photograph', 'Photo d\'identité')],
      [a.reason !== 'lost' || has('police'), LBL('Police declaration (if lost)', 'Déclaration de police (si perte)')],
      [a.delivery !== 'rep' || has('auth'), LBL('Authorisation (if a representative collects)', 'Autorisation (si mandataire)')]
    ];
    return { st, checks, ok: checks.every(c => c[0]) };
  }

  function viewMinesupAdmin() {
    if (PARAM && S.msapp[PARAM]) return oneAdmin(S.msapp[PARAM]);
    const rows = Object.values(S.msapp || {}).filter(Boolean).sort((a, b) => (b.at || 0) - (a.at || 0));
    let h = `<p class="ms-kicker">MINESUP</p><h2>${LBL('Transcript and diploma applications', 'Demandes de relevé et de diplôme')}</h2><p class="muted">${LBL('Approve only when every eligibility point below is met. The PDF carries the ADI round seal on each page.', 'N\'approuvez que si chaque point d\'éligibilité est rempli. Le PDF porte le sceau rond ADI sur chaque page.')}</p>`;
    if (!rows.length) return h + `<div class="note">${LBL('No applications yet.', 'Aucune demande pour le moment.')}</div>` + rosterCard();
    h += table(
      [LBL('Reference', 'Référence'), LBL('Student', 'Étudiant'), LBL('Programme', 'Programme'), LBL('Status', 'Statut'), ''],
      rows.map(a => {
        const au = auditApp(a);
        return [esc(a.ref || '—'), esc(a.name) + `<div class="small muted">${esc(a.matric)}</div>`, esc(a.level), statusBadge(a.status) + `<div class="small">${au.ok ? '<span class="ms-pass">✓</span>' : '<span class="ms-fail">!</span>'} ${LBL('eligibility', 'éligibilité')}`, `<a class="btn sm" href="#/minesup-admin/${esc(a.id)}">${LBL('Open', 'Ouvrir')}</a> <button class="btn sm ghost" data-a="mspdf" data-id="${esc(a.id)}">PDF</button>`];
      })
    );
    return h + rosterCard();
  }
  /* The official MINESUP HND/BTS matricule list: the second proof. The super administrator can replace it. */
  let ROSTER = null;
  function rosterCard() {
    const sa = me() && me().role === 'super_admin';
    if (!ROSTER) { ROSTER = { list: [], custom: false, loading: true }; api('/api/minesup/roster').then(d => { ROSTER = d; render(); }).catch(() => { ROSTER = { list: [], custom: false, err: true }; render(); }); }
    const dup = {}; (ROSTER.list || []).forEach(r => { dup[r.no] = (dup[r.no] || 0) + 1; });
    const rows = (ROSTER.list || []).map(r => [esc(r.no) + (dup[r.no] > 1 ? ` <span class="ms-fail" title="${esc(LBL('Same number given to two candidates', 'Même numéro attribué à deux candidats'))}">⚠</span>` : ''), esc(r.name), esc(r.level || ''), esc(r.field || ''), r.mark == null ? '' : esc(String(r.mark))]);
    if (!FORMS.msr) FORMS.msr = { text: '' };
    return `<div class="card gap"><p class="ms-kicker">MINESUP</p><h3>${LBL('Official MINESUP HND/BTS matricule list', 'Liste officielle des matricules HND/BTS du MINESUP')} (${(ROSTER.list || []).length})</h3>
      <p class="muted">${LBL('A candidate must give the unique MINESUP matricule from the registration form. It must be on this list, under the same name as the ADI student record.', 'Le candidat doit donner le matricule unique MINESUP de sa fiche d\'inscription. Il doit figurer sur cette liste, sous le même nom que le dossier étudiant ADI.')}</p>
      ${rows.length ? table([LBL('MINESUP matricule', 'Matricule MINESUP'), LBL('Name', 'Nom'), LBL('Level', 'Niveau'), LBL('Field', 'Filière'), LBL('Mark', 'Note')], rows) : ''}
      ${sa ? `<p class="small muted gap">${LBL('To replace the list, paste one candidate per line: matricule; name; level; field; mark. Example: 26SWE0762; NANSOU NCHIMIE CHARLY JUNIOR; HND; SWE; 18.5', 'Pour remplacer la liste, collez un candidat par ligne : matricule ; nom ; niveau ; filière ; note. Exemple : 26SWE0762 ; NANSOU NCHIMIE CHARLY JUNIOR ; HND ; SWE ; 18,5')}</p>${area('msr.text', LBL('New list', 'Nouvelle liste'))}
      <div class="row gap"><button class="btn" data-a="msrsave">${LBL('Replace the list', 'Remplacer la liste')}</button>${ROSTER.custom ? `<button class="btn ghost" data-a="msrreset">${LBL('Restore the built-in list', 'Rétablir la liste d\'origine')}</button>` : ''}</div>` : ''}</div>`;
  }
  const rosterPost = (body, ok) => api('/api/minesup/roster', { body }).then(d => { ROSTER = d; FORMS.msr = { text: '' }; toast(ok); render(); }).catch(e => toast(e.message || 'Error', 1));
  ACT.msrsave = () => { const t = String((FORMS.msr || {}).text || '').trim(); if (!t) return focusField('msr.text', LBL('Paste the list first.', 'Collez d\'abord la liste.')); rosterPost({ text: t.replace(/(\d),(\d)(?=\s*$)/gm, '$1.$2') }, LBL('List replaced.', 'Liste remplacée.')); };
  ACT.msrreset = () => rosterPost({ reset: true }, LBL('Built-in list restored.', 'Liste d\'origine rétablie.'));
  function oneAdmin(a) {
    const au = auditApp(a);
    if (!FORMS.msad || FORMS.msad.id !== a.id) FORMS.msad = { id: a.id, remark: a.remark || '', title: a.endorsedTitle || 'Administrative Director / Directeur administratif', elig: false };
    const types = Object.keys(a.types || {}).filter(k => a.types[k]).map(k => (TYPE_L[k] ? TYPE_L[k][LANG === 'fr' ? 1 : 0] : k)).join(', ');
    const reason = REASON_L[a.reason] ? REASON_L[a.reason][LANG === 'fr' ? 1 : 0] : a.reason;
    const deliv = DELIV_L[a.delivery] ? DELIV_L[a.delivery][LANG === 'fr' ? 1 : 0] : a.delivery;
    let h = `<p><a href="#/minesup-admin">← ${LBL('All applications', 'Toutes les demandes')}</a></p>`;
    h += `<p class="ms-kicker">${esc(a.ref || '')}</p><h2>${esc(a.certName || a.name)}</h2><p>${statusBadge(a.status)} · ${esc(a.matric)} · ${esc(a.level)}</p>`;
    h += `<div class="card"><h3>${LBL('Eligibility', 'Éligibilité')}</h3><ul class="ms-criteria">${au.checks.map(c => `<li><span class="${c[0] ? 'ms-pass' : 'ms-fail'}">${c[0] ? '✓' : '✕'}</span><span>${esc(c[1])}</span></li>`).join('')}</ul></div>`;
    h += `<div class="card gap"><h3>${LBL('Application', 'Demande')}</h3><div class="grid g2">
      ${lock('Certificate name', 'Nom sur le diplôme', a.certName)}${lock('Born', 'Naissance', (a.dob || '') + ' · ' + (a.pob || ''))}
      ${lock('Sex / Nationality', 'Sexe / Nationalité', (a.sex || '') + ' · ' + (a.nationality || ''))}${lock('National ID', 'CNI', a.nid)}
      ${lock('Phone', 'Téléphone', a.phone)}${lock('Email', 'Email', a.email)}
      ${lock('Postal address', 'Adresse postale', a.postal)}${lock('Specialty', 'Spécialité', progName(a.specId))}
      ${lock('Graduation year', 'Année d\'obtention', a.gradYear)}${lock('Session', 'Session', a.session)}
      ${lock('Results published', 'Résultats publiés', a.resultDate)}${lock('Request', 'Demande', types)}
      ${lock('Reason', 'Motif', reason + (a.reason === 'other' ? ' — ' + (a.reasonOther || '') : ''))}${lock('Delivery', 'Remise', deliv)}
      ${lock('Signature', 'Signature', a.signName)} ${lock('Declared at', 'Déclaré à', (a.place || '') + ' · ' + (a.declDate || ''))}
    </div>${a.delivery === 'school' ? `<p><b>${esc(a.destName || '')}</b> — ${esc(a.destAddr || '')}</p>` : ''}</div>`;
    h += `<div class="card gap"><h3>${LBL('Attachments', 'Pièces jointes')}</h3>${fileBox('ms:' + a.id, { edit: false, types: true })}</div>`;
    h += `<p><button class="btn gold" data-a="mspdf" data-id="${esc(a.id)}">${LBL('Download stamped form', 'Télécharger le formulaire cacheté')}</button></p>`;
    if (a.status === 'submitted') {
      h += `<div class="card ms-pop"><h3>${LBL('Decision', 'Décision')}</h3>
        ${inp('msad.title', both('Name and title of the endorsing officer', 'Nom et qualité du signataire'))}
        ${inp('msad.remark', both('Remarks', 'Observations'))}
        ${chk('msad.elig', both('I have checked eligibility against the criteria above', 'J\'ai vérifié l\'éligibilité selon les critères ci-dessus'))}
        <div class="ms-admin-bar gap"><button class="btn gold" data-a="msdecide" data-id="${esc(a.id)}" data-s="approved" ${au.ok ? '' : 'disabled'}>${LBL('Approve', 'Approuver')}</button><button class="btn red" data-a="msdecide" data-id="${esc(a.id)}" data-s="rejected">${LBL('Reject', 'Rejeter')}</button></div>
        ${au.ok ? '' : `<p class="small muted">${LBL('Approval stays closed until every eligibility point is met.', 'L\'approbation reste fermée tant qu\'un point d\'éligibilité manque.')}</p>`}
      </div>`;
    } else if (a.verifiedBy) {
      h += `<div class="note ok">${LBL('Decided by', 'Décision de')} ${esc(a.verifiedBy)} · ${fmtDT(a.decisionAt)}</div>`;
    }
    return h;
  }
  ACT.msdecide = async el => {
    const a = S.msapp[el.dataset.id]; if (!a) return;
    const status = el.dataset.s;
    const f = FORMS.msad || {};
    if (status === 'approved' && !f.elig) return toast(LBL('Confirm that you checked eligibility.', 'Confirmez que vous avez vérifié l\'éligibilité.'), 1);
    if (status === 'rejected' && !(f.remark || '').trim()) return toast(LBL('Write a remark before rejecting.', 'Rédigez une observation avant de rejeter.'), 1);
    el.disabled = true;
    const n = Object.assign({}, a, { status, remark: f.remark || '', eligOk: status === 'approved' && !!f.elig, endorsedTitle: f.title || a.endorsedTitle || '', endorsedBy: me().name, verifiedBy: me().name, decisionAt: Date.now() });
    try {
      await api('/api/doc/msapp/' + encodeURIComponent(a.id), { method: 'PUT', body: n });
      await apiSync();
      toast(status === 'approved' ? LBL('Application approved.', 'Demande approuvée.') : LBL('Application rejected.', 'Demande rejetée.'));
      render();
    } catch (e) { el.disabled = false; toast(e.message || 'Error', 1); }
  };

  async function sigs() {
    if (typeof SIGS !== 'undefined' && SIGS && SIGS.seal) return SIGS;
    try { SIGS = await api('/api/sig'); } catch (e) {}
    return SIGS;
  }
  function tick(d, x, y, on) {
    d.setDrawColor(11, 37, 89); d.setLineWidth(0.35); d.rect(x, y - 3.2, 3.5, 3.5);
    if (on) { d.setFillColor(179, 19, 30); d.rect(x + 0.65, y - 2.55, 2.2, 2.2, 'F'); }
  }
  function buildPdf(a) {
    const d = pdfBase(LBL('MINESUP HND/BTS APPLICATION', 'DEMANDE MINESUP HND/BTS'));
    const W = 210;
    let y = 54;
    const need = h => { if (y + h > 236) { d.addPage(); y = 20; d.setFont('times', 'bold'); d.setFontSize(9); d.setTextColor(11, 37, 89); d.text('ADI University  ·  ' + (a.ref || 'MINESUP'), 14, 12); d.setDrawColor(11, 37, 89); d.setLineWidth(0.3); d.line(14, 15, 196, 15); d.setTextColor(0); y = 22; } };
    const biLine = (en, fr, gap) => {
      need(34); y += 1.5; d.setFont('times', 'bold'); d.setFontSize(11); d.setTextColor(11, 37, 89); d.text(en, 14, y); y += 4.6;
      d.setFont('times', 'italic'); d.setFontSize(9); d.setTextColor(80); d.text(fr, 14, y); d.setTextColor(0); y += Math.max(6.2, gap == null ? 6 : gap + 3);
    };
    const kv = (en, fr, val) => {
      const v = String(val == null || val === '' ? '—' : val);
      d.setFont('times', 'bold'); d.setFontSize(9.5);
      const left = d.splitTextToSize(en + ' / ' + fr, 78);
      d.setFont('times', 'normal');
      const right = d.splitTextToSize(v, 100);
      const h = 4.4 * Math.max(left.length, right.length) + 1.6;
      need(h + 1);
      d.setFont('times', 'bold'); d.setFontSize(9.5); d.text(left, 14, y);
      d.setFont('times', 'normal'); d.text(right, 96, y);
      y += h;
    };
    const mark = (x, on, en, fr) => {
      need(8); tick(d, x, y, on); d.setFont('times', 'normal'); d.setFontSize(9); d.text(en, x + 5, y); d.setFont('times', 'italic'); d.setTextColor(80); d.text(fr, x + 5, y + 3.5); d.setTextColor(0);
    };
    d.setFont('times', 'italic'); d.setFontSize(9); d.setTextColor(70);
    d.text('Application for transcript or diploma  ·  Demande de relevé de notes ou de diplôme', W / 2, y, { align: 'center' });
    d.setTextColor(0); y += 6;
    d.setFont('times', 'bold'); d.setFontSize(10); d.text((a.ref ? a.ref + '   ·   ' : '') + (a.status === 'approved' ? 'APPROVED / APPROUVÉ' : a.status === 'rejected' ? 'REJECTED / REJETÉ' : 'SUBMITTED / DÉPOSÉE'), 14, y);
    y += 7;
    biLine('Section A — Personal information', 'Section A — Informations personnelles', 3);
    kv('Full name (as on certificate)', 'Nom et prénoms', a.certName);
    kv('Name on the student record', 'Nom au dossier', a.name);
    kv('Date and place of birth', 'Date et lieu de naissance', (a.dob || '') + '  ·  ' + (a.pob || ''));
    kv('Sex', 'Sexe', a.sex === 'F' ? 'Female / Féminin' : a.sex === 'M' ? 'Male / Masculin' : a.sex);
    kv('Nationality', 'Nationalité', a.nationality);
    kv('National ID number', 'Numéro de CNI', a.nid);
    kv('Telephone or WhatsApp', 'Téléphone ou WhatsApp', a.phone);
    kv('Email', 'Adresse électronique', a.email);
    kv('Postal address', 'Adresse postale', a.postal);
    y += 2;
    biLine('Section B — Academic information', 'Section B — Informations académiques', 3);
    kv('Qualification', 'Diplôme', a.level);
    kv('Specialty or option', 'Spécialité ou option', progName(a.specId));
    kv('Institution', 'Établissement', a.institution || 'American Ditek Institute (ADI University)');
    kv('MINESUP matricule (HND/BTS)', 'Matricule MINESUP (HND/BTS)', a.msNo || '—');
    kv('Academic year of graduation', 'Année d\'obtention', a.gradYear);
    kv('Examination session', 'Session d\'examen', a.session);
    kv('Date of result publication', 'Date de publication des résultats', a.resultDate);
    y += 2;
    const pair = items => {
      items.forEach((it, i) => { mark(14 + (i % 2) * 92, it.on, it.en, it.fr); if (i % 2 === 1) y += 10; });
      if (items.length % 2) y += 10;
    };
    biLine('Type of request', 'Type de demande', 4);
    const types = a.types || {};
    pair([['diploma', 'Diploma', 'Diplôme'], ['transcript', 'Transcript', 'Relevé'], ['duplicate', 'Duplicate', 'Duplicata'], ['copy', 'Certified copy', 'Copie certifiée']].map(t => ({ on: !!types[t[0]], en: t[1], fr: t[2] })));
    biLine('Section C — Reason', 'Section C — Motif', 4);
    pair(Object.keys(REASON_L).map(k => ({ on: a.reason === k, en: REASON_L[k][0], fr: REASON_L[k][1] })));
    if (a.reason === 'other') kv('Other', 'Autre', a.reasonOther);
    y += 2;
    biLine('Section D — Delivery', 'Section D — Remise', 4);
    pair(Object.keys(DELIV_L).map(k => ({ on: a.delivery === k, en: DELIV_L[k][0], fr: DELIV_L[k][1] })));
    if (a.delivery === 'school') kv('Send to', 'Envoi à', (a.destName || '') + ' — ' + (a.destAddr || ''));
    y += 2;
    biLine('Section E — Documents attached', 'Section E — Pièces jointes', 4);
    const attached = [
      ['id', 'National ID', 'CNI'], ['birth', 'Birth certificate', 'Acte de naissance'], ['results', 'Result slip / attestation', 'Relevé / attestation'],
      ['photo', 'Passport photographs', 'Photos d\'identité'], ['receipt', 'Receipt of complete fees', 'Reçu des frais'], ['police', 'Police declaration', 'Déclaration de perte'], ['auth', 'Authorisation letter', 'Lettre d\'autorisation']
    ];
    attached.forEach(row => { mark(14, hasD(a.id, row[0]), row[1], row[2]); y += 10; });
    y += 1;
    biLine('Section F — Declaration', 'Section F — Déclaration', 3);
    need(28);
    d.setFont('times', 'normal'); d.setFontSize(9);
    const decl = d.splitTextToSize('I certify that the information provided is accurate and complete. Any false declaration may result in rejection and legal action.  /  Je certifie que les informations sont exactes et complètes. Toute fausse déclaration peut entraîner le rejet et des poursuites judiciaires.', 180);
    decl.forEach(line => { need(5); d.text(line, 14, y); y += 4.2; });
    y += 2;
    kv('Date', 'Date', a.declDate);
    kv('Place', 'Lieu', a.place);
    kv('Signature of applicant', 'Signature du demandeur', a.signName);
    y += 3;
    biLine('Section G — Institutional endorsement', 'Section G — Visa de l\'établissement', 3);
    need(20);
    d.setFont('times', 'italic'); d.setFontSize(9);
    const conf = d.splitTextToSize('The Head of Institution confirms that the applicant studied here and obtained the stated qualification.  /  Le chef d\'établissement confirme que le demandeur a étudié dans cet établissement et a obtenu le diplôme indiqué.', 180);
    conf.forEach(line => { need(5); d.text(line, 14, y); y += 4.2; });
    y += 2;
    kv('Name and title', 'Nom et qualité', a.status === 'approved' ? ((a.endorsedBy || '') + ' — ' + (a.endorsedTitle || '')) : '');
    kv('Date', 'Date', a.decisionAt ? fmtD(a.decisionAt) : '');
    kv('Decision on endorsement', 'Visa', a.status === 'approved' ? 'Confirmed / Confirmé' : a.status === 'rejected' ? 'Not endorsed / Non visé' : 'Awaiting / En attente');
    y += 2;
    biLine('Section H — Official use', 'Section H — Réservé à l\'administration', 3);
    kv('Date received', 'Date de réception', a.at ? fmtD(a.at) : '');
    kv('File reference', 'Numéro de référence', a.ref);
    kv('Verified by', 'Vérifié par', a.verifiedBy || '');
    y += 1;
    mark(14, a.status === 'approved', 'Approved', 'Approuvé');
    mark(70, a.status === 'rejected', 'Rejected', 'Rejeté');
    mark(130, a.status !== 'approved' && a.status !== 'rejected', 'Pending', 'En attente');
    y += 12;
    kv('Remarks', 'Observations', a.remark);
    d._endY = y;
    pdfFooter(d);
    return d;
  }
  function sealAll(d, sig) {
    if (!sig || !sig.seal) return false;
    const s = sig.seal, w = 28, h = w * s.h / s.w;
    const n = d.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      d.setPage(i);
      try { d.addImage('data:image/png;base64,' + s.png, 'PNG', 210 - 16 - w, 246, w, h); } catch (e) {}
    }
    d._sealed = true;
    return true;
  }
  async function downloadApp(a) {
    if (typeof PDFOK === 'function' && !PDFOK()) return noPdf();
    const sig = await sigs();
    const d = buildPdf(a);
    const sealed = sealAll(d, sig);
    if (!sealed) toast(LBL('The round seal could not be loaded. Sign in and try the download again.', 'Le sceau rond n\'a pas pu être chargé. Connectez-vous et téléchargez à nouveau.'), 1);
    const name = 'ADI-MINESUP-' + String(a.ref || a.id).replace(/[^\w-]+/g, '_') + '.pdf';
    return savePDF(name, d);
  }
  ACT.mspdf = el => { const a = S.msapp[el.dataset.id]; if (!a) return; downloadApp(a); };
  window.__msBuild = buildPdf;

  /* PAID / PAYÉ stamp on every confirmed receipt, in the style of a treasury "PAID" mark. */
  function paidStampURL() {
    if (paidStampURL.u) return paidStampURL.u;
    const c = document.createElement('canvas');
    c.width = 680; c.height = 380;
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.translate(340, 190);
    g.rotate(-16 * Math.PI / 180);
    g.translate(-230, -90);
    g.strokeStyle = 'rgba(180, 22, 32, 0.92)';
    g.lineWidth = 10; g.strokeRect(8, 8, 444, 164);
    g.lineWidth = 3; g.strokeRect(18, 18, 424, 144);
    g.fillStyle = 'rgba(180, 22, 32, 0.92)';
    g.textAlign = 'center';
    g.font = '800 78px Georgia, "Times New Roman", serif';
    g.fillText('PAID', 230, 88);
    g.font = '700 36px Georgia, "Times New Roman", serif';
    g.fillText('PAYÉ', 230, 132);
    paidStampURL.u = c.toDataURL('image/png');
    return paidStampURL.u;
  }
  const _receipt = receiptPDF;
  receiptPDF = function (p) {
    const _save = savePDF;
    savePDF = function (name, d) {
      if (p && p.status === 'confirmed') {
        try {
          const n = d.getNumberOfPages();
          for (let i = 1; i <= n; i++) { d.setPage(i); d.addImage(paidStampURL(), 'PNG', 118, 86, 74, 41); }
        } catch (e) {}
      }
      savePDF = _save;
      return _save(name, d);
    };
    try { return _receipt(p); }
    finally { savePDF = _save; }
  };

  const _see = canSeeFile;
  canSeeFile = function (f) {
    if (_see(f)) return true;
    if (!f || !me()) return false;
    return String(f.ctx || '').split(':')[0] === 'ms' && (f.owner === me().id || can('manage_students') || can('manage_transcripts'));
  };

  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) {
    document.addEventListener('pointerdown', e => {
      const b = e.target.closest && e.target.closest('button, .btn, a.btn');
      if (!b || b.disabled) return;
      const rect = b.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const s = document.createElement('span');
      s.className = 'ms-rip';
      const size = Math.max(rect.width, rect.height);
      s.style.width = s.style.height = size + 'px';
      s.style.left = (e.clientX - rect.left - size / 2) + 'px';
      s.style.top = (e.clientY - rect.top - size / 2) + 'px';
      b.appendChild(s);
      setTimeout(() => s.remove(), 520);
    }, true);
  }

  api('/api/health').then(h => {
    window.MS_DEMO_ACCOUNTS = h && h.demoAccounts ? h.demoAccounts : null;
    if (typeof BOOT_DONE !== 'undefined' && BOOT_DONE && typeof render === 'function') render();
  }).catch(() => {});

  if (typeof render === 'function') render();

  /* "Apply now" stays on screen on every public page, whichever page the visitor opens. */
  function applyFloat() {
    let el = document.getElementById('apply-float');
    const r = location.hash.replace(/^#\/?/, '').split('/')[0];
    const show = typeof me === 'function' && !me() && !!document.querySelector('header.top') && !document.querySelector('.appnav');
    if (!show) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('a'); el.id = 'apply-float'; el.className = 'btn gold apply-float'; el.href = '#/signup'; document.body.appendChild(el); }
    el.textContent = (typeof LANG !== 'undefined' && LANG === 'fr') ? 'Postuler maintenant' : 'Apply now';
  }
  if (typeof render === 'function') { const prev = render; render = function () { const r = prev.apply(this, arguments); try { applyFloat(); } catch (e) {} return r; }; }
  window.addEventListener('hashchange', () => setTimeout(applyFloat, 60));
  setTimeout(applyFloat, 400);


  /* ===== MINESUP sign-up: credentials screen and activation ===== */
  const copyText = txt => { try { if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(txt); } catch (e) {} return new Promise((ok, no) => { try { const t = document.createElement('textarea'); t.value = txt; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); ok(); } catch (e) { no(e); } }); };
  function viewIssuedMs() {
    const f = FORMS.issued || {}, shown = !!f.show;
    const warn = f.ack ? '' : `<div class="ms-warn-bg" role="alertdialog" aria-modal="true" aria-labelledby="ms-warn-t"><div class="ms-warn"><div class="ms-warn-ic">!</div><h3 id="ms-warn-t">${LBL('Important: save your sign-in details', 'Important : conservez vos identifiants')}</h3>
      <p>${LBL('Copy your ADI email address and one-time password now and paste them in a place where you can retrieve them, such as a note on your phone or a saved message. You will need both in the next step to complete the creation of your ADI account and to choose your own password.', 'Copiez dès maintenant votre adresse ADI et votre mot de passe à usage unique et collez-les dans un endroit où vous pourrez les retrouver, par exemple une note sur votre téléphone ou un message enregistré. Vous en aurez besoin à l\'étape suivante pour achever la création de votre compte ADI et choisir votre propre mot de passe.')}</p>
      <p class="small">${LBL('Both items have also been sent to the personal email address you gave at the start of the registration.', 'Les deux éléments ont aussi été envoyés à l\'adresse e-mail personnelle indiquée au début de l\'inscription.')}</p>
      <button type="button" class="btn gold" data-a="msissueack">${LBL('I understand — show my details', 'J\'ai compris — afficher mes identifiants')}</button></div></div>`;
    return pubShell(`${warn}<div class="auth"><div class="card ms-cred"><p class="ms-kicker">${LBL('Step 1 of 2', 'Étape 1 sur 2')}</p><h2>${LBL('Your ADI sign-in details', 'Vos identifiants ADI')}</h2>
      <p class="muted">${LBL('An institutional account has been opened for your MINESUP application.', 'Un compte institutionnel a été ouvert pour votre demande MINESUP.')}</p>
      <div class="ms-credrow"><span class="ms-credlab">${LBL('ADI email address', 'Adresse ADI')}</span><b id="ms-c-email">${esc(f.email || '')}</b><button type="button" class="btn sm ghost" data-a="msissuecopy" data-k="email">${LBL('Copy', 'Copier')}</button></div>
      <div class="ms-credrow"><span class="ms-credlab">${LBL('One-time password', 'Mot de passe à usage unique')}</span><b id="ms-c-otp" class="ms-otp">${shown ? esc(f.otp || '—') : '••••-••••-••••'}</b><button type="button" class="btn sm ghost" data-a="msissueshow">${shown ? LBL('Hide', 'Masquer') : LBL('Check', 'Afficher')}</button><button type="button" class="btn sm ghost" data-a="msissuecopy" data-k="otp">${LBL('Copy', 'Copier')}</button></div>
      <p><button type="button" class="btn ghost sm" data-a="msissuecopy" data-k="both">${LBL('Copy both', 'Tout copier')}</button> <span id="ms-copied" class="small ms-pass"></span></p>
      <div class="note">${LBL('A copy of these details was sent to ', 'Une copie de ces éléments a été envoyée à ')}<b>${esc(f.personal || '')}</b>${LBL('. Check your inbox and your spam folder.', '. Consultez votre boîte de réception et vos courriers indésirables.')}</div>
      <p class="small">${LBL('Next step: the portal opens the activation page with these details already filled in. You then create the new password that you will use to sign in.', 'Étape suivante : le portail ouvre la page d\'activation avec ces éléments déjà remplis. Vous créez alors le nouveau mot de passe que vous utiliserez pour vous connecter.')}</p>
      <p><button type="button" class="btn gold" data-a="msissuego">${LBL('Continue to activation', 'Continuer vers l\'activation')}</button></p></div></div>`);
  }
  PUBLIC.issued = viewIssuedMs;
  ACT.msissueack = () => { FORMS.issued = Object.assign({}, FORMS.issued, { ack: true }); render(); };
  ACT.msissueshow = () => { FORMS.issued = Object.assign({}, FORMS.issued, { show: !(FORMS.issued || {}).show }); render(); };
  ACT.msissuecopy = async el => {
    const f = FORMS.issued || {}, k = el.dataset.k, txt = k === 'email' ? f.email : k === 'otp' ? f.otp : (LANG === 'fr' ? 'Adresse ADI : ' : 'ADI email: ') + f.email + '\n' + (LANG === 'fr' ? 'Mot de passe à usage unique : ' : 'One-time password: ') + f.otp;
    try { await copyText(txt || ''); const m = document.getElementById('ms-copied'); if (m) m.textContent = LBL('Copied.', 'Copié.'); toast(LBL('Copied.', 'Copié.')); } catch (e) { toast(LBL('Copy failed. Select the text and copy it manually.', 'Copie impossible. Sélectionnez le texte et copiez-le manuellement.'), 1); }
  };
  ACT.msissuego = () => { const f = FORMS.issued || {}; FORMS.act = { email: f.email || '', otp: f.otp || '', pw: '', pw2: '' }; go('activate'); };
  function viewActivate() {
    if (!FORMS.act) FORMS.act = { email: '', otp: '', pw: '', pw2: '' };
    return pubShell(`<div class="auth"><div class="card"><p class="ms-kicker">${LBL('Step 2 of 2', 'Étape 2 sur 2')}</p><h2>${LBL('Activate your ADI account', 'Activez votre compte ADI')}</h2><div id="aerr"></div>
      <p class="muted">${LBL('Your ADI email address and one-time password are filled in for you. Choose the new password that you will use to sign in from now on.', 'Votre adresse ADI et votre mot de passe à usage unique sont déjà renseignés. Choisissez le nouveau mot de passe que vous utiliserez désormais pour vous connecter.')}</p>
      ${inp('act.email', LBL('ADI email address', 'Adresse ADI'), { type: 'email' })}${inp('act.otp', LBL('One-time password', 'Mot de passe à usage unique'))}
      ${inp('act.pw', LBL('New password', 'Nouveau mot de passe'), { type: 'password' })}${inp('act.pw2', LBL('Confirm the new password', 'Confirmez le nouveau mot de passe'), { type: 'password' })}
      <p class="small muted">${LBL('At least 10 characters, with at least one letter and one digit, and different from the one-time password.', 'Au moins 10 caractères, avec au moins une lettre et un chiffre, et différent du mot de passe à usage unique.')}</p>
      <button class="btn gold" style="width:100%" data-a="msactivate">${LBL('Create my ADI account and sign in', 'Créer mon compte ADI et me connecter')}</button></div></div>`);
  }
  PUBLIC.activate = viewActivate;
  ACT.msactivate = async el => {
    const f = FORMS.act || {}, email = String(f.email || '').trim().toLowerCase(), otp = String(f.otp || '').trim(), pw = String(f.pw || '');
    const bad = (k, m) => { const box = document.getElementById('aerr'); if (box) box.innerHTML = `<div class="note bad">${esc(m)}</div>`; focusField(k, m); };
    if (!/^\S+@adiuniversity\.com$/.test(email)) return bad('act.email', LBL('Enter your ADI email address, ending with @adiuniversity.com.', 'Saisissez votre adresse ADI, se terminant par @adiuniversity.com.'));
    if (!otp) return bad('act.otp', LBL('Enter the one-time password.', 'Saisissez le mot de passe à usage unique.'));
    if (pw.length < 10 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return bad('act.pw', LBL('The new password needs at least 10 characters, a letter and a digit.', 'Le nouveau mot de passe exige au moins 10 caractères, une lettre et un chiffre.'));
    if (pw === otp) return bad('act.pw', LBL('The new password must differ from the one-time password.', 'Le nouveau mot de passe doit différer du mot de passe à usage unique.'));
    if (pw !== f.pw2) return bad('act.pw2', LBL('The two passwords do not match.', 'Les deux mots de passe ne correspondent pas.'));
    if (el) el.disabled = true;
    const r = await doLogin(email, otp);
    if (r.err) { if (el) el.disabled = false; return bad('act.otp', r.err); }
    try { await api('/api/mail/setup', { body: { otp, password: pw } }); }
    catch (e) { if (el) el.disabled = false; if (e.code !== 'active') return bad('act.pw', e.message || LBL('Activation failed.', 'Échec de l\'activation.')); }
    FORMS.act = null; FORMS.issued = null; try { await apiSync(); } catch (e) {}
    toast(LBL('Your ADI account is active. Welcome.', 'Votre compte ADI est actif. Bienvenue.')); routeAfterLogin();
  };

  /* ===== Guidance text under every field that needs typing ===== */
  const HINTS = [
    [/^su\.name$/, ['Type your full name exactly as it appears on your national identity card or certificate.', 'Saisissez votre nom complet tel qu\'il figure sur votre carte d\'identité ou votre diplôme.']],
    [/^su\.email$|contactEmail|^sa\.email$/, ['Type a personal email address that you check often. Messages from ADI, including your sign-in details, are sent here.', 'Saisissez une adresse e-mail personnelle que vous consultez souvent. Les messages de l\'ADI, y compris vos identifiants, y sont envoyés.']],
    [/^su\.phone$|phone|tel$/, ['Type your telephone number with the area code, for example 6XXXXXXXX or +237 6XXXXXXXX. It is used for payment notices.', 'Saisissez votre numéro de téléphone avec l\'indicatif, par exemple 6XXXXXXXX ou +237 6XXXXXXXX. Il sert aux avis de paiement.']],
    [/^su\.password$|^act\.pw$/, ['Choose a strong password of at least 8 characters, mixing letters and digits. Do not share it.', 'Choisissez un mot de passe robuste d\'au moins 8 caractères, mêlant lettres et chiffres. Ne le communiquez pas.']],
    [/^su\.password2$|^act\.pw2$/, ['Type the same password again to confirm it.', 'Saisissez à nouveau le même mot de passe pour le confirmer.']],
    [/^su\.matric$/, ['Type your ADI matricule as printed on your admission letter or student card, for example ADI26H0001.', 'Saisissez votre matricule ADI tel qu\'il figure sur votre lettre d\'admission ou votre carte, par exemple ADI26H0001.']],
    [/^lg\.email$/, ['Type the email address you used to register. MINESUP applicants use the ADI address that ends with @adiuniversity.com.', 'Saisissez l\'adresse utilisée à l\'inscription. Les candidats MINESUP utilisent l\'adresse ADI se terminant par @adiuniversity.com.']],
    [/^lg\.pw$/, ['Type your password. If you have just registered for MINESUP, use the new password you created at activation.', 'Saisissez votre mot de passe. Si vous venez de vous inscrire au MINESUP, utilisez le nouveau mot de passe créé à l\'activation.']],
    [/^act\.email$/, ['Your ADI address is filled in automatically. If it is empty, copy it from the confirmation email.', 'Votre adresse ADI est renseignée automatiquement. Si le champ est vide, copiez-la depuis l\'e-mail de confirmation.']],
    [/^act\.otp$/, ['The one-time password is filled in automatically. If it is empty, copy it from the confirmation email.', 'Le mot de passe à usage unique est renseigné automatiquement. Si le champ est vide, copiez-le depuis l\'e-mail de confirmation.']],
    [/^msc\.matric$/, ['Type your ADI matricule, or choose your name in the list above to fill it for you.', 'Saisissez votre matricule ADI, ou choisissez votre nom dans la liste ci-dessus pour le renseigner.']],
    [/^msc\.msNo$/, ['Type the MINESUP matricule printed on your HND/BTS registration form, for example 26SWE0762.', 'Saisissez le matricule MINESUP imprimé sur votre fiche d\'inscription HND/BTS, par exemple 26SWE0762.']],
    [/^msp\.ref$|\.ref$|txn|trans/, ['Type the transaction ID from the Mobile Money confirmation message (at least 6 characters).', 'Saisissez l\'identifiant de transaction du message de confirmation Mobile Money (6 caractères minimum).']],
    [/^sa\.name$/, ['Type the full name of the person, as on their identity document.', 'Saisissez le nom complet de la personne, tel qu\'il figure sur sa pièce d\'identité.']],
    [/^sa\.q$|^sa\.dq$|search|\.q$/, ['Type part of a name, email, matricule or reference to filter the list.', 'Saisissez une partie d\'un nom, d\'un e-mail, d\'un matricule ou d\'une référence pour filtrer la liste.']],
    [/dob|birth.*date|date/, ['Choose or type the date in the format day / month / year.', 'Choisissez ou saisissez la date au format jour / mois / année.']],
    [/pob|place/, ['Type the town and country as written on your birth certificate.', 'Saisissez la ville et le pays tels qu\'ils figurent sur votre acte de naissance.']],
    [/certName|fullname|name/, ['Type the name exactly as written on the document it refers to.', 'Saisissez le nom exactement comme sur le document concerné.']],
    [/email/, ['Type a valid email address, for example name@example.com.', 'Saisissez une adresse e-mail valable, par exemple nom@exemple.com.']],
    [/matric/, ['Type the matricule exactly as printed on your official document.', 'Saisissez le matricule exactement comme imprimé sur votre document officiel.']],
    [/amount|fee|price|mark|score|credit/, ['Type the number only, without spaces or letters.', 'Saisissez uniquement le nombre, sans espaces ni lettres.']],
    [/address|addr|street/, ['Type your full postal or residential address, including the town.', 'Saisissez votre adresse postale ou de résidence complète, avec la ville.']],
    [/note|remark|comment|reason|body|message|desc|text/, ['Write clearly and briefly. State the facts that the reader needs in order to act.', 'Rédigez clairement et brièvement. Indiquez les faits dont le lecteur a besoin pour agir.']]
  ];
  function hintFor(key, el, label) {
    for (const h of HINTS) if (h[0].test(key)) return LBL(h[1][0], h[1][1]);
    if (el.tagName === 'SELECT') return LBL('Choose one option from the list.', 'Choisissez une option dans la liste.');
    if (el.tagName === 'TEXTAREA') return LBL('Write your answer in full sentences; the box grows as you type.', 'Rédigez votre réponse en phrases complètes ; la zone s\'agrandit à mesure que vous écrivez.');
    if (el.type === 'number') return LBL('Type the number only.', 'Saisissez uniquement le nombre.');
    if (el.type === 'password') return LBL('Type your password. Use the eye button to check what you typed.', 'Saisissez votre mot de passe. Le bouton en forme d\'œil permet de vérifier votre saisie.');
    return label ? LBL('Type here: ', 'Saisissez ici : ') + label.replace(/[*:]+$/, '').trim() + '.' : LBL('Type your answer in this field.', 'Saisissez votre réponse dans ce champ.');
  }
  function addHints() {
    document.querySelectorAll('[data-f]').forEach(el => {
      if (!/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || ['hidden', 'checkbox', 'radio', 'file', 'button', 'submit'].includes(el.type)) return;
      if (el.closest('.ms-warn-bg,#chat,.chat')) return;
      const box = el.closest('.fld') || el.parentElement; if (!box || box.querySelector('.ms-hint')) return;
      if (box.nextElementSibling && box.nextElementSibling.classList.contains('ms-hint')) return;
      const lab = box.querySelector('label'), txt = hintFor(el.dataset.f || '', el, lab ? lab.textContent : '');
      const h = document.createElement('small'); h.className = 'ms-hint'; h.id = 'hint-' + (el.id || el.dataset.f).replace(/[^\w-]/g, '_'); h.textContent = txt;
      (el.closest('.pwwrap') || el).insertAdjacentElement('afterend', h); el.setAttribute('aria-describedby', h.id);
    });
  }
  if (typeof render === 'function') { const prevH = render; render = function () { const r = prevH.apply(this, arguments); try { addHints(); } catch (e) {} return r; }; }
  setTimeout(() => { try { addHints(); } catch (e) {} }, 500);

  /* ===== Greeting boxes: longer welcome, slim closing box, pop out on entry and pop in on exit ===== */
  L.greet_body = ['The President and the Registry of the American Ditek Institute receive you at the official portal of the University. Here you may apply for admission, pay your fees, register for courses, consult your results and request official documents, including the MINESUP transcript. Please conduct your academic and administrative business with care, integrity and the courtesy proper to this institution. Our offices remain at your disposal throughout the academic year.', 'Le Président et la Scolarité de l\'American Ditek Institute vous reçoivent au portail officiel de l\'Université. Vous pouvez ici demander votre admission, payer vos frais, vous inscrire aux cours, consulter vos résultats et demander des documents officiels, dont le relevé de notes MINESUP. Veuillez traiter vos affaires académiques et administratives avec soin, intégrité et la courtoisie qui sied à cette institution. Nos services restent à votre disposition tout au long de l\'année académique.'];
  let greetOn = 0;
  function greetEntry() {
    const g = document.querySelector('.adi-greet:not(.panel)') || document.querySelector('.adi-greet');
    if (!g) { greetOn = 0; return; }
    const holder = g.closest('.adi-bye') ? g : g;
    if (!greetOn) { greetOn = Date.now(); holder.classList.add('ms-popout'); try { setTimeout(() => window.typeGreeting && window.typeGreeting(holder), 350); } catch (e) {} }
    else if (Date.now() - greetOn < 900 && !holder.classList.contains('ms-popout')) holder.classList.add('ms-popout');
    if (greetOn && Date.now() - greetOn > 900) { try { setTimeout(() => window.typeGreeting && window.typeGreeting(holder), 350); } catch (e) {} }
  }
  if (typeof render === 'function') { const prevG = render; render = function () { const r = prevG.apply(this, arguments); try { greetEntry(); } catch (e) {} return r; }; }
  function greetExit(e) {
    const g = document.querySelector('.adi-greet'); if (!g || !e.target.closest) return;
    if (!e.target.closest('[data-a],a[href^="#"]')) return;
    const r = g.getBoundingClientRect(); if (r.width < 10 || r.bottom < 0) return;
    const c = g.cloneNode(true); c.classList.remove('ms-popout'); c.classList.add('ms-popin-clone');
    c.style.cssText = 'position:fixed;left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;margin:0;z-index:9998;pointer-events:none';
    document.body.appendChild(c); c.addEventListener('animationend', () => c.remove()); setTimeout(() => c.remove(), 800);
  }
  document.addEventListener('click', greetExit, true);
  setTimeout(greetEntry, 300);

  /* ===== Tap-to-field and keyboard-safe typing ===== */
  (function () {
    const mv = document.querySelector('meta[name="viewport"]');
    if (mv && !/interactive-widget/.test(mv.content)) mv.content += ', interactive-widget=resizes-content';
    const isField = el => el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !['hidden', 'checkbox', 'radio', 'button', 'submit', 'file'].includes(el.type) && !el.disabled && !el.readOnly;
    const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
    let intent = 0;
    document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-a],a[href^="#/"],a[href^="#"]')) intent = Date.now(); }, true);
    document.addEventListener('touchend', e => { if (e.target.closest && e.target.closest('[data-a],a[href^="#"]')) intent = Date.now(); }, { capture: true, passive: true });
    function land() {
      if (Date.now() - intent > 4000) return;
      if (isField(document.activeElement)) return;
      if (Array.from(document.querySelectorAll('.modal-bg,.modal,[role="dialog"]')).some(visible)) return;
      const root = document.getElementById('app') || document.body;
      if (/^#\/?$/.test(location.hash)) return;
      const f = Array.from(root.querySelectorAll('input,textarea,select')).filter(el => isField(el) && visible(el) && !el.closest('nav,header,.nav,.topbar,#chat,.chat'));
      const target = f.find(el => !String(el.value || '').trim()) || null;
      window.scrollTo({ top: 0 });
      if (target) { try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); } setTimeout(() => keepVisible(target), 60); }
      else { const h = root.querySelector('h1,h2'); if (h) h.scrollIntoView({ block: 'start' }); }
    }
    window.addEventListener('hashchange', () => { [250, 800, 1600].forEach(ms => setTimeout(land, ms)); });
    function kbHeight() { const v = window.visualViewport; return v ? Math.max(0, Math.round(window.innerHeight - v.height - v.offsetTop)) : 0; }
    function keepVisible(el) {
      el = el || document.activeElement; if (!isField(el)) return;
      const v = window.visualViewport, h = v ? v.height : window.innerHeight, top = v ? v.offsetTop : 0, r = el.getBoundingClientRect();
      if (r.bottom > top + h - 24 || r.top < top + 70) {
        const want = r.top - (top + h / 2 - r.height / 2);
        window.scrollBy({ top: want, behavior: 'smooth' });
      }
    }
    function padFor() {
      const kb = kbHeight(), on = kb > 80;
      document.documentElement.style.setProperty('--kb', kb + 'px');
      document.body.style.paddingBottom = on ? (kb + 24) + 'px' : '';
      if (on) setTimeout(() => keepVisible(), 60);
    }
    if (window.visualViewport) { window.visualViewport.addEventListener('resize', padFor); window.visualViewport.addEventListener('scroll', () => { if (kbHeight() > 80) keepVisible(); }); }
    document.addEventListener('focusin', e => { if (isField(e.target)) { setTimeout(() => keepVisible(e.target), 320); setTimeout(() => keepVisible(e.target), 700); } });
    document.addEventListener('focusout', () => setTimeout(() => { if (!isField(document.activeElement)) { document.body.style.paddingBottom = ''; } }, 200));
  })();
})();

/* ===== Greeting typewriter: the welcome and closing texts are written out character by character, from the first letter to the last ===== */
(function () {
  const typed = new Set(); window.adiTyping = { active: false };
  let cancelFlag = false;
  const finishNow = () => { cancelFlag = true; };
  ['pointerdown', 'touchstart', 'keydown'].forEach(n => window.addEventListener(n, finishNow, { capture: true, passive: true }));
  const completed = new Set(), prog = {}; let token = 0;
  setInterval(() => { try { document.querySelectorAll('.adi-greet:not(.panel)').forEach(b => { const r = b.getBoundingClientRect(); if (r.height > 20) window.typeGreeting(b); }); } catch (e) {} }, 300);
  window.typeGreeting = function (box) {
    if (!box || !box.isConnected || box.classList.contains('panel') || box.dataset.typed) return;
    const els = Array.from(box.querySelectorAll('h2,.body,.close')).filter(e => e.children.length === 0 && e.textContent.trim());
    if (!els.length) return;
    const key = (typeof LANG !== 'undefined' ? LANG : '') + '|' + els.map(e => e.textContent.trim().slice(0, 40)).join('|');
    if (completed.has(key)) return;
    box.dataset.typed = '1';
    const texts = els.map(e => e.textContent), total = texts.reduce((a, t) => a + t.length, 0), per = Math.max(7, Math.min(24, 9000 / total)), my = ++token;
    els.forEach(e => { e.style.minHeight = e.offsetHeight + 'px'; });
    let pos = prog[key] || 0;                                   /* characters already written (resumes if the page redraws the box) */
    const caret = n => { let acc = 0; els.forEach((e, k) => { e.classList.toggle('ms-typing', n >= acc && n < acc + texts[k].length || (n === total && k === els.length - 1 && false)); acc += texts[k].length; }); };
    const finish = () => { els.forEach((e, k) => { e.textContent = texts[k]; e.style.minHeight = ''; e.classList.remove('ms-typing'); }); completed.add(key); window.adiTyping.active = false; };
    window.adiTyping.active = true; cancelFlag = false;
    const stepN = Math.max(1, Math.round(16 / per));
    (function step() {
      if (my !== token) return;
      if (cancelFlag) return finish();
      if (!box.isConnected) { window.adiTyping.active = false; return; }
      pos = Math.min(total, pos + stepN); prog[key] = pos;
      let left = pos; els.forEach((e, k) => { const c = Math.max(0, Math.min(texts[k].length, left)); left -= texts[k].length; e.textContent = texts[k].slice(0, c); });
      caret(pos);
      if (pos >= total) return finish();
      setTimeout(step, per * stepN);
    })();
  };
})();

/* ===== Opening or refreshing the portal always begins at the top of the home page (except password-reset and activation links, and the back button) ===== */
(function () {
  let nav = ''; try { nav = (performance.getEntriesByType('navigation')[0] || {}).type || ''; } catch (e) {}
  let hint = null; try { hint = sessionStorage.getItem('adi_tab'); } catch (e) {}
  const keep = /^#\/(reset|activate)(\/|$)/.test(location.hash), home = /^#?\/?(home)?\/?$/.test(location.hash);
  if (nav === 'back_forward' || keep || home || hint) return;
  try { go('home'); } catch (e) { location.hash = '#/home'; }
  try { window.scrollTo(0, 0); } catch (e) {}
})();

/* ===== Long passages: after the text has been written, only the first three lines are shown, with a More... control that reveals the whole passage ===== */
(function () {
  const fr = () => typeof LANG !== 'undefined' && LANG === 'fr';
  const opened = new Set();
  const SKIP = 'form,.modal,.modal-bg,[role="dialog"],.note,#chat,.chat,pre,table,button,textarea,nav,header.top,.ms-hint,.ms-cred,#sess-exp,#idle-warn';
  const keyOf = el => (el.textContent || '').trim().slice(0, 60);
  function lab(open) { return open ? (fr() ? 'Moins' : 'Less') : (fr() ? 'Plus…' : 'More…'); }
  function wire(el) {
    if (el.dataset.msMore) return; el.dataset.msMore = '1';
    const k = keyOf(el), grp = el.closest('.adi-greet');
    el.classList.add('ms-clamp');
    if (opened.has(k)) { el.classList.remove('ms-clamp'); }
    let b = el.nextElementSibling && el.nextElementSibling.classList.contains('ms-more') ? el.nextElementSibling : null;
    if (!b) { b = document.createElement('button'); b.type = 'button'; b.className = 'ms-more'; el.after(b); }
    const sync = () => { const open = !el.classList.contains('ms-clamp'); b.textContent = lab(open); b.setAttribute('aria-expanded', String(open)); };
    /* a passage that already fits in three lines needs no control */
    requestAnimationFrame(() => { if (el.classList.contains('ms-clamp') && el.scrollHeight <= el.clientHeight + 2) { el.classList.remove('ms-clamp'); b.remove(); el.dataset.msMore = 'fit'; } else sync(); });
    b.onclick = e => { e.preventDefault(); e.stopPropagation(); const open = el.classList.contains('ms-clamp'); el.classList.toggle('ms-clamp', !open); if (open) opened.add(k); else opened.delete(k); sync(); };
  }
  function scan() {
    if (window.adiTyping && window.adiTyping.active) return;
    document.querySelectorAll('#app p, main p, .adi-greet .body').forEach(el => {
      if (el.dataset.msMore || el.closest(SKIP) || el.classList.contains('ms-typing')) return;
      if ((el.textContent || '').trim().length < 240) return;
      wire(el);
    });
  }
  setInterval(scan, 700);
})();

/* ===== Errors: shown above the field concerned and echoed in a floating notice that stays on screen while the page is scrolled ===== */
(function () {
  const fr = () => typeof LANG !== 'undefined' && LANG === 'fr';
  let bar = null, src = null, io = null, hideT = 0, lastAct = 0;
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  function ensure() {
    if (bar && bar.isConnected) return bar;
    bar = document.createElement('div'); bar.id = 'err-float'; bar.setAttribute('role', 'alert'); bar.hidden = true;
    bar.innerHTML = '<span class="ef-k"></span><span class="ef-m"></span><button type="button" class="ef-go"></button><button type="button" class="ef-x" aria-label="Close">×</button>';
    bar.querySelector('.ef-x').onclick = () => clear();
    bar.querySelector('.ef-go').onclick = () => { if (src && src.isConnected) { try { src.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { src.scrollIntoView(); } } };
    document.body.appendChild(bar); return bar;
  }
  function clear() { clearTimeout(hideT); if (io) { io.disconnect(); io = null; } src = null; if (bar) bar.hidden = true; }
  function present(msg, source, ttl) {
    msg = String(msg || '').replace(/\s+/g, ' ').trim(); if (!msg) return;
    clear(); const b = ensure();
    b.querySelector('.ef-k').textContent = fr() ? 'À corriger' : 'Please correct';
    b.querySelector('.ef-m').textContent = msg;
    b.querySelector('.ef-go').textContent = fr() ? 'Voir' : 'Show';
    src = source || null; b.hidden = false;
    b.querySelector('.ef-go').style.display = src ? '' : 'none';
    if (src && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(es => { const e = es[es.length - 1]; if (bar) bar.hidden = !!(e && e.isIntersecting && e.intersectionRatio > 0.9); }, { threshold: [0, .5, .95, 1], rootMargin: '-70px 0px 0px 0px' });
      io.observe(src);
    }
    if (ttl) hideT = setTimeout(clear, ttl);
  }
  /* the message sits above the field it concerns */
  if (typeof focusField === 'function') {
    const orig = focusField;
    focusField = function (name, msg) {
      const r = orig.apply(this, arguments);
      if (msg) {
        try {
          const el = (typeof fid === 'function' && document.getElementById(fid(name))) || document.querySelector('[data-f="' + String(name).replace(/"/g, '') + '"]');
          const box = el && (el.closest('.fld') || el.closest('label') || el), n = box && box.querySelector('.ferr');
          if (n) { let t = el; while (t.parentElement && t.parentElement !== box) t = t.parentElement; if (t.parentElement === box && t !== n) box.insertBefore(n, t); else if (n !== box.firstChild) box.insertBefore(n, box.firstChild); present(msg, n);
            const done = () => { if (String(el.value || '').trim()) { box.classList.remove('fld-bad'); n.remove(); if (src === n) clear(); el.removeEventListener('input', done); el.removeEventListener('change', done); } };
            el.addEventListener('input', done); el.addEventListener('change', done); }
        } catch (e) {}
      }
      return r;
    };
  }
  /* a form-level notice that names a field (e-mail, telephone, password, name, matricule...) is repeated above that field */
  const KEYS = [[/e-?mail|courriel/i, el => el.type === 'email' || /mail/i.test(el.dataset.f)], [/phone|t[ée]l[ée]phone|mobile/i, el => el.type === 'tel' || /phone|tel/i.test(el.dataset.f)], [/password|mot de passe/i, el => el.type === 'password' && !/2$/.test(el.dataset.f)], [/matric/i, el => /matric|adi|ms/i.test(el.dataset.f)], [/\b(full )?name\b|\bnom\b/i, el => /name|nom/i.test(el.dataset.f)], [/birth|naissance|\bdob\b/i, el => /dob|birth|naiss/i.test(el.dataset.f)]];
  function toField(msg) {
    if (!msg || document.querySelector('.fld-bad .ferr')) return;
    const fs = Array.from(document.querySelectorAll('#app input[data-f],#app select[data-f],#app textarea[data-f]')).filter(el => el.type !== 'hidden' && vis(el));
    for (const [re, test] of KEYS) { if (!re.test(msg)) continue; const el = fs.find(test); if (el && typeof focusField === 'function') { focusField(el.dataset.f, String(msg).replace(/\s+/g, ' ').trim()); return; } }
  }
  /* other error notices raised by an action: form-level notes and error toasts */
  ['click', 'touchend', 'keydown', 'submit', 'change'].forEach(n => document.addEventListener(n, () => { lastAct = Date.now(); }, { capture: true, passive: true }));
  new MutationObserver(ms => {
    for (const m of ms) for (const nd of m.addedNodes) {
      if (!nd || nd.nodeType !== 1) continue;
      if (nd.id === 'err-float' || (nd.closest && nd.closest('#err-float'))) continue;
      if (nd.classList.contains('toast') && nd.classList.contains('err')) { present(nd.textContent, null, 9000); continue; }
      const note = nd.matches && nd.matches('.note.bad') ? nd : (nd.querySelector && nd.querySelector('.note.bad'));
      if (note && Date.now() - lastAct < 5000 && !note.closest('#err-float')) { present(note.textContent, note, 0); try { toField(note.textContent); } catch (e) {} }
    }
  }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('hashchange', clear);
  setInterval(() => { if (src && !src.isConnected) clear(); }, 1500);
})();

/* ===== Homepage guided tour: on arrival the page glides to the end, returns to the top and rests; any touch or click halts it at the top ===== */
(function () {
  const reduce = false;   /* the tour is requested by the University and is stopped by any touch, so the device motion setting does not disable it */
  const root = document.documentElement;
  let raf = 0, live = false, done = false, needIdle = 3500, lastTouch = 0, polls = 0, lastH = -1, steady = 0, poller = 0;
  const isHome = () => /^#?\/?(home)?\/?$/.test(location.hash) && typeof me === 'function' && !me() && !!document.querySelector('header.top') && !document.querySelector('.appnav');
  const maxY = () => Math.max(0, Math.max(root.scrollHeight, document.body.scrollHeight, scroller().scrollHeight) - window.innerHeight);
  const scroller = () => document.scrollingElement || root;
  const jump = y => { root.style.scrollBehavior = 'auto'; document.body.style.scrollBehavior = 'auto'; try { scroller().scrollTop = y; } catch (e) {} if (Math.abs((window.scrollY || scroller().scrollTop) - y) > 3) { try { window.scrollTo(0, y); } catch (e) {} } };
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const evs = ['pointerdown', 'touchstart', 'mousedown', 'click', 'wheel', 'keydown'];
  function stop(toTop) {
    if (!live) return;
    live = false; needIdle = 30000; lastTouch = Date.now(); cancelAnimationFrame(raf);
    evs.forEach(n => window.removeEventListener(n, onUser, true));
    window.removeEventListener('hashchange', onHash);
    root.style.scrollBehavior = '';
    if (toTop) jump(0);
  }
  function onUser(e) { if (e.isTrusted !== false) stop(true); }
  function onHash() { stop(false); }
  function leg(from, to, ms, next, lin) {
    const t0 = performance.now();
    (function step(now) {
      if (!live) return;
      const k = Math.min(1, (now - t0) / ms);
      jump(from + (to - from) * (lin ? k : ease(k)));
      if (k < 1) raf = requestAnimationFrame(step); else next && next();
    })(t0);
  }
  try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) {}
  
  function start() {
    if (window.scrollY > 4) jump(0);
    live = true; root.style.scrollBehavior = 'auto';
    evs.forEach(n => window.addEventListener(n, onUser, { capture: true, passive: true }));
    window.addEventListener('hashchange', onHash);
    /* the glide repeats (down at reading pace, quick return, short rest) until the visitor touches or clicks the screen */
    const cycle = () => {
      if (!live) return;
      const e2 = maxY(), down = Math.min(100000, Math.max(20000, e2 / 0.2));   /* about 200 px per second, a pace at which the text can be read */
      leg(0, e2, down, () => setTimeout(() => {
        if (!live) return;
        leg(maxY(), 0, 1100, () => setTimeout(cycle, 2500));
      }, 700), true);
    };
    setTimeout(cycle, 600);
  }
  /* the page may still be loading on a slow connection: wait until it is complete, tall enough, stable, finished typing and untouched, then begin */
  function poll() {
    if (live) return;
    if (needIdle <= 3500 && ++polls > 150) needIdle = 30000;       /* the first attempt is made for about 90 s after arrival; afterwards the glide resumes only after 30 s of rest */
    if (!isHome()) return;
    if (window.adiTyping && window.adiTyping.active) return;
    if (Date.now() - lastTouch < needIdle) return;
    const ae = document.activeElement; if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
    if (Array.from(document.querySelectorAll('.modal-bg,.modal,[role="dialog"],#chat.open,.chat.open')).some(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; })) return;
    const h = Math.max(root.scrollHeight, document.body.scrollHeight);
    steady = h === lastH ? steady + 1 : 0; lastH = h;
    if (steady < 2 || document.readyState !== 'complete') return;
    if (maxY() < window.innerHeight * 0.8) return;
    start();
  }
  /* touching or scrolling before the glide begins only postpones it; a deliberate click or key press cancels it */
  /* any touch, scroll gesture, click or key press postpones the glide; after the first interaction it resumes only after 30 s without touching the screen */
  ['pointerdown', 'touchstart', 'touchmove', 'wheel', 'click', 'keydown'].forEach(n => window.addEventListener(n, e => { if (!live && e.isTrusted !== false) { lastTouch = Date.now(); if (n === 'click' || n === 'keydown') needIdle = 30000; } }, { capture: true, passive: true }));
  function arm() { clearInterval(poller); polls = 0; poller = setInterval(poll, 800); }
  window.adiTourRestart = function () { stop(false); needIdle = 3500; lastTouch = 0; arm(); };
  arm();
})();

/* ===== Session security: 5-minute inactivity limit, expiry notice, sign-out when the portal is closed ===== */
(function () {
  const IDLE = 5 * 60 * 1000, KEY = 'adi_tab', LAST = 'adi_last';
  const ss = { get: k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} }, del: k => { try { sessionStorage.removeItem(k); } catch (e) {} } };
  const signed = () => { try { return typeof me === 'function' && !!me(); } catch (e) { return false; } };
  const fr = () => typeof LANG !== 'undefined' && LANG === 'fr';
  let lastPing = 0, expiring = false;

  function notice() {
    const old = document.getElementById('sess-exp'); if (old) old.remove();
    const d = document.createElement('div'); d.id = 'sess-exp'; d.setAttribute('role', 'alert');
    d.innerHTML = '<strong>' + (fr() ? 'Session expirée' : 'Session expired') + '</strong><span>' + (fr() ? 'Veuillez vous reconnecter.' : 'Please sign in again.') + '</span><button type="button" aria-label="' + (fr() ? 'Fermer' : 'Close') + '">×</button>';
    d.querySelector('button').onclick = () => d.remove();
    document.body.appendChild(d); setTimeout(() => { try { d.remove(); } catch (e) {} }, 20000);
  }
  function wipe(then) {
    const done = () => { try { SESSION = null; COLS.forEach(c => { if (c !== 'settings') S[c] = {}; }); API.vk = ''; } catch (e) {} ss.del(KEY); try { localStorage.removeItem(LAST); } catch (e) {} Promise.resolve(typeof apiSync === 'function' ? apiSync() : 0).catch(() => {}).then(then); };
    try { if (typeof MODE !== 'undefined' && MODE === 'api') fetch('/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', credentials: 'same-origin' }).catch(() => {}).then(done); else done(); } catch (e) { done(); }
  }
  window.sessionExpire = function (silent) {
    if (expiring) return; expiring = true;
    wipe(() => { const dest = silent ? 'home' : 'login'; try { go(dest); } catch (e) { location.hash = '#/' + dest; } try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch (e) {} if (!silent) notice(); else if (window.adiTourRestart) window.adiTourRestart(); setTimeout(() => { expiring = false; }, 1500); });
  };

  /* every request made while the visitor is active renews the server-side idle window; a refused session shows the expiry notice */
  const f0 = window.fetch.bind(window);
  window.fetch = function (input, init) {
    let url = typeof input === 'string' ? input : (input && input.url) || '';
    const api = /^\/api\//.test(url.replace(location.origin, ''));
    if (api) {
      init = Object.assign({}, init); const h = new Headers(init.headers || (typeof input !== 'string' && input.headers) || {});
      if (typeof idleAt !== 'undefined' && Date.now() - idleAt < 90000) h.set('X-ADI-Active', '1');
      init.headers = h;
    }
    return f0(input, init).then(r => {
      if (api) {
        const path = url.replace(location.origin, '').split('?')[0];
        if (r.ok && /^\/api\/(login|signup|mail\/setup|password)$/.test(path)) ss.set(KEY, '1');
        if (r.status === 401 && signed() && !/^\/api\/(login|logout|session)/.test(path)) setTimeout(() => window.sessionExpire(), 50);
      }
      return r;
    });
  };

  /* activity: scrolling and reading count as use; a light ping keeps the server window aligned with the on-screen timer */
  function active() {
    if (typeof idleAt !== 'undefined') idleAt = Date.now();
    try { localStorage.setItem(LAST, String(Date.now())); } catch (e) {}
    if (signed() && Date.now() - lastPing > 45000) {
      lastPing = Date.now();
      f0('/api/session/ping', { method: 'POST', headers: { 'X-ADI-Active': '1', 'Content-Type': 'application/json' }, body: '{}', credentials: 'same-origin' })
        .then(r => r.json()).then(j => { if (signed() && j && !j.me) window.sessionExpire(); }).catch(() => {});
    }
  }
  let thr = 0;
  ['pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll'].forEach(ev => window.addEventListener(ev, e => {
    if (e.target && e.target.closest && e.target.closest('#idle-warn')) return;
    const t = Date.now(); if (t - thr < 1500) return; thr = t; active();
  }, { capture: true, passive: true }));

  /* a sleeping device or a restored tab: judge the elapsed time as soon as the page is visible again */
  function wake() {
    if (!signed()) return;
    let last = 0; try { last = Number(localStorage.getItem(LAST)) || 0; } catch (e) {}
    if (last && Date.now() - last > IDLE) window.sessionExpire();
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  window.addEventListener('pageshow', wake); window.addEventListener('focus', wake);

  /* closing the portal ends the session: a signed-in page that this tab did not sign in is signed out at once */
  setInterval(() => { if (signed() && !ss.get(KEY) && !expiring) window.sessionExpire(true); }, 1000);
  window.addEventListener('pagehide', () => { /* the session cookie is also discarded by the browser; nothing is stored beyond the tab */ });
})();
