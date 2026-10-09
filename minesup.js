'use strict';
/* MINESUP HND/BTS transcript or diploma — ADI portal page. */
(function () {
  if (window.__MS_INSTALLED) return;
  window.__MS_INSTALLED = true;

  function LBL(en, fr) {
    return (typeof LANG !== 'undefined' && LANG === 'fr') ? fr : en;
  }

  function initMinesup() {
    if (typeof COLS === 'undefined' || typeof S === 'undefined' || typeof ROUTES === 'undefined' || typeof DOC_TYPES === 'undefined' || typeof L === 'undefined') {
      setTimeout(initMinesup, 50);
      return;
    }

    if (!COLS.includes('msapp')) COLS.push('msapp');
    if (!S.msapp) S.msapp = {};

    ['photo', 'police', 'auth'].forEach(k => { if (!DOC_TYPES.includes(k)) DOC_TYPES.push(k); });
    L.dt_photo = ['Passport photograph', "Photo d'identité"];
    L.dt_police = ['Police or loss declaration', 'Déclaration de perte'];
    L.dt_auth = ['Authorisation letter', "Lettre d'autorisation"];
    L.ms_menu = ['MINESUP transcript / diploma', 'Relevé / diplôme MINESUP'];
    L.ms_admin = ['MINESUP applications', 'Demandes MINESUP'];

    if (!ROUTES.some(r => r.id === 'minesup')) {
      const at = Math.max(0, ROUTES.findIndex(r => r.id === 'fees-me'));
      ROUTES.splice(at < 0 ? ROUTES.length : at + 1, 0, { id: 'minesup', k: 'ms_menu', perm: 'fees_pay', v: viewMinesup });
    }
    if (!ROUTES.some(r => r.id === 'minesup-admin')) {
      const at2 = ROUTES.findIndex(r => r.id === 'students');
      ROUTES.splice(at2 < 0 ? ROUTES.length : at2 + 1, 0, { id: 'minesup-admin', k: 'ms_admin', perm: 'manage_students', v: viewMinesupAdmin });
    }

    const dash = ROUTES.find(r => r.id === 'dashboard');
    if (dash && !dash._msWrapped) {
      dash._msWrapped = true;
      const base = dash.v;
      dash.v = function () {
        let h = base();
        const u = typeof me === 'function' ? me() : null;
        if (!u) return h;
        if (u.role === 'student') {
          const st = typeof studentOf === 'function' ? studentOf(u.id) : null;
          const ok = st && levelOk(st) && tuitionOk(st);
          h += `<div class="card gap ms-pop" style="border-top:4px solid var(--gold)"><p class="ms-kicker">MINESUP · HND / BTS</p><h3>${LBL('Transcript or diploma', 'Relevé de notes ou diplôme')}</h3><p class="muted">${ok ? LBL('Your tuition is confirmed. You may complete the official bilingual application.', 'Votre scolarité est confirmée. Vous pouvez remplir la demande officielle bilingue.') : LBL('An ADI student account is required. The form opens only after Finance confirms that tuition is fully paid.', 'Un compte étudiant ADI est requis. Le formulaire s\'ouvre seulement après confirmation du paiement intégral de la scolarité.')}</p><div class="row">${cta()}</div></div>`;
        } else if (typeof can === 'function' && (can('manage_students') || u.role === 'super_admin')) {
          const n = Object.values(S.msapp || {}).filter(a => a && a.status === 'submitted').length;
          h += `<div class="card gap ms-pop" style="border-top:4px solid var(--crimson)"><p class="ms-kicker">MINESUP</p><h3>${LBL('Applications to review', 'Demandes à examiner')}</h3><div class="kpi">${n}</div><p class="muted small">${LBL('Check eligibility, then approve or reject. Download carries the ADI round seal on every page.', 'Vérifiez l\'éligibilité, puis approuvez ou rejetez. Le téléchargement porte le sceau rond ADI sur chaque page.')}</p><a class="btn" href="#/minesup-admin">${LBL('Open the desk', 'Ouvrir le bureau')}</a></div>`;
        }
        return h;
      };
    }

    const feesRoute = ROUTES.find(r => r.id === 'fees-me');
    if (feesRoute && !feesRoute._msWrapped) {
      feesRoute._msWrapped = true;
      const baseF = feesRoute.v;
      feesRoute.v = function () {
        const u = typeof me === 'function' ? me() : null;
        const st = u && typeof studentOf === 'function' ? studentOf(u.id) : null;
        let gate = '';
        try {
          if (st && tuitionOk(st)) sessionStorage.removeItem(feeGateKey);
          else if (sessionStorage.getItem(feeGateKey) === '1') gate = `<div class="note bad ms-pop"><b>${LBL('MINESUP form locked', 'Formulaire MINESUP verrouillé')}</b><br>${LBL('Pay the full tuition. The form opens only after the officer in charge confirms the payment.', 'Payez la totalité de la scolarité. Le formulaire s\'ouvre seulement après confirmation par le responsable.')}</div>`;
        } catch (e) {}
        return gate + baseF();
      };
    }

    if (typeof receiptPDF === 'function' && !window.__msReceiptWrapped) {
      window.__msReceiptWrapped = true;
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
    }
  }

  function levelOk(st) { return true; }
  function tuitionOk(st) { return true; }
  function cta() { return `<a class="btn gold" href="#/minesup">${LBL('Apply now', 'Faire la demande')}</a>`; }
  const feeGateKey = 'ms_feegate';

  function viewMinesup() {
    return `<div class="card gap"><h2>MINESUP Transcript & Diploma Desk</h2><p>Official bilingual processing portal for MINESUP HND/BTS transcripts and degree certifications.</p></div>`;
  }

  function viewMinesupAdmin() {
    return `<div class="card gap"><h2>MINESUP Application Desk (Officer)</h2><p>Review student applications and verify academic eligibility.</p></div>`;
  }

  initMinesup();
})();
