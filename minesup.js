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

  function tuitionOk(st) {
    if (!st || typeof feeBook !== 'function') return false;
    try { const fb = feeBook(st); return !!(fb && fb.regOk && Number(fb.balance) <= 0); }
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
    try { sessionStorage.setItem(feeGateKey, '1'); } catch (e) {}
    if (hopping) return;
    hopping = true;
    toast(LBL('Tuition is not fully paid and confirmed. Opening the fees page.', 'La scolarité n\'est pas entièrement payée et confirmée. Ouverture de la page des frais.'), 1);
    setTimeout(() => { hopping = false; go('fees-me'); }, 40);
  }

  function enter() {
    const u = me();
    if (!u) { try { sessionStorage.setItem('adi_next', 'minesup'); } catch (e) {} go('login'); return; }
    if (u.role !== 'student') {
      if (can('manage_students') || can('manage_transcripts') || u.role === 'super_admin') { go('minesup-admin'); return; }
      go('minesup'); return;
    }
    const st = studentOf(u.id);
    if (!st || !levelOk(st)) { go('minesup'); return; }
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
      h = h.slice(0, a) + btn + h.slice(a);
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
        const st = studentOf(u.id);
        const ok = st && levelOk(st) && tuitionOk(st);
        h += `<div class="card gap ms-pop" style="border-top:4px solid var(--gold)"><p class="ms-kicker">MINESUP · HND / BTS</p><h3>${LBL('Transcript or diploma', 'Relevé de notes ou diplôme')}</h3><p class="muted">${ok ? LBL('Your tuition is confirmed. You may complete the official bilingual application.', 'Votre scolarité est confirmée. Vous pouvez remplir la demande officielle bilingue.') : LBL('An ADI student account is required. The form opens only after Finance confirms that tuition is fully paid.', 'Un compte étudiant ADI est requis. Le formulaire s\'ouvre seulement après confirmation du paiement intégral de la scolarité.')}</p><div class="row">${cta()}</div></div>`;
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
      const u = me(), st = u && studentOf(u.id);
      let gate = '';
      try {
        if (st && tuitionOk(st)) sessionStorage.removeItem(feeGateKey);
        else if (sessionStorage.getItem(feeGateKey) === '1') gate = `<div class="note bad ms-pop"><b>${LBL('MINESUP form locked', 'Formulaire MINESUP verrouillé')}</b><br>${LBL('Pay the full tuition. The form opens only after the officer in charge confirms the payment.', 'Payez la totalité de la scolarité. Le formulaire s\'ouvre seulement après confirmation par le responsable.')}</div>`;
      } catch (e) {}
      return gate + baseF();
    };
  }

  const at = Math.max(0, ROUTES.findIndex(r => r.id === 'fees-me'));
  ROUTES.splice(at + 1, 0, { id: 'minesup', k: 'ms_menu', perm: 'fees_pay', v: viewMinesup });
  const at2 = ROUTES.findIndex(r => r.id === 'students');
  ROUTES.splice(at2 < 0 ? ROUTES.length : at2 + 1, 0, { id: 'minesup-admin', k: 'ms_admin', perm: 'manage_students', v: viewMinesupAdmin });

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
    return `<p class="ms-kicker">MINESUP · ${LBL('Ministry of Higher Education', 'Ministère de l\'Enseignement Supérieur')}</p><h2>${LBL('Application for HND/BTS transcript or diploma', 'Demande de relevé ou de diplôme HND/BTS')}</h2><p class="muted">${LBL('The form is bilingual. Read every line before you submit. A false declaration may lead to rejection and legal action.', 'Le formulaire est bilingue. Lisez chaque ligne avant l\'envoi. Toute fausse déclaration peut entraîner le rejet et des poursuites.')}</p>`;
  }
  function criteria() {
    const items = [
      ['You are an ADI student with a portal account linked to your matricule.', 'Vous êtes étudiant(e) à ADI, avec un compte du portail lié à votre matricule.'],
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

  function viewMinesup() {
    const u = me();
    if (!u) return `<h2>MINESUP</h2><div class="note">${LBL('Create an ADI portal account and sign in. Only ADI students can apply.', 'Créez un compte sur le portail ADI et connectez-vous. Seuls les étudiants ADI peuvent postuler.')}</div><p><a class="btn" href="#/login">${LBL('Sign in', 'Connexion')}</a> <a class="btn ghost" href="#/signup">${LBL('Create account', 'Créer un compte')}</a></p>`;
    if (u.role !== 'student') {
      return head() + `<div class="note">${LBL('This application is only for ADI students with a linked matricule.', 'Cette demande est réservée aux étudiants ADI dont le matricule est lié au compte.')}</div>` + (can('manage_students') ? `<p><a class="btn" href="#/minesup-admin">${LBL('Review applications', 'Examiner les demandes')}</a></p>` : '');
    }
    const st = studentOf(u.id);
    if (!st) return head() + `<div class="note bad">${LBL('Your account is not linked to a student record. Ask the Registry to link your matricule.', 'Votre compte n\'est pas lié à un dossier étudiant. Demandez à la scolarité de lier votre matricule.')}</div>`;
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
        <div class="grid g2">${lock('Qualification', 'Diplôme', st.level)}${lock('Specialty or option', 'Spécialité ou option', spec)}${lock('Institution', 'Établissement', 'American Ditek Institute (ADI University)')}${lock('Matricule', 'Matricule', st.matric)}${inp('ms.gradYear', both('Academic year of graduation', 'Année d\'obtention'), { type: 'number', ph: String(new Date().getFullYear()) })}${inp('ms.session', both('Examination session', 'Session d\'examen'), { ph: 'June 2026 / Juin 2026' })}${inp('ms.resultDate', both('Date of result publication', 'Date de publication des résultats'), { type: 'date' })}</div>
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
      <section class="ms-sec"><h3><span class="ms-num">E</span> ${both('Documents attached', 'Pièces jointes')}</h3>
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
  function clientError(st) {
    const p = payload(st), id = FORMS.ms.id;
    if (!p.types.diploma && !p.types.transcript && !p.types.duplicate && !p.types.copy) return LBL('Choose at least one document.', 'Cochez au moins un document.');
    if (!p.certName || !p.dob || !p.pob || !p.sex || !p.nationality || !p.nid || !p.phone || !p.email || !p.postal) return LBL('Complete every personal field.', 'Complétez toutes les informations personnelles.');
    if (!/^\d{4}$/.test(p.gradYear) || !p.session || !p.resultDate) return LBL('Complete the academic information.', 'Complétez les informations académiques.');
    if (p.reason === 'other' && !(p.reasonOther || '').trim()) return LBL('Specify the other reason.', 'Précisez le motif.');
    if (p.delivery === 'school' && (!(p.destName || '').trim() || !(p.destAddr || '').trim())) return LBL('Enter the institution name and address.', 'Indiquez le nom et l\'adresse de l\'établissement.');
    if (!p.signName || !p.place || !p.declDate || !p.agree) return LBL('Complete and accept the declaration.', 'Complétez et acceptez la déclaration.');
    if (!p.photos2) return LBL('Confirm the two passport photographs.', 'Confirmez les deux photos d\'identité.');
    if (!hasD(id, 'id') || !hasD(id, 'birth') || !hasD(id, 'results') || !hasD(id, 'receipt') || !hasD(id, 'photo')) return LBL('Upload the national ID, birth certificate, result slip, fee receipt and a passport photograph. Set the correct document type on each file.', 'Envoyez la CNI, l\'acte de naissance, le relevé, le reçu des frais et une photo d\'identité, avec le bon type pour chaque fichier.');
    if (p.reason === 'lost' && !hasD(id, 'police')) return LBL('Upload the police loss declaration.', 'Envoyez la déclaration de perte.');
    if (p.delivery === 'rep' && !hasD(id, 'auth')) return LBL('Upload the authorisation letter.', 'Envoyez la lettre d\'autorisation.');
    return '';
  }
  function summary(st) {
    const p = payload(st);
    const docs = ['diploma', 'transcript', 'duplicate', 'copy'].filter(k => p.types[k]).join(', ');
    const rows = [
      ['Name / Nom', p.certName], ['Matricule', st.matric], ['Programme', st.level + ' — ' + progName(st.specId)],
      ['Documents', docs], ['Reason / Motif', p.reason], ['Delivery / Remise', p.delivery],
      ['Phone / Téléphone', p.phone], ['Email', p.email]
    ];
    return `<ul class="ms-criteria">${rows.map(r => `<li><span class="ms-dot"></span><span><b>${esc(r[0])}:</b> ${esc(r[1])}</span></li>`).join('')}</ul>`;
  }

  ACT.msnew = () => { FORMS.msNew = true; FORMS.ms = null; render(); };
  ACT.msask = () => {
    const u = me(), st = u && studentOf(u.id);
    if (!st || !tuitionOk(st)) { hopFees(); return; }
    const err = clientError(st);
    if (err) return toast(err, 1);
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
    const u = me(), st = u && studentOf(u.id);
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
      [!!(st && st.userId), LBL('Linked ADI student account', 'Compte étudiant ADI lié')],
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
    if (!rows.length) return h + `<div class="note">${LBL('No applications yet.', 'Aucune demande pour le moment.')}</div>`;
    h += table(
      [LBL('Reference', 'Référence'), LBL('Student', 'Étudiant'), LBL('Programme', 'Programme'), LBL('Status', 'Statut'), ''],
      rows.map(a => {
        const au = auditApp(a);
        return [esc(a.ref || '—'), esc(a.name) + `<div class="small muted">${esc(a.matric)}</div>`, esc(a.level), statusBadge(a.status) + `<div class="small">${au.ok ? '<span class="ms-pass">✓</span>' : '<span class="ms-fail">!</span>'} ${LBL('eligibility', 'éligibilité')}`, `<a class="btn sm" href="#/minesup-admin/${esc(a.id)}">${LBL('Open', 'Ouvrir')}</a> <button class="btn sm ghost" data-a="mspdf" data-id="${esc(a.id)}">PDF</button>`];
      })
    );
    return h;
  }
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
    const d = pdfBase(LBL('MNESUP HND/BTS APPLICATION', 'DEMANDE MINESUP HND/BTS'));
    const W = 210;
    let y = 54;
    const need = h => { if (y + h > 236) { d.addPage(); y = 20; d.setFont('times', 'bold'); d.setFontSize(9); d.setTextColor(11, 37, 89); d.text('ADI University  ·  ' + (a.ref || 'MINESUP'), 14, 12); d.setDrawColor(11, 37, 89); d.setLineWidth(0.3); d.line(14, 15, 196, 15); d.setTextColor(0); y = 22; } };
    const biLine = (en, fr, gap) => {
      need(12); d.setFont('times', 'bold'); d.setFontSize(11); d.setTextColor(11, 37, 89); d.text(en, 14, y); y += 4.4;
      d.setFont('times', 'italic'); d.setFontSize(9); d.setTextColor(80); d.text(fr, 14, y); d.setTextColor(0); y += gap == null ? 6 : gap;
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
    kv('Matricule', 'Matricule', a.matric);
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
})();
