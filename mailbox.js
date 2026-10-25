'use strict';
/* ADI institutional mail — @adiuniversity.com — admission and appointment letters. */
(function () {
  if (window.__MB_INSTALLED) return;
  window.__MB_INSTALLED = true;
  if (typeof COLS === 'undefined' || typeof S === 'undefined') return;

  const LBL = (en, fr) => (typeof LANG !== 'undefined' && LANG === 'fr') ? fr : en;
  L.mb_menu = ['ADI email', 'Courriel ADI'];

  let tries = 0;
  function syncMail() {
    if (!COLS.includes('mailbox')) COLS.push('mailbox');
    if (!S.mailbox) S.mailbox = {};
    if (typeof MODE !== 'undefined' && MODE === 'api' && typeof apiSync === 'function') { apiSync(); return; }
    if (typeof MODE !== 'undefined' && MODE === 'local') return;
    if (++tries < 20) setTimeout(syncMail, 300);
  }
  syncMail();

  let DESK = null;
  function mineOf() {
    const u = me();
    if (!u) return null;
    return Object.values(S.mailbox || {}).find(m => m && m.userId === u.id && m.status !== 'revoked') || (DESK && DESK.mine) || null;
  }

  function refresh(done) {
    const who = (typeof me === 'function' && me() && me().id) || '';
    api('/api/mail/desk').then(d => { DESK = Object.assign({ _for: who }, d); if (done) done(); else if (typeof render === 'function') render(); }).catch(e => {
      DESK = { error: (e && e.message) || 'error', officer: false, mine: null, rows: [], _for: who };
      if (typeof render === 'function') render();
    });
  }

  const dash = ROUTES.find(r => r.id === 'dashboard');
  if (dash) {
    const base = dash.v;
    dash.v = function () {
      let h = base();
      const u = me(); if (!u) return h;
      const m = mineOf();
      if (m) {
        h += `<div class="card gap mb-cred"><p class="mb-kicker">ADI · @adiuniversity.com</p><h3>${LBL('Your institutional address', 'Votre adresse institutionnelle')}</h3><div class="mb-addr">${esc(m.email)}</div><p class="muted">${m.status === 'pending_setup' ? LBL('Activate it with the one-time password on your letter.', 'Activez-la avec le mot de passe à usage unique figurant sur votre lettre.') : m.status === 'suspended' ? LBL('This mailbox is suspended.', 'Cette messagerie est suspendue.') : LBL('This mailbox is active.', 'Cette messagerie est active.')}</p><a class="btn gold" href="#/mail">${LBL('Open mailbox', 'Ouvrir la messagerie')}</a></div>`;
      } else if (u.role === 'applicant') {
        h += `<div class="card gap"><p class="mb-kicker">ADI · @adiuniversity.com</p><h3>${LBL('Institutional email', 'Courriel institutionnel')}</h3><p class="muted">${LBL('An @adiuniversity.com address is created automatically when you are admitted. The one-time password is printed on your admission letter.', 'Une adresse @adiuniversity.com est créée automatiquement lors de votre admission. Le mot de passe à usage unique est imprimé sur votre lettre d\'admission.')}</p></div>`;
      } else if (u.role === 'super_admin' || (DESK && DESK.officer)) {
        const n = DESK && DESK.rows ? DESK.rows.filter(r => r.status === 'pending_setup').length : 0;
        h += `<div class="card gap mb-cred"><p class="mb-kicker">ADI · @adiuniversity.com</p><h3>${LBL('Mailbox directory', 'Annuaire des messageries')}</h3><p class="muted">${LBL('Addresses are issued when a student is admitted or a lecturer or staff member is appointed.', 'Les adresses sont délivrées lorsqu\'un étudiant est admis ou qu\'un enseignant ou un membre du personnel est nommé.')}</p>${n ? `<div class="kpi">${n}</div><p class="small muted">${LBL('awaiting activation', 'en attente d\'activation')}</p>` : ''}<a class="btn" href="#/mail">${LBL('Manage mailboxes', 'Gérer les messageries')}</a></div>`;
      }
      return h;
    };
  }

  function policy() {
    const items = [
      ['The address is surname.given@adiuniversity.com, from the first two names on the record.', 'L\'adresse est nom.prenom@adiuniversity.com, à partir des deux premiers noms du dossier.'],
      ['Students receive it at admission. Lecturers and staff receive it when they are appointed.', 'Les étudiants la reçoivent à l\'admission. Les enseignants et le personnel la reçoivent lors de la nomination.'],
      ['The one-time password is printed on the letter and works until the mailbox is activated.', 'Le mot de passe à usage unique est imprimé sur la lettre et fonctionne jusqu\'à l\'activation.'],
      ['The super administrator decides which administrators may manage the directory.', 'Le super administrateur décide quels administrateurs peuvent gérer l\'annuaire.']
    ];
    return `<ul class="mb-policy">${items.map(x => `<li><span class="ms-dot"></span><span>${esc(x[0])}<span class="mb-fr">${esc(x[1])}</span></span></li>`).join('')}</ul>`;
  }

  function statusBadge(st) {
    const map = { pending_setup: ['Awaiting activation', 'En attente d\'activation', 'warn'], active: ['Active', 'Active', 'ok'], suspended: ['Suspended', 'Suspendue', 'bad'] };
    const x = map[st] || [st, st, 'mute'];
    return badge(LBL(x[0], x[1]), x[2]);
  }

  function credCard(m, opts) {
    if (!m) return '';
    opts = opts || {};
    const show = opts.reveal && m.otp;
    return `<div class="mb-cred">
      ${opts.seal || ''}
      <p class="mb-kicker">${esc(m.ref || 'ADI MAIL')}</p>
      <h3 style="margin-top:0">${esc(m.name || '')}</h3>
      <div class="mb-addr">${esc(m.email)}</div>
      <div class="mb-row" style="margin-top:8px">${statusBadge(m.status)}${m.kind ? badge(LBL(m.kind === 'student' ? 'Student' : m.kind === 'lecturer' ? 'Lecturer' : m.kind === 'applicant' ? 'Applicant' : 'Staff', m.kind === 'student' ? 'Étudiant' : m.kind === 'lecturer' ? 'Enseignant' : m.kind === 'applicant' ? 'Candidat' : 'Personnel'), 'info') : ''}</div>
      ${show ? `<p class="small muted" style="margin:10px 0 0">${LBL('One-time password', 'Mot de passe à usage unique')}</p><div class="mb-otp">${esc(m.otp)}</div><p class="small">${LBL('Hand this only to the person named above. It disappears from the letter once the mailbox is activated.', 'Remettez-le uniquement à la personne nommée ci-dessus. Il disparaît de la lettre une fois la messagerie activée.')}</p>` : (m.status === 'pending_setup' ? `<p class="muted" style="margin-top:8px">${LBL('The one-time password is on the letter. Reveal it here only when you are ready to hand it over.', 'Le mot de passe à usage unique figure sur la lettre. Affichez-le ici seulement au moment de le remettre.')}</p>` : `<p class="muted" style="margin-top:8px">${LBL('Activated. The one-time password is no longer shown.', 'Activée. Le mot de passe à usage unique n\'est plus affiché.')}</p>`)}
      <div class="mb-meta">
        <div><span>${LBL('Personal email', 'Courriel personnel')}</span><b>${esc(m.personalEmail || '—')}</b></div>
        <div><span>${LBL('Matricule / file', 'Matricule / dossier')}</span><b>${esc(m.matric || m.hrRef || '—')}</b></div>
        <div><span>${LBL('Issued', 'Délivrée')}</span><b>${m.issuedAt ? new Date(m.issuedAt).toLocaleDateString() : '—'}</b></div>
      </div>
    </div>`;
  }

  function viewMail() {
    const u = me();
    if (!u) return `<div class="note">${LBL('Please sign in to open your ADI mailbox.', 'Veuillez vous connecter pour ouvrir votre messagerie ADI.')}</div>`;
    if (!DESK || DESK._for !== u.id) {
      DESK = { loading: true, _for: u.id, officer: u.role === 'super_admin', mine: mineOf(), rows: [] };
      refresh();
    }
    if (DESK.loading) return `<p class="mb-kicker">ADI · @adiuniversity.com</p><h2>${LBL('Institutional email', 'Courriel institutionnel')}</h2><div class="card">${LBL('Loading the directory…', 'Chargement de l\'annuaire…')}</div>`;
    if (DESK.error && !DESK.mine && !DESK.officer) return `<div class="note bad">${esc(DESK.error)}</div>`;
    const mine = DESK.mine || mineOf();
    let h = `<p class="mb-kicker">American Ditek Institute · @adiuniversity.com</p><h2>${DESK.officer ? LBL('Institutional mailbox directory', 'Annuaire de la messagerie institutionnelle') : LBL('Your ADI email', 'Votre courriel ADI')}</h2>`;
    h += `<div class="note">${policy()}</div>`;
    if (mine) {
      h += credCard(mine, { reveal: true, seal: (typeof SIGS !== 'undefined' && SIGS && SIGS.seal) ? `<img class="mb-seal" alt="" src="data:image/png;base64,${SIGS.seal.png}">` : '' });
      if (mine.status === 'pending_setup') {
        if (!FORMS.mb) FORMS.mb = { otp: '', password: '', password2: '' };
        h += `<div class="card gap"><h3>${LBL('Activate this mailbox', 'Activer cette messagerie')}</h3><p class="muted">${LBL('Please enter the one-time password from your letter, then choose your own password. At least 10 characters, with a letter and a digit.', 'Veuillez saisir le mot de passe à usage unique de votre lettre, puis choisissez le vôtre. Au moins 10 caractères, avec une lettre et un chiffre.')}</p><div class="grid g2">${inp('mb.otp', LBL('One-time password', 'Mot de passe à usage unique'))}${inp('mb.password', LBL('New password', 'Nouveau mot de passe'), { type: 'password' })}${inp('mb.password2', LBL('Confirm password', 'Confirmer le mot de passe'), { type: 'password' })}</div><button class="btn gold" data-a="mailsetup">${LBL('Activate mailbox', 'Activer la messagerie')}</button></div>`;
      }
      h += `<p><button class="btn" data-a="maildl" data-id="${esc(mine.id)}">${LBL('Download letter page', 'Télécharger la page de la lettre')}</button></p>`;
    } else if (!DESK.officer) {
      h += `<div class="card"><p>${u.role === 'applicant' ? LBL('Your address is created when the admissions office admits you. It will appear on your admission letter.', 'Votre adresse est créée lorsque le service des admissions vous admet. Elle figurera sur votre lettre d\'admission.') : LBL('No institutional mailbox is linked to this account yet.', 'Aucune messagerie institutionnelle n\'est encore liée à ce compte.')}</p></div>`;
    }
    if (DESK.officer) {
      h += `<h3 class="gap">${LBL('Directory', 'Annuaire')}</h3><div class="mb-dir">`;
      const rows = DESK.rows || [];
      if (!rows.length) h += `<div class="card">${LBL('No mailboxes yet. Admit a student or appoint a lecturer or staff member.', 'Aucune messagerie pour le moment. Admettez un étudiant ou nommez un enseignant ou un membre du personnel.')}</div>`;
      rows.forEach(m => {
        h += `<article class="mb-person">${credCard(m, { reveal: false })}<div class="mb-row" style="margin-top:10px"><button class="btn sm" data-a="maildl" data-id="${esc(m.id)}">${LBL('Letter', 'Lettre')}</button>`;
        if (m.status === 'pending_setup') {
          h += `<button class="btn sm ghost" data-a="mailshow" data-id="${esc(m.id)}">${LBL('Reveal password', 'Afficher le mot de passe')}</button>`;
          h += `<button class="btn sm ghost" data-a="mailrename" data-id="${esc(m.id)}">${LBL('Change address', 'Modifier l\'adresse')}</button>`;
        }
        if (m.status !== 'suspended') h += `<button class="btn sm red" data-a="mailsuspend" data-id="${esc(m.id)}">${LBL('Suspend', 'Suspendre')}</button>`;
        else h += `<button class="btn sm" data-a="mailrestore" data-id="${esc(m.id)}">${LBL('Restore', 'Rétablir')}</button>`;
        h += `<button class="btn sm ghost" data-a="mailreset" data-id="${esc(m.id)}">${LBL('New one-time password', 'Nouveau mot de passe')}</button></div></article>`;
      });
      h += `</div>`;
      const waiting = DESK.waiting || [], hired = DESK.hired || [];
      if (waiting.length || hired.length) {
        h += `<h3 class="gap">${LBL('Not yet issued', 'Pas encore délivrées')}</h3><div class="card">`;
        waiting.forEach(s => { h += `<div class="row" style="margin:6px 0"><div class="grow"><b>${esc(s.name)}</b><div class="small muted">${esc(s.matric)} · ${esc(s.status)}</div></div><button class="btn sm gold" data-a="mailissue" data-user="${esc(s.userId)}">${LBL('Issue address', 'Délivrer l\'adresse')}</button></div>`; });
        hired.forEach(s => { h += `<div class="row" style="margin:6px 0"><div class="grow"><b>${esc(s.name)}</b><div class="small muted">${esc(s.ref)} · ${esc(s.title || s.cat)}</div></div><button class="btn sm gold" data-a="mailissuehr" data-hr="${esc(s.id)}">${LBL('Issue address', 'Délivrer l\'adresse')}</button></div>`; });
        h += `</div>`;
      }
      if (DESK.super) {
        const f = FORMS.mbs || (FORMS.mbs = { name: '', role: 'lecturer', personalEmail: '', phone: '', local: '', title: '' }), out = FORMS.mbsOut;
        const fold = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(w => w.length >= 2);
        const sug = (f.local || '').trim().toLowerCase() || (fold(f.name).length >= 2 ? fold(f.name)[0] + '.' + fold(f.name)[1] : '');
        h += `<div class="card gap"><p class="mb-kicker">ADI · @adiuniversity.com</p><h3>${LBL('Open an address for a staff member', 'Ouvrir une adresse pour un membre du personnel')}</h3><p class="muted">${LBL('Enter the staff member\'s name. The address is formed from the first name and the surname (for example ebai.william@adiuniversity.com). You receive a one-time password to give to the staff member, who uses it to sign in and then chooses their own password.', 'Saisissez le nom du membre du personnel. L\'adresse est formée du prénom et du nom (par exemple ebai.william@adiuniversity.com). Vous obtenez un mot de passe à usage unique à remettre au membre du personnel, qui l\'utilise pour se connecter puis choisit son propre mot de passe.')}</p>
          <div class="grid g2">${inp('mbs.name', LBL('Full name', 'Nom complet'))}${sel('mbs.role', LBL('Role', 'Fonction'), [['lecturer', LBL('Lecturer', 'Enseignant')], ['x_staff', LBL('Administrative / support staff', 'Personnel administratif / d\'appui')], ['admin', LBL('Administrator', 'Administrateur')]], { blank: false })}${inp('mbs.title', LBL('Job title (optional)', 'Intitulé du poste (facultatif)'))}${inp('mbs.personalEmail', LBL('Personal email (optional)', 'Courriel personnel (facultatif)'), { type: 'email' })}${inp('mbs.phone', LBL('Phone (optional)', 'Téléphone (facultatif)'))}${inp('mbs.local', LBL('Custom address start (optional)', 'Début d\'adresse personnalisé (facultatif)'))}</div>
          <p class="small">${LBL('Address preview', 'Aperçu de l\'adresse')}: <b>${esc(sug || '…')}@adiuniversity.com</b></p><p><button class="btn gold" data-a="mailstaff">${LBL('Generate address and one-time password', 'Générer l\'adresse et le mot de passe à usage unique')}</button></p>
          ${out ? `<div class="note mb-out"><b>${esc(out.name)}</b><br>${LBL('Address', 'Adresse')}: <b>${esc(out.email)}</b><br>${LBL('One-time password', 'Mot de passe à usage unique')}: <b style="font-size:1.2em;letter-spacing:.04em">${esc(out.otp)}</b><br><span class="small">${LBL('Give both to the staff member. They sign in on the portal with this address and this password, then choose their own password. The password stops working once they have done so.', 'Remettez les deux au membre du personnel. Il se connecte au portail avec cette adresse et ce mot de passe, puis choisit son propre mot de passe. Le mot de passe cesse de fonctionner dès que c\'est fait.')}</span><p><button class="btn sm" data-a="mailcopy" data-t="${esc(out.email + '\n' + out.otp)}">${LBL('Copy address and password', 'Copier l\'adresse et le mot de passe')}</button></p></div>` : ''}</div>`;
      }
      if (DESK.super && DESK.acl) {
        if (!FORMS.acl) FORMS.acl = { email: (DESK.acl.people || []).map(p => p.email).filter(Boolean).join('\n'), admin: DESK.acl.admin !== false };
        h += `<div class="card gap"><h3>${LBL('Who may manage mailboxes', 'Qui peut gérer les messageries')}</h3><p class="muted">${LBL('The super administrator always can. Administrators can when this switch is on. Other staff listed below may also manage the directory.', 'Le super administrateur le peut toujours. Les administrateurs le peuvent lorsque ce choix est activé. Les autres personnels listés ci-dessous peuvent aussi gérer l\'annuaire.')}</p><label class="row" style="min-height:44px"><input type="checkbox" data-f="acl.admin" ${FORMS.acl.admin ? 'checked' : ''}> ${LBL('All administrators', 'Tous les administrateurs')}</label>${area('acl.email', LBL('Staff allowed to manage mailboxes', 'Personnels autorisés à gérer les messageries'))}<button class="btn" data-a="mailacl">${LBL('Save access', 'Enregistrer l\'accès')}</button></div>`;
      }
    }
    return h;
  }

  const at = Math.max(0, ROUTES.findIndex(r => r.id === 'profile'));
  ROUTES.splice(at < 0 ? ROUTES.length : at, 0, { id: 'mail', k: 'mb_menu', v: viewMail });

  function run(el, fn) {
    el.disabled = true;
    Promise.resolve(fn()).then(() => refresh()).catch(e => toast(apiErr(e), 1)).finally(() => { el.disabled = false; });
  }
  ACT.mailsetup = el => {
    const f = FORMS.mb || {};
    if (!f.otp || !f.password) return toast(LBL('Please enter the one-time password and a new password.', 'Veuillez saisir le mot de passe à usage unique et un nouveau mot de passe.'), 1);
    if (f.password !== f.password2) return toast(LBL('The passwords do not match.', 'Les mots de passe ne correspondent pas.'), 1);
    run(el, () => api('/api/mail/setup', { body: { otp: f.otp, password: f.password } }).then(() => { FORMS.mb = { otp: '', password: '', password2: '' }; toast(LBL('Mailbox activated.', 'Messagerie activée.')); }));
  };
  ACT.mailstaff = el => {
    const f = FORMS.mbs || {}; if (!String(f.name || '').trim()) return toast(LBL('Enter the staff member\'s full name.', 'Veuillez saisir le nom complet du membre du personnel.'), 1);
    run(el, () => api('/api/mail/issue-staff', { body: { name: f.name, role: f.role, title: f.title, personalEmail: f.personalEmail, phone: f.phone, local: f.local, lang: LANG } }).then(r => { FORMS.mbsOut = { name: r.mailbox.name, email: r.mailbox.email, otp: r.mailbox.otp }; FORMS.mbs = { name: '', role: f.role, personalEmail: '', phone: '', local: '', title: '' }; toast(r.mailbox.email); }));
  };
  ACT.mailcopy = el => { const t0 = el.dataset.t || ''; try { navigator.clipboard.writeText(t0).then(() => toast(LBL('Copied.', 'Copié.'))); } catch (e) { toast(t0); } };
  ACT.mailissue = el => run(el, () => api('/api/mail/issue', { body: { userId: el.dataset.user } }).then(r => toast((r.mailbox && r.mailbox.email) || LBL('Issued', 'Délivrée'))));
  ACT.mailissuehr = el => run(el, () => api('/api/mail/issue', { body: { hrId: el.dataset.hr } }).then(r => toast((r.mailbox && r.mailbox.email) || LBL('Issued', 'Délivrée'))));
  ACT.mailsuspend = el => run(el, () => api('/api/mail/suspend', { body: { id: el.dataset.id } }));
  ACT.mailrestore = el => run(el, () => api('/api/mail/restore', { body: { id: el.dataset.id } }));
  ACT.mailreset = el => run(el, () => api('/api/mail/reset', { body: { id: el.dataset.id } }).then(r => { if (r.mailbox && r.mailbox.otp) toast(r.mailbox.email + ' · ' + r.mailbox.otp); }));
  ACT.mailshow = el => {
    const row = (DESK && DESK.rows || []).find(m => m.id === el.dataset.id) || (DESK && DESK.mine && DESK.mine.id === el.dataset.id ? DESK.mine : null);
    if (row && row.otp) { toast(row.otp); return; }
    run(el, () => api('/api/mail/reveal', { body: { id: el.dataset.id } }).then(r => { if (r.mailbox && r.mailbox.otp) toast(r.mailbox.otp); else toast(LBL('Already activated.', 'Déjà activée.'), 1); }));
  };
  ACT.mailrename = el => {
    const local = window.prompt(LBL('New address before @adiuniversity.com (surname.given)', 'Nouvelle adresse avant @adiuniversity.com (nom.prenom)'));
    if (!local) return;
    run(el, () => api('/api/mail/rename', { body: { id: el.dataset.id, local: local.trim().toLowerCase() } }));
  };
  ACT.mailacl = el => {
    const f = FORMS.acl || {};
    run(el, () => api('/api/mail/acl', { body: { admin: !!f.admin, emails: String(f.email || '').split(/[\s,;]+/).filter(Boolean) } }));
  };

  function offerDownload(name, data, mime) {
    const blob = new Blob([data], { type: mime || 'application/pdf' });
    const url = URL.createObjectURL(blob);
    let host = document.getElementById('mb-dl');
    if (!host) { host = document.createElement('div'); host.id = 'mb-dl'; document.body.appendChild(host); }
    if (host._url) URL.revokeObjectURL(host._url);
    host._url = url;
    host.innerHTML = `<div class="modal"><div class="box mb-dlbox" role="dialog" aria-modal="true">
      <p class="mb-kicker">PDF</p>
      <h3 style="margin-top:0">${esc(LBL('Your document is ready', 'Votre document est prêt'))}</h3>
      <p class="muted">${esc(name)}</p>
      <div class="mb-row mb-dlnav" id="mb-dl-nav" hidden>
        <button type="button" class="btn sm" id="mb-dl-prev">&larr; ${esc(LBL('Back', 'Retour'))}</button>
        <span class="small muted grow" id="mb-dl-count" style="text-align:center"></span>
        <button type="button" class="btn sm" id="mb-dl-next">${esc(LBL('Next', 'Suivant'))} &rarr;</button>
      </div>
      <div class="mb-dlframe mb-dlpages" id="mb-dl-pages" aria-label="PDF preview"><p class="small muted" style="padding:12px">${esc(LBL('Preparing preview…', 'Préparation de l\'aperçu…'))}</p></div>
      <div class="mb-row" style="margin-top:12px">
        <a class="btn gold lg" id="mb-dl-a">${esc(LBL('Save the PDF', 'Enregistrer le PDF'))}</a>
        <button type="button" class="btn ghost" id="mb-dl-x">${esc(LBL('Close', 'Fermer'))}</button>
      </div>
      <p class="small muted">${esc(LBL('On a phone, tap Save. The file goes to Downloads. You can also read it above.', 'Sur un téléphone, appuyez sur Enregistrer. Le fichier va dans Téléchargements. Vous pouvez aussi le lire ci-dessus.'))}</p>
    </div></div>`;
    const a = host.querySelector('#mb-dl-a');
    a.href = url;
    a.setAttribute('download', name);
    const close = () => { host.innerHTML = ''; if (host._url) { URL.revokeObjectURL(host._url); host._url = ''; } };
    host.querySelector('#mb-dl-x').addEventListener('click', close);
    host.querySelector('.modal').addEventListener('click', e => { if (e.target.classList.contains('modal')) close(); });
    paintPreview(host.querySelector('#mb-dl-pages'), data, url);
    return true;
  }

  // Phone browsers cannot show a PDF inside an iframe, so draw each page onto a canvas with pdf.js.
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf';
  let pdfjsLoad = null;
  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (!pdfjsLoad) pdfjsLoad = new Promise((ok, no) => {
      const s = document.createElement('script');
      s.src = PDFJS + '.min.js';
      s.onload = () => { window.pdfjsLib ? (window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + '.worker.min.js', ok(window.pdfjsLib)) : no(new Error('pdfjs')); };
      s.onerror = () => { pdfjsLoad = null; no(new Error('pdfjs')); };
      document.head.appendChild(s);
    });
    return pdfjsLoad;
  }
  function paintPreview(box, data, url) {
    const nav = document.getElementById('mb-dl-nav');
    const prev = document.getElementById('mb-dl-prev');
    const next = document.getElementById('mb-dl-next');
    const count = document.getElementById('mb-dl-count');
    const fallback = () => { if (nav) nav.hidden = true; box.outerHTML = `<iframe class="mb-dlframe" title="PDF" src="${url}"></iframe>`; };
    loadPdfJs().then(lib => lib.getDocument({ data: new Uint8Array(data.slice ? data.slice(0) : data) }).promise).then(pdf => {
      if (!box.isConnected) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      let cur = 1, busy = false, want = 0;
      const show = async n => {
        if (busy) { want = n; return; }
        busy = true; cur = n;
        prev.disabled = cur <= 1; next.disabled = cur >= pdf.numPages;
        count.textContent = LBL('Page ', 'Page ') + cur + ' / ' + pdf.numPages;
        try {
          const page = await pdf.getPage(cur);
          const width = Math.max(240, box.clientWidth - 16);
          const base = page.getViewport({ scale: 1 });
          const vp = page.getViewport({ scale: (width / base.width) * ratio });
          const c = document.createElement('canvas');
          c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
          c.style.cssText = 'display:block;width:100%;height:auto;margin:0 auto;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.25)';
          await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
          if (!box.isConnected) return;
          box.innerHTML = ''; box.appendChild(c); box.scrollTop = 0;
        } finally {
          busy = false;
          if (want && want !== cur) { const w = want; want = 0; show(w); } else want = 0;
        }
      };
      prev.addEventListener('click', () => { if (cur > 1) show(cur - 1); });
      next.addEventListener('click', () => { if (cur < pdf.numPages) show(cur + 1); });
      nav.hidden = false;
      return show(1);
    }).catch(() => { if (box.isConnected) fallback(); });
  }

  function paintCredential(d, m) {
    if (!m || !m.email || typeof d.addPage !== 'function') return;
    d.addPage();
    const W = 210;
    d.setFont('times', 'bold'); d.setFontSize(12); d.setTextColor(11, 37, 89);
    d.text('INSTITUTIONAL ELECTRONIC MAIL', W / 2, 52, { align: 'center' });
    d.setFont('times', 'italic'); d.setFontSize(11); d.setTextColor(70, 80, 105);
    d.text('MESSAGERIE ÉLECTRONIQUE INSTITUTIONNELLE', W / 2, 58, { align: 'center' });
    d.setTextColor(0);
    let y = 68;
    d.setFont('times', 'normal'); d.setFontSize(10.5);
    const blocks = [
      ['This address is your official ADI identity. Sign in to the portal with it and the one-time password, then choose your own password. Do not share the one-time password. After activation it is no longer printed.',
        'Cette adresse est votre identité officielle à l\'ADI. Connectez-vous au portail avec elle et le mot de passe à usage unique, puis choisissez votre mot de passe. Ne communiquez pas le mot de passe à usage unique. Après activation, il n\'est plus imprimé.']
    ];
    blocks.forEach(pair => {
      d.setFont('times', 'normal'); d.setFontSize(10.5); d.setTextColor(0);
      d.splitTextToSize(pair[0], 176).forEach(line => { d.text(line, 18, y); y += 4.6; });
      y += 1;
      d.setFont('times', 'italic'); d.setFontSize(10); d.setTextColor(70, 80, 105);
      d.splitTextToSize(pair[1], 176).forEach(line => { d.text(line, 18, y); y += 4.4; });
      y += 4; d.setTextColor(0);
    });
    d.setDrawColor(11, 37, 89); d.setLineWidth(.4);
    d.rect(18, y, 174, m.otp ? 42 : 28);
    d.setFont('times', 'bold'); d.setFontSize(9); d.setTextColor(90, 98, 120);
    d.text('OFFICIAL ADDRESS  /  ADRESSE OFFICIELLE', 24, y + 7);
    d.setFont('courier', 'bold'); d.setFontSize(13); d.setTextColor(11, 37, 89);
    d.text(m.email, 24, y + 16);
    if (m.otp) {
      d.setFont('times', 'bold'); d.setFontSize(9); d.setTextColor(90, 98, 120);
      d.text('ONE-TIME PASSWORD  /  MOT DE PASSE À USAGE UNIQUE', 24, y + 24);
      d.setTextColor(164, 22, 32); d.setFont('courier', 'bold'); d.setFontSize(14);
      d.text(m.otp, 24, y + 33);
    } else {
      d.setFont('times', 'italic'); d.setFontSize(10); d.setTextColor(0);
      d.text('Activated / Activée — password already set.', 24, y + 24);
    }
    y += (m.otp ? 50 : 36);
    d.setFont('times', 'normal'); d.setFontSize(10); d.setTextColor(0);
    const lines = [
      ['Full name / Nom', m.name],
      ['Capacity / Qualité', (m.title || m.kind || '') + (m.titleFr ? '  /  ' + m.titleFr : '')],
      ['Reference / Référence', m.ref],
      ['Personal email / Courriel personnel', m.personalEmail || '—']
    ];
    lines.forEach(r => {
      d.setFont('times', 'normal'); d.setTextColor(80, 88, 110); d.text(r[0], 18, y);
      d.setFont('times', 'bold'); d.setTextColor(0); d.text(String(r[1] || '—'), 92, y); y += 6;
    });
    y += 4;
    d.setFont('times', 'italic'); d.setFontSize(9); d.setTextColor(90, 98, 120);
    d.text('Issued with the ADI round seal.  /  Délivré avec le sceau rond de l\'ADI.', 18, y);
    try {
      if (typeof SIGS !== 'undefined' && SIGS && SIGS.seal) {
        const s = SIGS.seal, w = 28, h = w * s.h / s.w;
        d.addImage('data:image/png;base64,' + s.png, 'PNG', 210 - 18 - w, Math.min(y + 4, 250), w, h);
      }
    } catch (e) {}
    d.setTextColor(0);
    if (typeof pdfFooter === 'function') pdfFooter(d);
  }

  async function credentialFor(id, appId) {
    const r = await api('/api/mail/reveal', { body: id ? { id } : { appId } });
    return r && r.mailbox;
  }

  if (typeof letterPDF === 'function') {
    const prevLetter = letterPDF;
    letterPDF = function (a) {
      const job = credentialFor(null, a && a.id).catch(() => null).then(m => {
        const prevSave = savePDF;
        savePDF = function (name, d) {
          try { if (m) paintCredential(d, m); } catch (e) {}
          if (typeof pdfSealLast === 'function') { try { pdfSealLast(d); } catch (e2) {} }
          savePDF = prevSave;
          return offerDownload(name, d.output('arraybuffer'), 'application/pdf');
        };
        try { return prevLetter(a); }
        finally { savePDF = prevSave; }
      });
      return job;
    };
  }

  /* Appointment letter text, drawn up to the conventions of international universities: confirmation of appointment, nature of the engagement, duties, terms, mailbox, acceptance. */
  function appointmentText(m) {
    const T = String(m.title || '').trim() || 'Member of staff', TF = String(m.titleFr || m.title || '').trim() || 'membre du personnel';
    const key = (m.title + ' ' + m.titleFr).toLowerCase();
    const k = /intern|stagiaire/.test(key) ? 'intern' : /consult/.test(key) ? 'consultant' : /adjunct|visiting|vacataire|part-time|temps partiel/.test(key) ? 'visiting' : /teaching assistant|assistant d/.test(key) ? 'assistant' : /senior|maître/.test(key) ? 'senior' : (m.kind === 'lecturer' ? 'lecturer' : /administrator|administrateur/.test(key) || m.role === 'admin' ? 'administrator' : /technical|technique/.test(key) ? 'technical' : 'staff');
    const fmt = (loc) => { try { return new Date(m.issuedAt || Date.now()).toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; } };
    const nat = {
      lecturer: ['This is a full-time academic appointment. You will teach the courses assigned to you, supervise and assess students\' work, take part in examinations and their moderation, and contribute to curriculum development, academic advising and the wider life of the University, in keeping with its statutes and the regulations of the Ministry of Higher Education.', 'Il s\'agit d\'une nomination académique à temps plein. Vous dispenserez les cours qui vous seront confiés, encadrerez et évaluerez les travaux des étudiants, participerez aux examens et à leur délibération, et contribuerez à l\'élaboration des programmes, à l\'orientation académique et à la vie de l\'Université, conformément à ses statuts et à la réglementation du Ministère de l\'Enseignement Supérieur.'],
      senior: ['This is a full-time senior academic appointment. In addition to teaching and the supervision of students, you will provide academic leadership in your discipline: guiding colleagues, contributing to programme design and quality assurance, and advancing scholarship and service to the community, in keeping with the statutes of the University and the regulations of the Ministry of Higher Education.', 'Il s\'agit d\'une nomination académique senior à temps plein. Outre l\'enseignement et l\'encadrement des étudiants, vous assurerez un leadership académique dans votre discipline : accompagnement des collègues, conception des programmes, assurance qualité, recherche et service à la communauté, conformément aux statuts de l\'Université et à la réglementation du Ministère de l\'Enseignement Supérieur.'],
      visiting: ['This is a part-time (visiting) appointment. You are engaged to teach the courses assigned to you in each semester, to assess your students fairly and to submit marks within the published deadlines. The appointment is for the period stated in your engagement agreement and carries no entitlement to continued engagement beyond it.', 'Il s\'agit d\'une nomination à temps partiel (enseignant invité ou vacataire). Vous êtes engagé(e) pour dispenser les cours qui vous seront confiés chaque semestre, évaluer équitablement vos étudiants et remettre les notes dans les délais publiés. La nomination vaut pour la période indiquée dans votre convention d\'engagement et n\'ouvre aucun droit à un engagement au-delà de celle-ci.'],
      assistant: ['In this role you will support the teaching of the course lecturers under their supervision: conducting tutorials and practical sessions, assisting with continuous assessment and marking, and helping students with their studies. The appointment also offers you a valuable opportunity for professional development within our academic community.', 'Dans cette fonction, vous appuierez l\'enseignement des responsables de cours sous leur supervision : travaux dirigés et pratiques, aide à l\'évaluation continue et à la correction, et accompagnement des étudiants. Cette nomination constitue aussi une précieuse occasion de développement professionnel au sein de notre communauté académique.'],
      administrator: ['In this senior administrative role you will lead the functions assigned to you, exercise the delegated authority that goes with them, and uphold the standards of governance, confidentiality and service expected of the University, reporting to the Administrative Director.', 'Dans cette fonction administrative de responsabilité, vous dirigerez les services qui vous sont confiés, exercerez l\'autorité déléguée qui s\'y attache et veillerez au respect des exigences de gouvernance, de confidentialité et de qualité de service de l\'Université, sous l\'autorité du Directeur administratif.'],
      staff: ['You will carry out the duties of your post, as described to you by your head of department, with diligence, integrity and discretion, and you will observe the working hours, policies and regulations of the University.', 'Vous exercerez les fonctions de votre poste, telles que précisées par votre chef de service, avec diligence, intégrité et discrétion, et vous respecterez les horaires, politiques et règlements de l\'Université.'],
      technical: ['You will provide the technical services of your post, maintain the equipment and systems in your care to a high standard, and support staff and students in their use, observing the safety rules, policies and regulations of the University.', 'Vous assurerez les services techniques de votre poste, entretiendrez avec soin les équipements et systèmes dont vous avez la charge et aiderez le personnel et les étudiants dans leur usage, dans le respect des règles de sécurité, des politiques et des règlements de l\'Université.'],
      consultant: ['You are engaged as a consultant for the scope of work and period agreed with the University. You will work independently, to the standard expected of your profession, and will treat all University information as confidential.', 'Vous êtes engagé(e) en qualité de consultant(e) pour la mission et la durée convenues avec l\'Université. Vous travaillerez de manière autonome, selon les normes de votre profession, et traiterez toute information de l\'Université comme confidentielle.'],
      intern: ['This is a fixed-term internship designed to give you structured professional experience. You will work under the guidance of a supervisor, who will set your tasks, review your progress and support your learning.', 'Il s\'agit d\'un stage de durée déterminée destiné à vous procurer une expérience professionnelle encadrée. Vous travaillerez sous la conduite d\'un superviseur, qui fixera vos tâches, suivra vos progrès et soutiendra votre apprentissage.']
    }[k];
    return {
      titleEn: T, titleFr: TF, dateEn: fmt('en-GB'), dateFr: fmt('fr-FR'),
      en: [
        'Dear ' + (m.name || 'Colleague') + ',',
        'On behalf of American Ditek Institute (ADI University), and further to the recommendation of the recruitment committee, it gives me great pleasure to confirm your appointment as ' + T + '. Your qualifications and experience impressed the committee, and we are confident that you will make a valued contribution to our academic community.',
        nat[0],
        'The terms of your engagement, including its duration, workload and remuneration, are set out in the contract issued by Human Resources, which should be read together with this letter. The appointment is subject to the verification of your academic and professional credentials and to the regulations of the University in force.',
        'With this letter, ADI opens your institutional mailbox; its details are on the following page. Please activate it within seven days, use it for all official correspondence, and keep the one-time password strictly confidential.',
        'Kindly confirm your acceptance in writing to Human Resources within seven days of receiving this letter. We warmly welcome you to ADI and look forward to a rewarding collaboration.',
        'Yours sincerely,'
      ],
      fr: [
        'Chère Madame, Cher Monsieur,',
        'Au nom de l\'American Ditek Institute (ADI University), et sur recommandation de la commission de recrutement, j\'ai le grand plaisir de vous confirmer votre nomination en qualité de ' + TF + '. Votre parcours a retenu l\'attention de la commission et nous sommes convaincus que vous apporterez une contribution précieuse à notre communauté académique.',
        nat[1],
        'Les modalités de votre engagement, notamment sa durée, votre charge de travail et votre rémunération, figurent dans le contrat établi par les Ressources humaines, à lire avec la présente lettre. La nomination est subordonnée à la vérification de vos titres académiques et professionnels et au respect des règlements en vigueur de l\'Université.',
        'Avec la présente lettre, l\'ADI ouvre votre messagerie institutionnelle, dont les détails figurent à la page suivante. Veuillez l\'activer dans un délai de sept jours, l\'utiliser pour toute correspondance officielle et garder strictement confidentiel le mot de passe à usage unique.',
        'Nous vous prions de bien vouloir confirmer votre acceptation par écrit aux Ressources humaines dans les sept jours suivant la réception de la présente. Nous vous souhaitons chaleureusement la bienvenue à l\'ADI et nous réjouissons d\'une collaboration fructueuse.',
        'Veuillez agréer, Madame, Monsieur, l\'expression de nos salutations distinguées.'
      ]
    };
  }
  async function appointmentPDF(m) {
    if (typeof PDFOK === 'function' && !PDFOK()) return noPdf();
    const title = m.kind === 'lecturer' ? 'LETTER OF APPOINTMENT' : (m.kind === 'student' ? 'OFFER OF PROVISIONAL ADMISSION' : 'LETTER OF APPOINTMENT');
    const d = pdfBase(title);
    d.setFont('times', 'italic'); d.setFontSize(11); d.setTextColor(70, 80, 105);
    d.text(m.kind === 'student' ? 'Offre d\'admission provisoire — messagerie' : 'Lettre de nomination', 105, 54, { align: 'center' });
    d.setTextColor(0);
    let y = 64;
    const page = h => { if (y + h > 262) { d.addPage(); y = 26; } };
    const para = (txt, size, lh, italic, rgb, gap) => { d.setFont('times', italic ? 'italic' : 'normal'); d.setFontSize(size); d.setTextColor(rgb[0], rgb[1], rgb[2]); d.splitTextToSize(txt, 176).forEach(line => { page(lh); d.text(line, 18, y); y += lh; }); y += gap; };
    if (m.kind === 'student') {
      para('Further to your admission to American Ditek Institute, the Registry has opened your institutional mailbox. The address and one-time password are set out on the following page and form part of this letter.', 11, 5, false, [0, 0, 0], 2);
      para('Suite à votre admission à l\'American Ditek Institute, la scolarité a ouvert votre messagerie institutionnelle. L\'adresse et le mot de passe à usage unique figurent à la page suivante et font partie de la présente lettre.', 11, 4.8, true, [70, 80, 105], 8);
    } else {
      const L = appointmentText(m);
      d.setFont('times', 'normal'); d.setFontSize(10.5); d.setTextColor(0);
      d.text('Yaoundé, ' + L.dateEn, 192, y, { align: 'right' }); y += 5;
      if (m.ref) { d.setFontSize(9.5); d.setTextColor(90, 98, 120); d.text('Ref. / Réf. : ' + m.ref, 192, y, { align: 'right' }); y += 5; }
      y += 3; d.setTextColor(0); d.setFont('times', 'bold'); d.setFontSize(10.5); d.text(String(m.name || ''), 18, y); y += 5.5;
      para('Re: Offer of appointment as ' + L.titleEn, 10.5, 5, false, [11, 37, 89], 1.5);
      L.en.forEach((p, i) => para(p, 10, 4.5, false, [0, 0, 0], i === L.en.length - 1 ? 3 : 1.8));
      y += 1; para('Objet : Nomination en qualité de ' + L.titleFr, 9.8, 4.4, true, [70, 80, 105], 1.2);
      L.fr.forEach((p, i) => para(p, 9.6, 4.2, true, [70, 80, 105], 1.4));
    }
    d.setTextColor(0); y += 8;
    if (y > 218) { d.addPage(); y = 30; }
    if (typeof pdfDirectorSign === 'function') y = pdfDirectorSign(d, y, 150, 'Directeur administratif');
    paintCredential(d, m);
    if (typeof pdfSealLast === 'function') { try { pdfSealLast(d); } catch (e) {} }
    const safe = String(m.email || 'mailbox').replace(/[^\w.@-]+/g, '_');
    return offerDownload('ADI-mailbox-' + safe + '.pdf', d.output('arraybuffer'), 'application/pdf');
  }
  ACT.maildl = el => {
    const id = el.dataset.id;
    el.disabled = true;
    credentialFor(id).then(m => {
      if (!m) return toast(LBL('No mailbox on this record.', 'Aucune messagerie sur ce dossier.'), 1);
      return appointmentPDF(m);
    }).catch(e => toast(apiErr(e), 1)).finally(() => { el.disabled = false; });
  };


  /* ---- Move an existing personal-email account to its ADI address, proved with a one-time code ---- */
  let MIG = { uid: '', checking: false, snoozed: {} };
  function migClose() { const h = document.getElementById('mb-mig'); if (h) h.remove(); }
  function migShow(st) {
    migClose();
    const u = me(); if (!u) return;
    const host = document.createElement('div'); host.id = 'mb-mig'; document.body.appendChild(host);
    const draw = (step, info) => {
      const body = step === 'ask'
        ? `<p class="muted">${esc(LBL('Your account is signed in with a personal email. ADI is moving every account to its own ' + '@adiuniversity.com address. Nothing is lost: your records, results and payments stay on this account.', 'Votre compte utilise une adresse personnelle. L\'ADI donne à chaque compte sa propre adresse @adiuniversity.com. Rien n\'est perdu : vos dossiers, résultats et paiements restent sur ce compte.'))}</p>
           <p class="muted">${esc(LBL('We will send a one-time code to ' + u.email + '.', 'Nous enverrons un code à usage unique à ' + u.email + '.'))}</p>
           <div class="mb-row"><button type="button" class="btn gold lg" id="mb-mig-go">${esc(LBL('Send me the code', 'Envoyer le code'))}</button><button type="button" class="btn ghost" id="mb-mig-later">${esc(LBL('Later', 'Plus tard'))}</button></div>`
        : `<p class="muted">${esc(info.mailed ? LBL('A code was also sent to ' + u.email + '. It is filled in below: tap Confirm and switch.', 'Un code a aussi été envoyé à ' + u.email + '. Il est saisi ci-dessous : touchez Confirmer et basculer.') : LBL('Email delivery is not switched on yet, so your code is shown here once:', 'L\'envoi par e-mail n\'est pas encore activé : votre code s\'affiche ici une seule fois :'))}</p>
           ${info.otp ? `<p class="mb-otp" style="font:700 1.4rem/1.2 ui-monospace,monospace;letter-spacing:.06em;user-select:all">${esc(info.otp)}</p>` : ''}
           <p class="muted">${esc(LBL('Your new address: ', 'Votre nouvelle adresse : '))}<b>${esc(info.adiEmail)}</b></p>
           <label class="small" for="mb-mig-otp">${esc(LBL('One-time code', 'Code à usage unique'))}</label>
           <input id="mb-mig-otp" class="inp" autocomplete="one-time-code" autocapitalize="off" spellcheck="false" style="width:100%;margin:4px 0 10px">
           <p class="small" id="mb-mig-err" role="alert" style="color:var(--crimson);min-height:1.2em"></p>
           <div class="mb-row"><button type="button" class="btn gold lg" id="mb-mig-ok">${esc(LBL('Confirm and switch', 'Confirmer et basculer'))}</button><button type="button" class="btn" id="mb-mig-resend">${esc(LBL('Send a new code', 'Renvoyer un code'))}</button><button type="button" class="btn ghost" id="mb-mig-later">${esc(LBL('Later', 'Plus tard'))}</button></div>`;
      host.innerHTML = `<div class="modal"><div class="box" role="dialog" aria-modal="true" style="max-width:480px"><p class="mb-kicker">ADI</p><h3 style="margin-top:0">${esc(LBL('Move to your ADI account', 'Passez à votre compte ADI'))}</h3>${body}</div></div>`;
      const later = host.querySelector('#mb-mig-later'); if (later) later.onclick = () => { MIG.snoozed[u.id] = 1; migClose(); };
      const go = host.querySelector('#mb-mig-go');
      if (go) go.onclick = () => { go.disabled = true; api('/api/mail/migrate/start', { body: {} }).then(r => draw('code', r)).catch(e => { go.disabled = false; toast(apiErr(e), 1); }); };
      const ok = host.querySelector('#mb-mig-ok');
      if (ok) {
        const inp = host.querySelector('#mb-mig-otp'); inp.value = info.otp || ''; inp.focus();
        const rs = host.querySelector('#mb-mig-resend');
        if (rs) rs.onclick = () => { rs.disabled = true; rs.textContent = LBL('Sending…', 'Envoi…'); api('/api/mail/migrate/start', { body: {} }).then(r => { draw('code', r); toast(LBL('A new code has been generated.', 'Un nouveau code a été généré.')); }).catch(e => { rs.disabled = false; rs.textContent = LBL('Send a new code', 'Renvoyer un code'); toast(apiErr(e), 1); }); };
        if (!info.otp) { rs && rs.click(); }
        const submit = () => {
          const v = inp.value.trim(); const err = host.querySelector('#mb-mig-err');
          if (!v) { err.textContent = LBL('Enter the code.', 'Saisissez le code.'); inp.focus(); return; }
          ok.disabled = true;
          api('/api/mail/migrate/confirm', { body: { otp: v } }).then(r => { migClose(); toast(LBL('Done. Your ADI address is ', 'Terminé. Votre adresse ADI est ') + r.adiEmail); return (typeof apiSync === 'function' ? apiSync() : null); }).then(() => { if (typeof render === 'function') render(); })
            .catch(e => { ok.disabled = false; err.textContent = (e && e.message === 'bad_otp') ? LBL('That code is not right.', 'Ce code est incorrect.') : apiErr(e); inp.focus(); });
        };
        ok.onclick = submit; inp.onkeydown = e => { if (e.key === 'Enter') submit(); };
      }
    };
    draw(st && st.started ? 'code' : 'ask', { mailed: true, adiEmail: (st && st.adiEmail) || '', otp: '' });
  }
  function migCheck() {
    const u = me();
    if (!u || MIG.checking || MIG.snoozed[u.id] || MIG.uid === u.id) return;
    if (/@adiuniversity\.com$/i.test(u.email || '') || u.role === 'super_admin' || u.purpose === 'minesup') return;
    MIG.checking = true;
    api('/api/mail/migrate').then(st => { MIG.uid = u.id; if (st && st.eligible && me() && me().id === u.id) migShow(st); }).catch(() => {}).finally(() => { MIG.checking = false; });
  }

  if (typeof render === 'function') {
    const prev = render;
    render = function () {
      prev();
      migCheck();
      if (!DESK && me() && location.hash.indexOf('/mail') >= 0) refresh();
    };
  }
})();
