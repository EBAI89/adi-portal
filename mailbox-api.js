'use strict';
/* ADI institutional mail — @adiuniversity.com — admission and appointment letters. */
(function () {
  if (window.__MB_INSTALLED) return;
  window.__MB_INSTALLED = true;

  let DESK = null;

  function LBL(en, fr) {
    return (typeof LANG !== 'undefined' && LANG === 'fr') ? fr : en;
  }

  function initMailbox() {
    if (typeof COLS === 'undefined' || typeof S === 'undefined' || typeof ROUTES === 'undefined' || typeof L === 'undefined') {
      setTimeout(initMailbox, 50);
      return;
    }

    if (!COLS.includes('mailbox')) COLS.push('mailbox');
    if (!S.mailbox) S.mailbox = {};

    L.mb_menu = ['ADI email', 'Courriel ADI'];

    if (!ROUTES.some(r => r.id === 'mail')) {
      const at = Math.max(0, ROUTES.findIndex(r => r.id === 'profile'));
      ROUTES.splice(at < 0 ? ROUTES.length : at, 0, { id: 'mail', k: 'mb_menu', v: viewMail });
    }

    const dash = ROUTES.find(r => r.id === 'dashboard');
    if (dash && !dash._mbWrapped) {
      dash._mbWrapped = true;
      const base = dash.v;
      dash.v = function () {
        let h = base();
        const u = typeof me === 'function' ? me() : null;
        if (!u) return h;
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

    if (typeof syncMail === 'function') syncMail();
  }

  let tries = 0;
  function syncMail() {
    if (typeof COLS !== 'undefined' && !COLS.includes('mailbox')) COLS.push('mailbox');
    if (typeof S !== 'undefined' && !S.mailbox) S.mailbox = {};
    if (typeof MODE !== 'undefined' && MODE === 'api' && typeof apiSync === 'function') { apiSync(); return; }
    if (typeof MODE !== 'undefined' && MODE === 'local') return;
    if (++tries < 20) setTimeout(syncMail, 300);
  }

  function mineOf() {
    const u = typeof me === 'function' ? me() : null;
    if (!u) return null;
    return Object.values((typeof S !== 'undefined' && S.mailbox) || {}).find(m => m && m.userId === u.id && m.status !== 'revoked') || (DESK && DESK.mine) || null;
  }

  function refresh(done) {
    const who = (typeof me === 'function' && me() && me().id) || '';
    if (typeof api !== 'function') return;
    api('/api/mail/desk').then(d => { 
      DESK = Object.assign({ _for: who }, d); 
      if (done) done(); 
      else if (typeof render === 'function') render(); 
    }).catch(e => {
      DESK = { error: (e && e.message) || 'error', officer: false, mine: null, rows: [], _for: who };
      if (typeof render === 'function') render();
    });
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
    return typeof badge === 'function' ? badge(LBL(x[0], x[1]), x[2]) : x[0];
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
      <div class="mb-row" style="margin-top:8px">${statusBadge(m.status)}${m.kind ? (typeof badge === 'function' ? badge(LBL(m.kind === 'student' ? 'Student' : m.kind === 'lecturer' ? 'Lecturer' : 'Staff', m.kind === 'student' ? 'Étudiant' : m.kind === 'lecturer' ? 'Enseignant' : 'Personnel'), 'info') : '') : ''}</div>
      ${show ? `<p class="small muted" style="margin:10px 0 0">${LBL('One-time password', 'Mot de passe à usage unique')}</p><div class="mb-otp">${esc(m.otp)}</div><p class="small">${LBL('Hand this only to the person named above. It disappears from the letter once the mailbox is activated.', 'Remettez-le uniquement à la personne nommée ci-dessus. Il disparaît de la lettre une fois la messagerie activée.')}</p>` : (m.status === 'pending_setup' ? `<p class="muted" style="margin-top:8px">${LBL('The one-time password is on the letter. Reveal it here only when you are ready to hand it over.', 'Le mot de passe à usage unique figure sur la lettre. Affichez-le ici seulement au moment de le remettre.')}</p>` : `<p class="muted" style="margin-top:8px">${LBL('Activated. The one-time password is no longer shown.', 'Activée. Le mot de passe à usage unique n\'est plus affiché.')}</p>`)}
      <div class="mb-meta">
        <div><span>${LBL('Personal email', 'Courriel personnel')}</span><b>${esc(m.personalEmail || '—')}</b></div>
        <div><span>${LBL('Matricule / file', 'Matricule / dossier')}</span><b>${esc(m.matric || m.hrRef || '—')}</b></div>
        <div><span>${LBL('Issued', 'Délivrée')}</span><b>${m.issuedAt ? new Date(m.issuedAt).toLocaleDateString() : '—'}</b></div>
      </div>
    </div>`;
  }

  function viewMail() {
    const u = typeof me === 'function' ? me() : null;
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
        if (typeof FORMS !== 'undefined') {
          if (!FORMS.mb) FORMS.mb = { otp: '', password: '', password2: '' };
        }
        h += `<div class="card gap"><h3>${LBL('Activate this mailbox', 'Activer cette messagerie')}</h3><p class="muted">${LBL('Enter the one-time password from your letter, then choose your own password. At least 10 characters, with a letter and a digit.', 'Saisissez le mot de passe à usage unique de votre lettre, puis choisissez le vôtre. Au moins 10 caractères, avec une lettre et un chiffre.')}</p><div class="grid g2">${typeof inp === 'function' ? inp('mb.otp', LBL('One-time password', 'Mot de passe à usage unique')) : ''}${typeof inp === 'function' ? inp('mb.password', LBL('New password', 'Nouveau mot de passe'), { type: 'password' }) : ''}${typeof inp === 'function' ? inp('mb.password2', LBL('Confirm password', 'Confirmer le mot de passe'), { type: 'password' }) : ''}</div><button class="btn gold" data-a="mailsetup">${LBL('Activate mailbox', 'Activer la messagerie')}</button></div>`;
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
        if (typeof FORMS !== 'undefined') {
          if (!FORMS.acl) FORMS.acl = { email: (DESK.acl.people || []).map(p => p.email).filter(Boolean).join('\n'), admin: DESK.acl.admin !== false };
        }
        h += `<div class="card gap"><h3>${LBL('Who may manage mailboxes', 'Qui peut gérer les messageries')}</h3><p class="muted">${LBL('The super administrator always can. Administrators can when this switch is on. Other staff listed below may also manage the directory.', 'Le super administrateur le peut toujours. Les administrateurs le peuvent lorsque ce choix est activé. Les autres personnels listés ci-dessous peuvent aussi gérer l\'annuaire.')}</p><label class="row" style="min-height:44px"><input type="checkbox" data-f="acl.admin" ${FORMS.acl && FORMS.acl.admin ? 'checked' : ''}> ${LBL('All administrators', 'Tous les administrateurs')}</label>${typeof area === 'function' ? area('acl.email', LBL('Staff allowed to manage mailboxes', 'Personnels autorisés à gérer les messageries')) : ''}<button class="btn" data-a="mailacl">${LBL('Save access', 'Enregistrer l\'accès')}</button></div>`;
      }
    }
    return h;
  }

  initMailbox();
})();
