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
    if (DESK && DESK._for === u.id && !DESK.loading && !DESK.error) return DESK.mine || null;
    return Object.values(S.mailbox || {}).find(m => m && m.userId === u.id && m.status !== 'revoked') || null;
  }

  function refresh(done) {
    const who = (typeof me === 'function' && me() && me().id) || '';
    api('/api/mail/desk').then(d => { DESK = Object.assign({ _for: who }, d); if (done) done(); else if (typeof render === 'function') render(); }).catch(e => {
      DESK = { error: (e && e.message) || 'error', officer: false, mine: null, rows: [], _for: who };
      if (done) done(); else if (typeof render === 'function') render();
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
      <div class="mb-row" style="margin-top:8px">${statusBadge(m.status)}${m.kind ? badge(LBL(m.kind === 'student' ? 'Student' : m.kind === 'lecturer' ? 'Lecturer' : 'Staff', m.kind === 'student' ? 'Étudiant' : m.kind === 'lecturer' ? 'Enseignant' : 'Personnel'), 'info') : ''}</div>
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
    if (!u) return `<div class="note">${LBL('Sign in to open your ADI mailbox.', 'Connectez-vous pour ouvrir votre messagerie ADI.')}</div>`;
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
        h += `<div class="card gap"><h3>${LBL('Activate this mailbox', 'Activer cette messagerie')}</h3><p class="muted">${LBL('Enter the one-time password from your letter, then choose your own password. At least 10 characters, with a letter and a digit.', 'Saisissez le mot de passe à usage unique de votre lettre, puis choisissez le vôtre. Au moins 10 caractères, avec une lettre et un chiffre.')}</p><div class="grid g2">${inp('mb.otp', LBL('One-time password', 'Mot de passe à usage unique'))}${inp('mb.password', LBL('New password', 'Nouveau mot de passe'), { type: 'password' })}${inp('mb.password2', LBL('Confirm password', 'Confirmer le mot de passe'), { type: 'password' })}</div><button class="btn gold" data-a="mailsetup">${LBL('Activate mailbox', 'Activer la messagerie')}</button></div>`;
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
    if (!f.otp || !f.password) return toast(LBL('Enter the one-time password and a new password.', 'Saisissez le mot de passe à usage unique et un nouveau mot de passe.'), 1);
    if (f.password !== f.password2) return toast(LBL('The passwords do not match.', 'Les mots de passe ne correspondent pas.'), 1);
    run(el, () => api('/api/mail/setup', { body: { otp: f.otp, password: f.password } }).then(() => {
      FORMS.mb = { otp: '', password: '', password2: '' };
      const gate = document.getElementById('mb-gate');
      if (gate) gate.remove();
      toast(LBL('Your password is set. The one-time password no longer works.', 'Votre mot de passe est défini. Le mot de passe à usage unique ne fonctionne plus.'));
    }));
  };
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

  let pdfJsLoad = null;
  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (pdfJsLoad) return pdfJsLoad;
    pdfJsLoad = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s.onload = () => resolve(window.pdfjsLib);
      s.onerror = () => reject(new Error('pdfjs'));
      document.head.appendChild(s);
    });
    return pdfJsLoad;
  }
  async function paintPages(bytes) {
    const box = document.getElementById('mb-pages');
    if (!box) return;
    try {
      const lib = await loadPdfJs();
      if (!lib) throw new Error('pdfjs');
      const doc = await lib.getDocument({ data: bytes, disableWorker: true, isEvalSupported: false }).promise;
      box.innerHTML = '';
      const width = Math.max(280, box.clientWidth - 16);
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const base = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: Math.min(2, width / base.width) });
        const canvas = document.createElement('canvas');
        canvas.className = 'mb-page';
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        box.appendChild(canvas);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      }
    } catch (e) {
      const still = document.getElementById('mb-pages');
      if (still) still.innerHTML = `<p class="muted">${esc(LBL('The pages could not be drawn here. Tap Save the PDF and open the file.', 'Les pages ne peuvent pas être affichées ici. Appuyez sur Enregistrer le PDF et ouvrez le fichier.'))}</p>`;
    }
  }

  function offerDownload(name, data, mime, extra) {
    extra = extra || {};
    const m = extra.mailbox;
    const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data || []);
    const blob = new Blob([bytes], { type: mime || 'application/pdf' });
    const url = URL.createObjectURL(blob);
    let host = document.getElementById('mb-dl');
    if (!host) { host = document.createElement('div'); host.id = 'mb-dl'; document.body.appendChild(host); }
    if (host._url) URL.revokeObjectURL(host._url);
    host._url = url;
    const cred = m && m.email ? `<div class="mb-cred"><p class="mb-kicker">ADI · @adiuniversity.com</p><div class="mb-addr">${esc(m.email)}</div>${m.otp ? `<p class="small muted" style="margin:8px 0 0">${esc(LBL('One-time password', 'Mot de passe à usage unique'))}</p><div class="mb-otp">${esc(m.otp)}</div>` : `<p class="muted" style="margin:8px 0 0">${esc(LBL('This mailbox is already activated.', 'Cette messagerie est déjà activée.'))}</p>`}<p class="small muted">${esc(LBL('This address is also printed on the last page of the letter.', 'Cette adresse est aussi imprimée sur la dernière page de la lettre.'))}</p></div>` : '';
    host.innerHTML = `<div class="modal"><div class="box mb-dlbox" role="dialog" aria-modal="true">
      <p class="mb-kicker">PDF</p>
      <h3 style="margin-top:0">${esc(LBL('Your document is ready', 'Votre document est prêt'))}</h3>
      <p class="muted">${esc(name)}</p>
      ${cred}
      <div class="mb-pages" id="mb-pages"><p class="muted">${esc(LBL('Preparing the pages…', 'Préparation des pages…'))}</p></div>
      <div class="mb-row" style="margin-top:12px">
        <a class="btn gold lg" id="mb-dl-a">${esc(LBL('Save the PDF', 'Enregistrer le PDF'))}</a>
        <button type="button" class="btn ghost" id="mb-dl-x">${esc(LBL('Close', 'Fermer'))}</button>
      </div>
      <p class="small muted">${esc(LBL('On a phone, tap Save. The file goes to Downloads.', 'Sur un téléphone, appuyez sur Enregistrer. Le fichier va dans Téléchargements.'))}</p>
    </div></div>`;
    const a = host.querySelector('#mb-dl-a');
    a.href = url;
    a.setAttribute('download', name);
    const close = () => { host.innerHTML = ''; if (host._url) { URL.revokeObjectURL(host._url); host._url = ''; } };
    host.querySelector('#mb-dl-x').addEventListener('click', close);
    host.querySelector('.modal').addEventListener('click', e => { if (e.target.classList.contains('modal')) close(); });
    paintPages(bytes);
    return true;
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
          return offerDownload(name, d.output('arraybuffer'), 'application/pdf', { mailbox: m });
        };
        try { return prevLetter(a); }
        finally { savePDF = prevSave; }
      });
      return job;
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
    d.setFont('times', 'normal'); d.setFontSize(11);
    const en = m.kind === 'student'
      ? 'Further to your admission to American Ditek Institute, the Registry has opened your institutional mailbox. The address and one-time password are set out on the following page and form part of this letter.'
      : 'Further to the recommendation of the recruitment committee, American Ditek Institute appoints you as ' + (m.title || 'a member of staff') + '. Your institutional mailbox is opened with this letter. Activate it within seven days.';
    const fr = m.kind === 'student'
      ? 'Suite à votre admission à l\'American Ditek Institute, la scolarité a ouvert votre messagerie institutionnelle. L\'adresse et le mot de passe à usage unique figurent à la page suivante et font partie de la présente lettre.'
      : 'Sur recommandation de la commission de recrutement, l\'American Ditek Institute vous nomme en qualité de ' + (m.titleFr || m.title || 'membre du personnel') + '. Votre messagerie institutionnelle est ouverte avec la présente lettre. Activez-la dans un délai de sept jours.';
    d.splitTextToSize(en, 176).forEach(line => { d.text(line, 18, y); y += 5; });
    y += 2; d.setFont('times', 'italic'); d.setTextColor(70, 80, 105);
    d.splitTextToSize(fr, 176).forEach(line => { d.text(line, 18, y); y += 4.8; });
    d.setTextColor(0); y += 8;
    if (typeof pdfDirectorSign === 'function') y = pdfDirectorSign(d, y, 150, 'Directeur administratif');
    paintCredential(d, m);
    if (typeof pdfSealLast === 'function') { try { pdfSealLast(d); } catch (e) {} }
    const safe = String(m.email || 'mailbox').replace(/[^\w.@-]+/g, '_');
    return offerDownload('ADI-mailbox-' + safe + '.pdf', d.output('arraybuffer'), 'application/pdf', { mailbox: m });
  }
  ACT.maildl = el => {
    const id = el.dataset.id;
    el.disabled = true;
    credentialFor(id).then(m => {
      if (!m) return toast(LBL('No mailbox on this record.', 'Aucune messagerie sur ce dossier.'), 1);
      return appointmentPDF(m);
    }).catch(e => toast(apiErr(e), 1)).finally(() => { el.disabled = false; });
  };

  let deskBoot = false;
  function paintGate() {
    const u = typeof me === 'function' ? me() : null;
    const m = u ? mineOf() : null;
    let host = document.getElementById('mb-gate');
    if (!u || !m || m.status !== 'pending_setup' || u.role === 'super_admin') { if (host) host.remove(); return; }
    if (!FORMS.mb) FORMS.mb = { otp: '', password: '', password2: '' };
    if (host && host.dataset.user === u.id) return;
    if (!host) { host = document.createElement('div'); host.id = 'mb-gate'; document.body.appendChild(host); }
    host.dataset.user = u.id;
    host.innerHTML = `<div class="mb-gatebox" role="dialog" aria-modal="true">
      <p class="mb-kicker">ADI · @adiuniversity.com</p>
      <h2 style="margin-top:0">${esc(LBL('Choose your password', 'Choisissez votre mot de passe'))}</h2>
      <p class="muted">${esc(LBL('You signed in with the one-time password for ' + m.email + '. Choose your own password before the portal opens. At least 10 characters, with a letter and a digit.', 'Vous vous êtes connecté avec le mot de passe à usage unique de ' + m.email + '. Choisissez votre mot de passe avant l\'ouverture du portail. Au moins 10 caractères, avec une lettre et un chiffre.'))}</p>
      <div class="mb-addr">${esc(m.email)}</div>
      <div class="grid g2" style="margin-top:12px">${inp('mb.otp', LBL('One-time password from the letter', 'Mot de passe à usage unique de la lettre'))}${inp('mb.password', LBL('New password', 'Nouveau mot de passe'), { type: 'password' })}${inp('mb.password2', LBL('Confirm password', 'Confirmer le mot de passe'), { type: 'password' })}</div>
      <button class="btn gold lg" data-a="mailsetup" style="margin-top:12px">${esc(LBL('Set password and open the portal', 'Définir le mot de passe et ouvrir le portail'))}</button>
    </div>`;
  }
  if (typeof render === 'function') {
    const prev = render;
    render = function () {
      prev();
      const u = typeof me === 'function' ? me() : null;
      if (u && (!DESK || DESK._for !== u.id) && !deskBoot) {
        deskBoot = true;
        refresh(() => { deskBoot = false; render(); });
      }
      paintGate();
    };
  }
})();
