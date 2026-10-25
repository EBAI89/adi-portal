'use strict';
/* ADI Teaching Desk — assign courses to lecturers (lead + co-lecturers), see which courses still lack an outline and draft
 * outlines (starter or AI) for one course, a selection or every course. The AI studio for notes, handouts, slides and PDF
 * stays in each course's virtual classroom; the desk links straight to it. All rules are enforced by the server. */
(function () {
  if (window.__TD_INSTALLED) return;
  window.__TD_INSTALLED = true;
  if (typeof COLS === 'undefined' || typeof S === 'undefined' || typeof ROUTES === 'undefined' || typeof ACT === 'undefined') return;

  const fr = () => typeof LANG !== 'undefined' && LANG === 'fr';
  const LBL = (en, f) => fr() ? f : en;
  L.td_menu = ['Teaching desk', 'Bureau pédagogique'];

  /* ---- who teaches what: the "cassign" collection reaches the browser by the normal sync, and by /api/studio/co as a safety net ---- */
  if (!COLS.includes('cassign')) COLS.push('cassign');
  if (!S.cassign) S.cassign = {};
  const staffUser = u => !!u && u.status === 'active' && !['student', 'applicant'].includes(u.role);
  let coFor = '', coAt = 0;
  async function loadCo(force) {
    const u = me(); if (!staffUser(u)) return;
    if (!force && coFor === u.id && Date.now() - coAt < 60000) return;
    try { const j = await api('/api/studio/co'); coFor = u.id; coAt = Date.now(); const before = JSON.stringify(S.cassign || {}); S.cassign = Object.assign({}, S.cassign || {}, j.cassign || {}); Object.keys(S.cassign).forEach(k => { if (!(j.cassign || {})[k]) delete S.cassign[k]; }); if (before !== JSON.stringify(S.cassign) && typeof render === 'function') render(); } catch (e) { /* offline: keep what we have */ }
  }
  setInterval(() => { try { if (!document.hidden) loadCo(false); } catch (e) {} }, 5000);
  setTimeout(() => loadCo(true), 1500);

  /* ---- state ---- */
  const PAGE = 25;
  const ST = window.__TD = { page: 1, q: '', level: '', spec: '', sem: '', year: '', who: '', plan: '', lang: '', sel: new Set(), busy: false, prog: null, bLead: '', bCo: '', bRem: '' };
  const outLang = () => ST.lang || (fr() ? 'fr' : 'en');
  const coOf = id => (((S.cassign || {})[id] || {}).co || []).filter(x => S.users && S.users[x]);
  const planOf = id => (S.clsx || {})[id] || null;
  const planState = id => { const p = planOf(id); return p && (p.outline || (p.weeks || []).length) ? (p.status || 'draft') : 'none'; };
  const lecs = () => Object.values(S.users || {}).filter(u => u.role === 'lecturer' && u.status === 'active').sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const name = id => (S.users && S.users[id] && S.users[id].name) || '—';
  const codeOf = id => ((S.courses || {})[id] || {}).code || id;

  const STATUS = {
    none: ['No outline', 'Pas de plan', 'warn'], draft: ['Draft', 'Brouillon', 'mute'], submitted: ['Awaiting approval', 'En attente de validation', 'info'],
    approved: ['Approved', 'Validé', 'ok'], returned: ['Returned for changes', 'Renvoyé pour correction', 'warn']
  };
  const stBadge = k => { const s = STATUS[k] || STATUS.none; return badge(fr() ? s[1] : s[0], s[2]); };

  /* ---- academic structure: Programme > Faculty/Field > Department/Specialty > Year (Level) > Semester > Academic year ---- */
  const LV_ORDER = ['HND', 'BTS', 'BSC', 'MSC'];
  const specOf = c => { try { return (typeof SPEC !== 'undefined' && SPEC[c.specId]) || null; } catch (e) { return null; } };
  const grpOf = c => { try { const sp = specOf(c); return (sp && typeof GRP !== 'undefined' && GRP[sp.gid]) || null; } catch (e) { return null; } };
  const lvNo = c => { const y = Math.min(Math.max(Number(c.year) || 1, 1), 4); return (c.level === 'MSC' ? y + 4 : y) * 100; };
  const ayTxt = () => { try { return typeof AY === 'function' ? AY() : ''; } catch (e) { return ''; } };
  const progName = k => ({ HND: ['HND', 'HND'], BTS: ['BTS', 'BTS'], BSC: ['Bachelor', 'Licence / Bachelor'], MSC: ['Master', 'Master'] }[k] || [k || '—', k || '—']);
  const gKey = c => [c.level || '', c.specId || '', Number(c.year) || 1, Number(c.sem) === 2 ? 2 : 1].join('|');
  const specName = c => { const sp = specOf(c); return sp ? String(sp.name) : ''; };
  const grpName = c => { const g = grpOf(c); return g ? (fr() ? g.fr : g.en) : ''; };
  function filtered() {
    const q = ST.q.trim().toLowerCase();
    return Object.values(S.courses || {}).filter(c => {
      if (ST.level && c.level !== ST.level) return false;
      if (ST.spec && (ST.spec === '__common' ? !!specOf(c) : c.specId !== ST.spec)) return false;
      if (ST.sem && String(c.sem) !== ST.sem) return false;
      if (ST.year && String(c.year || 1) !== ST.year) return false;
      if (q && !(String(c.code).toLowerCase().includes(q) || String(c.title).toLowerCase().includes(q))) return false;
      if (ST.who === '_none' && (c.lecturerId || coOf(c.id).length)) return false;
      if (ST.who === '_nolead' && c.lecturerId) return false;
      if (ST.who && ST.who[0] !== '_' && c.lecturerId !== ST.who && !coOf(c.id).includes(ST.who)) return false;
      if (ST.plan && planState(c.id) !== ST.plan) return false;
      return true;
    }).sort((a, b) => (LV_ORDER.indexOf(a.level) - LV_ORDER.indexOf(b.level)) || grpName(a).localeCompare(grpName(b)) || specName(a).localeCompare(specName(b)) || ((Number(a.year) || 1) - (Number(b.year) || 1)) || ((Number(a.sem) || 1) - (Number(b.sem) || 1)) || String(a.code).localeCompare(String(b.code)) || String(a.title).localeCompare(String(b.title)));
  }

  /* ---- view ---- */
  function opts(list, cur, blank) { return (blank != null ? '<option value="">' + esc(blank) + '</option>' : '') + list.map(u => '<option value="' + esc(u.id) + '"' + (u.id === cur ? ' selected' : '') + '>' + esc(u.name) + '</option>').join(''); }
  function viewDesk() {
    const u = me(); if (!u) return '';
    if (u.mfaReq && !u.mfa) return `<div class="td-hero"><p class="td-kicker">ADI · ${LBL('Teaching and learning', 'Enseignement et apprentissage')}</p><h2>${LBL('Teaching desk', 'Bureau pédagogique')}</h2><div class="note warn" role="alert"><b>${LBL('Two-step verification required.', 'Vérification en deux étapes requise.')}</b> ${LBL('For security, the portal shows no course or student data until two-step verification is switched on for this account. Switch it on, then return to the Teaching desk.', 'Par sécurité, le portail n\'affiche aucune donnée de cours ou d\'étudiants tant que la vérification en deux étapes n\'est pas activée sur ce compte. Activez-la, puis revenez au Bureau pédagogique.')}</div><p><a class="btn gold" href="#/security">${LBL('Open Account security', 'Ouvrir la sécurité du compte')}</a></p></div>`;
    const all = Object.values(S.courses || {}), n = all.length, withLead = all.filter(c => c.lecturerId).length, withPlan = all.filter(c => planState(c.id) !== 'none').length, approved = all.filter(c => planState(c.id) === 'approved').length;
    const pct = x => n ? Math.round(100 * x / n) : 0, kpi = (v, label, p) => `<div class="td-kpi"><b>${v}</b><span>${label}</span>${p == null ? '' : `<div class="td-bar"><i style="width:${p}%"></i></div>`}</div>`;
    const L1 = lecs(), list = filtered(), selIn = list.filter(c => ST.sel.has(c.id)).length, selAll = ST.sel.size;
    const lvOpts = Object.keys(typeof LEVELS !== 'undefined' ? LEVELS : {}).map(k => `<option value="${esc(k)}"${ST.level === k ? ' selected' : ''}>${esc(lvlName(k))}</option>`).join('');
    const spOpts = (() => { try { const by = {}, have = new Set(all.map(c => c.specId)); Object.values(SPEC || {}).forEach(sp => { if ((ST.level && sp.level !== ST.level) || !have.has(sp.id)) return; if (!by[sp.id]) by[sp.id] = sp; }); const arr = Object.values(by).sort((a, b) => (LV_ORDER.indexOf(a.level) - LV_ORDER.indexOf(b.level)) || String(a.name).localeCompare(String(b.name))); const common = all.some(c => !specOf(c) && (!ST.level || c.level === ST.level)) ? `<option value="__common"${ST.spec === '__common' ? ' selected' : ''}>${LBL('Common courses (all specialties)', 'Cours communs (toutes spécialités)')}</option>` : ''; return common + arr.map(sp => `<option value="${esc(sp.id)}"${ST.spec === sp.id ? ' selected' : ''}>${esc((ST.level ? '' : progName(sp.level)[0] + ' · ') + sp.name)}</option>`).join(''); } catch (e) { return ''; } })();
    const sOpt = (arr, cur) => arr.map(a => `<option value="${esc(a[0])}"${cur === a[0] ? ' selected' : ''}>${esc(a[1])}</option>`).join('');
    const filters = `<div class="card gap"><div class="td-filters">
      <div class="fld"><label class="f">${LBL('Search code or title', 'Rechercher code ou intitulé')}</label><input id="td-q" data-td="q" value="${esc(ST.q)}" placeholder="CSC, accounting…"></div>
      <div class="fld"><label class="f">${LBL('Programme', 'Programme')}</label><select data-td="level"><option value="">${LBL('All', 'Tous')}</option>${lvOpts}</select></div>
      <div class="fld"><label class="f">${LBL('Department / specialty', 'Département / spécialité')}</label><select data-td="spec"><option value="">${LBL('All', 'Toutes')}</option>${spOpts}</select></div>
      <div class="fld"><label class="f">${LBL('Year', 'Année')}</label><select data-td="year"><option value="">${LBL('All', 'Toutes')}</option>${sOpt([['1', LBL('Year 1', 'Année 1')], ['2', LBL('Year 2', 'Année 2')], ['3', LBL('Year 3', 'Année 3')], ['4', LBL('Year 4', 'Année 4')]], ST.year)}</select></div>
      <div class="fld"><label class="f">${LBL('Semester', 'Semestre')}</label><select data-td="sem"><option value="">${LBL('All', 'Tous')}</option>${sOpt([['1', LBL('First semester', 'Premier semestre')], ['2', LBL('Second semester', 'Second semestre')]], ST.sem)}</select></div>
      <div class="fld"><label class="f">${LBL('Lecturer', 'Enseignant')}</label><select data-td="who"><option value="">${LBL('Anyone', 'Tous')}</option><option value="_none"${ST.who === '_none' ? ' selected' : ''}>${LBL('— Nobody assigned —', '— Aucun enseignant —')}</option><option value="_nolead"${ST.who === '_nolead' ? ' selected' : ''}>${LBL('— No lead lecturer —', '— Sans responsable —')}</option>${opts(L1, ST.who)}</select></div>
      <div class="fld"><label class="f">${LBL('Outline', 'Plan de cours')}</label><select data-td="plan"><option value="">${LBL('Any', 'Tous')}</option>${Object.keys(STATUS).map(k => `<option value="${k}"${ST.plan === k ? ' selected' : ''}>${esc(fr() ? STATUS[k][1] : STATUS[k][0])}</option>`).join('')}</select></div>
      <div class="fld"><label class="f">${LBL('Outline language', 'Langue des plans')}</label><select data-td="lang">${sOpt([['en', 'English'], ['fr', 'Français']], outLang())}</select></div>
    </div><p class="small muted">${list.length} / ${n} ${LBL('courses match', 'cours correspondent')} · <a href="#" data-a="td_selall">${LBL('select all ' + list.length + ' matching', 'sélectionner les ' + list.length + ' cours')}</a> · <a href="#" data-a="td_selnone">${LBL('clear selection', 'effacer la sélection')}</a></p></div>`;

    const pages = Math.max(1, Math.ceil(list.length / PAGE)); ST.page = Math.min(Math.max(1, ST.page), pages);
    const shown = list.slice((ST.page - 1) * PAGE, ST.page * PAGE);
    const cellsOf = c => {
      const co = coOf(c.id), st = planState(c.id), p = planOf(c.id), free = L1.filter(x => x.id !== c.lecturerId && !co.includes(x.id));
      const chips = co.map(id => `<span class="td-chip">${esc(name(id))}<button type="button" title="${LBL('Remove', 'Retirer')}" data-a="td_corem" data-id="${esc(c.id)}" data-u="${esc(id)}">×</button></span>`).join('');
      const lead = `<select data-td="lead" data-id="${esc(c.id)}" aria-label="${LBL('Lead lecturer', 'Responsable')}">${opts(L1, c.lecturerId || '', LBL('— unassigned —', '— non affecté —'))}${c.lecturerId && !L1.some(x => x.id === c.lecturerId) ? `<option value="${esc(c.lecturerId)}" selected>${esc(name(c.lecturerId))}</option>` : ''}</select>`;
      const add = co.length >= 4 ? `<span class="small muted">${LBL('maximum reached', 'maximum atteint')}</span>` : `<select data-td="coadd" data-id="${esc(c.id)}" aria-label="${LBL('Add co-lecturer', 'Ajouter un co-enseignant')}"><option value="">＋ ${LBL('add co-lecturer', 'ajouter un co-enseignant')}</option>${opts(free, '')}</select>`;
      const open = st === 'none' ? '' : `<a class="btn ghost sm" href="#/outlines/${esc(c.id)}" title="${LBL('Open the course outline', 'Ouvrir le plan de cours')}">${LBL('Open', 'Ouvrir')}</a>`;
      const gen = st === 'submitted' || st === 'approved' ? '' : `<button class="btn ghost sm" data-a="td_out" data-id="${esc(c.id)}" data-m="template" ${ST.busy ? 'disabled' : ''} title="${LBL('Structured starter outline, no AI needed', 'Plan type structuré, sans IA')}">${st === 'none' ? LBL('Starter', 'Plan type') : LBL('Redo starter', 'Refaire')}</button><button class="btn sm" data-a="td_out" data-id="${esc(c.id)}" data-m="ai" ${ST.busy ? 'disabled' : ''} title="${LBL('Draft the outline with AI', 'Rédiger le plan avec l\'IA')}">✨ ${st === 'none' ? 'AI' : LBL('Redo AI', 'Refaire IA')}</button>`;
      return [`<input type="checkbox" data-td="sel" data-id="${esc(c.id)}"${ST.sel.has(c.id) ? ' checked' : ''} aria-label="${LBL('Select', 'Sélectionner')} ${esc(c.code)}">`,
        '<b>' + esc(c.code) + '</b>' + '<br>' + esc(c.title) + `<span class="td-sub">${esc(c.credits || '')} ${LBL('credits', 'crédits')}${c.cat ? '' : ''}</span>`,
        lead, chips + add,
        stBadge(st) + (p && p.weeks && p.weeks.length ? `<span class="td-sub">${p.weeks.length} ${LBL('weeks', 'semaines')}${p.gen === 'ai' ? ' · AI' : ''}</span>` : '') + `<div class="td-act">${gen}${open}</div>`,
        `<a class="btn gold sm" href="#/classroom/${esc(c.id)}/plan" title="${LBL('Notes, handouts, slides, quizzes and PDF for any topic of this course', 'Notes, supports, diapositives, quiz et PDF sur tout sujet de ce cours')}">✨ ${LBL('Studio', 'Studio')}</a>`];
    };
    const pager = list.length > PAGE ? `<div class="pgbar"><button type="button" class="btn sm" data-a="td_prev" ${ST.page <= 1 ? 'disabled' : ''}>&larr; ${LBL('Back', 'Retour')}</button><span class="small muted">${LBL('Page', 'Page')} ${ST.page} / ${pages} · ${(ST.page - 1) * PAGE + 1}–${Math.min(list.length, ST.page * PAGE)} ${LBL('of', 'sur')} ${list.length}</span><button type="button" class="btn sm" data-a="td_next" ${ST.page >= pages ? 'disabled' : ''}>${LBL('Next', 'Suivant')} &rarr;</button></div>` : '';
    const cnt = {}; list.forEach(c => { const k = gKey(c); cnt[k] = (cnt[k] || 0) + 1; });
    const blocks = []; shown.forEach(c => { const k = gKey(c), b = blocks[blocks.length - 1]; if (b && b.k === k) b.cs.push(c); else blocks.push({ k, cs: [c] }); });
    const hdrs = ['', LBL('Course', 'Cours'), LBL('Lead lecturer', 'Responsable'), LBL('Co-lecturers', 'Co-enseignants'), LBL('Outline', 'Plan de cours'), LBL('AI studio', 'Studio IA')];
    const headOf = (c, k, onPage) => {
      const pr = progName(c.level)[fr() ? 1 : 0], ho = ['MSC', 'BSC'].includes(c.level), common = !specOf(c), gn = grpName(c) || (common ? (ho ? LBL('All faculties', 'Toutes les facultés') : LBL('All fields of study', 'Toutes les filières')) : LBL('Not assigned', 'Non renseigné')), sn = specName(c) || (common ? (ho ? LBL('Common courses', 'Cours communs') : LBL('Common core: all specialties', 'Tronc commun : toutes les spécialités')) : LBL('Not assigned', 'Non renseigné')), up = x => esc(String(x).toLocaleUpperCase(fr() ? 'fr' : 'en'));
      const line = (l, v) => v ? `<div class="td-l"><span>${l}</span><b>${v}</b></div>` : '';
      const sm = Number(c.sem) === 2 ? LBL('Second Semester', 'Second semestre') : LBL('First Semester', 'Premier semestre'), ay = ayTxt();
      const allIn = list.filter(x => gKey(x) === k).every(x => ST.sel.has(x.id));
      return `<div class="td-gh"><div class="td-gl">${line(LBL('Programme', 'Programme'), up(pr))}${line(ho ? LBL('Faculty', 'Faculté') : LBL('Field', 'Filière'), gn ? up(gn) : '')}${line(ho ? LBL('Department', 'Département') : LBL('Specialty', 'Spécialité'), sn ? up(sn) : '')}${line(LBL('Level', 'Niveau'), up(lvNo(c) + ' · ' + LBL('Year', 'Année') + ' ' + (Number(c.year) || 1)))}${line(LBL('Semester', 'Semestre'), up(sm))}${ay ? line(LBL('Academic year', 'Année académique'), esc(ay)) : ''}</div>
        <div class="td-gy"><span class="small muted">${cnt[k]} ${LBL('courses', 'cours')} · <a href="#" data-a="td_selgrp" data-k="${esc(k)}">${allIn ? LBL('deselect this group', 'désélectionner ce groupe') : LBL('select this group', 'sélectionner ce groupe')}</a></span></div></div>`;
    };
    const tableHTML = blocks.length ? blocks.map(b => `<section class="td-grp">${headOf(b.cs[0], b.k)}${table(hdrs, b.cs.map(cellsOf), '').replace('<table>', '<table class="nopage">')}</section>`).join('') : `<div class="note">${LBL('No course matches these filters.', 'Aucun cours ne correspond à ces filtres.')}</div>`;

    let prog = '';
    if (ST.prog) { const g = ST.prog; prog = `<div class="td-prog" role="status" aria-live="polite"><b>${g.running ? LBL('Preparing outlines…', 'Préparation des plans…') : LBL('Finished', 'Terminé')}</b> ${g.done} / ${g.total} · ${LBL('drafted', 'créés')} ${g.ok} · ${LBL('skipped', 'ignorés')} ${g.skip} · ${LBL('failed', 'échecs')} ${g.fail}<div class="td-bar"><i style="width:${g.total ? Math.round(100 * g.done / g.total) : 0}%"></i></div>${g.error ? `<p class="small" style="color:var(--crimson)">${esc(g.error)}</p>` : ''}${g.running ? `<p><button class="btn ghost sm" data-a="td_stop">${LBL('Stop', 'Arrêter')}</button></p>` : `<p><button class="btn ghost sm" data-a="td_progclose">${LBL('Close', 'Fermer')}</button></p>`}</div>`; }

    const noPlan = [...ST.sel].filter(id => (S.courses || {})[id] && planState(id) === 'none').length, canRedo = [...ST.sel].filter(id => (S.courses || {})[id] && ['draft', 'returned', 'none'].includes(planState(id))).length;
    const bulk = selAll ? `<div class="td-bulk" role="region" aria-label="${LBL('Actions on the selected courses', 'Actions sur les cours sélectionnés')}"><b>${selAll} ${LBL('course(s) selected', 'cours sélectionné(s)')}</b>${selAll !== selIn ? `<span class="small muted"> (${selIn} ${LBL('shown', 'affichés')})</span>` : ''}
      <div class="row"><select data-td="bLead">${opts(L1, ST.bLead, LBL('Lead lecturer…', 'Responsable…'))}</select><button class="btn sm" data-a="td_blead" ${ST.busy ? 'disabled' : ''}>${LBL('Set as lead', 'Définir comme responsable')}</button><button class="btn ghost sm" data-a="td_bleadclear" ${ST.busy ? 'disabled' : ''}>${LBL('Clear lead', 'Retirer le responsable')}</button></div>
      <div class="row"><select data-td="bCo">${opts(L1, ST.bCo, LBL('Co-lecturer…', 'Co-enseignant…'))}</select><button class="btn sm" data-a="td_bcoadd" ${ST.busy ? 'disabled' : ''}>${LBL('Add as co-lecturer', 'Ajouter comme co-enseignant')}</button><button class="btn ghost sm" data-a="td_bcorem" ${ST.busy ? 'disabled' : ''}>${LBL('Remove this lecturer', 'Retirer cet enseignant')}</button></div>
      <div class="row"><button class="btn ghost sm" data-a="td_bstarter" ${ST.busy || !noPlan ? 'disabled' : ''}>${LBL('Starter outlines', 'Plans types')} (${noPlan})</button><button class="btn gold sm" data-a="td_bai" ${ST.busy || !canRedo ? 'disabled' : ''}>✨ ${LBL('AI outlines', 'Plans par IA')} (${canRedo})</button></div></div>` : '';

    const everyMissing = all.filter(c => planState(c.id) === 'none').length;
    const hero = `<div class="td-hero"><p class="td-kicker">ADI · ${LBL('Teaching and learning', 'Enseignement et apprentissage')}</p><h2>${LBL('Teaching desk', 'Bureau pédagogique')}</h2>
      <p class="muted">${LBL('Assign every course to its lecturers, make sure each course has an outline, and open the AI studio to prepare notes, handouts, slides and PDF for any topic of any course. Outlines are always drafts: the lecturer reviews them and the classroom manager approves them before students see them.', 'Affectez chaque cours à ses enseignants, assurez-vous que chaque cours a un plan, et ouvrez le studio IA pour préparer notes, supports, diapositives et PDF sur tout sujet de tout cours. Les plans sont toujours des brouillons : l\'enseignant les relit et le responsable de la classe virtuelle les valide avant que les étudiants ne les voient.')}</p>
      <div class="td-kpis">${kpi(n, LBL('courses', 'cours'))}${kpi(pct(withLead) + '%', LBL('have a lead lecturer', 'ont un responsable'), pct(withLead))}${kpi(pct(withPlan) + '%', LBL('have an outline', 'ont un plan'), pct(withPlan))}${kpi(pct(approved) + '%', LBL('outlines approved', 'plans validés'), pct(approved))}</div>
      <div class="row" style="margin-top:12px"><button class="btn" data-a="td_allstarter" ${ST.busy || !everyMissing ? 'disabled' : ''}>${LBL('Draft a starter outline for every course without one', 'Créer un plan type pour chaque cours sans plan')} (${everyMissing})</button></div>
      <p class="td-note-ai">${LBL('Starter outlines work without AI. AI outlines need an AI key on the server and are prepared one course at a time.', 'Les plans types fonctionnent sans IA. Les plans par IA exigent une clé IA sur le serveur et sont préparés un cours à la fois.')}</p></div>`;
    return `${hero}${prog}${filters}${tableHTML}${pager}${bulk}`;
  }
  const at = Math.max(0, ROUTES.findIndex(r => r.id === 'outlines'));
  ROUTES.splice(at < 0 ? ROUTES.length : at, 0, { id: 'teaching', k: 'td_menu', perm: 'course_assign', v: viewDesk });

  /* ---- actions ---- */
  const done = async msg => { try { if (typeof apiSync === 'function') await apiSync(); await loadCo(true); } catch (e) {} if (msg) toast(msg); render(); };
  const fail = e => { toast(apiErr(e), 1); render(); };
  async function assign(courseIds, patch, okMsg) {
    if (ST.busy) return; ST.busy = true; render();
    try { const r = await api('/api/studio/assign', { body: Object.assign({ courseIds }, patch) }); ST.busy = false; await done((okMsg || LBL('Saved', 'Enregistré')) + ' — ' + r.changed.length + ' ' + LBL('course(s) updated', 'cours mis à jour')); }
    catch (e) { ST.busy = false; fail(e); }
  }
  const selected = () => [...ST.sel].filter(id => (S.courses || {})[id]);
  ACT.td_selgrp = (el) => { const k = el.dataset.k, ids = filtered().filter(c => gKey(c) === k).map(c => c.id), all = ids.every(id => ST.sel.has(id)); ids.forEach(id => all ? ST.sel.delete(id) : ST.sel.add(id)); render(); };
  ACT.td_selall = () => { filtered().forEach(c => ST.sel.add(c.id)); render(); };
  ACT.td_selnone = () => { ST.sel.clear(); render(); };
  ACT.td_prev = () => { ST.page--; render(); window.scrollTo({ top: 0 }); };
  ACT.td_next = () => { ST.page++; render(); window.scrollTo({ top: 0 }); };
  ACT.td_corem = el => assign([el.dataset.id], { removeCo: [el.dataset.u] }, LBL('Co-lecturer removed', 'Co-enseignant retiré'));
  ACT.td_blead = () => { if (!ST.bLead) return toast(LBL('Choose a lecturer first.', 'Choisissez d\'abord un enseignant.'), 1); assign(selected(), { lead: ST.bLead }); };
  ACT.td_bleadclear = () => assign(selected(), { lead: '' }, LBL('Lead lecturer cleared', 'Responsable retiré'));
  ACT.td_bcoadd = () => { if (!ST.bCo) return toast(LBL('Choose a lecturer first.', 'Choisissez d\'abord un enseignant.'), 1); assign(selected(), { addCo: [ST.bCo] }); };
  ACT.td_bcorem = () => { if (!ST.bCo) return toast(LBL('Choose a lecturer first.', 'Choisissez d\'abord un enseignant.'), 1); assign(selected(), { removeCo: [ST.bCo] }, LBL('Lecturer removed from the selected courses', 'Enseignant retiré des cours sélectionnés')); };
  ACT.td_progclose = () => { ST.prog = null; render(); };
  ACT.td_stop = () => { if (ST.prog) ST.prog.stop = true; };

  const msgOf = r => ({ LOCKED: LBL('already submitted or approved', 'déjà soumis ou validé'), EXISTS: LBL('already has an outline', 'a déjà un plan'), FORBIDDEN: LBL('not allowed', 'non autorisé'), NO_COURSE: LBL('unknown course', 'cours inconnu'), EMPTY: LBL('nothing produced', 'rien produit') }[r] || r);
  ACT.td_out = async el => {
    if (ST.busy) return; const id = el.dataset.id, mode = el.dataset.m === 'ai' ? 'ai' : 'template', st = planState(id);
    if (st !== 'none' && !window.confirm(LBL('This replaces the current draft outline of ' + codeOf(id) + '. Continue?', 'Ceci remplace le brouillon actuel du plan de ' + codeOf(id) + '. Continuer ?'))) return;
    ST.busy = true; render(); toast(mode === 'ai' ? LBL('The AI is drafting the outline… this can take up to a minute.', 'L\'IA prépare le plan… cela peut prendre jusqu\'à une minute.') : LBL('Preparing…', 'Préparation…'));
    try { const r = await api('/api/studio/outline', { body: { courseId: id, mode, lang: outLang(), overwrite: st !== 'none' } }); ST.busy = false; const x = (r.results || [])[0] || {}; await done(x.ok ? LBL('Outline drafted for ', 'Plan créé pour ') + codeOf(id) + LBL(' — review it, then submit it for approval.', ' — relisez-le puis soumettez-le pour validation.') : codeOf(id) + ': ' + msgOf(x.skipped)); }
    catch (e) { ST.busy = false; fail(e); }
  };
  async function batch(ids, mode, label) {
    if (ST.busy || !ids.length) return;
    if (mode === 'ai' && !window.confirm(LBL('The AI will draft ' + ids.length + ' outline(s), one after the other. Leave this page open until it finishes. Continue?', 'L\'IA va préparer ' + ids.length + ' plan(s), l\'un après l\'autre. Laissez cette page ouverte jusqu\'à la fin. Continuer ?'))) return;
    ST.busy = true; const g = ST.prog = { running: true, total: ids.length, done: 0, ok: 0, skip: 0, fail: 0, error: '', stop: false }; render();
    try {
      if (mode === 'template') {
        for (let i = 0; i < ids.length; i += 100) {
          const part = ids.slice(i, i + 100), r = await api('/api/studio/outline', { body: { courseIds: part, mode: 'template', lang: outLang(), overwrite: false } });
          (r.results || []).forEach(x => { g.done++; if (x.ok) g.ok++; else g.skip++; }); render();
        }
      } else {
        for (const id of ids) {
          if (g.stop) break;
          let tries = 0;
          for (;;) {
            try { const r = await api('/api/studio/outline', { body: { courseId: id, mode: 'ai', lang: outLang(), overwrite: planState(id) !== 'none' } }); const x = (r.results || [])[0] || {}; g.done++; if (x.ok) g.ok++; else g.skip++; break; }
            catch (e) {
              if (e && e.reason === 'RATE' && tries++ < 3) { await new Promise(r => setTimeout(r, 20000)); continue; }
              if (e && ['AI_OFF', 'AI_NOKEY', 'AI_BLOCKED', 'FORBIDDEN'].includes(e.reason)) { g.error = apiErr(e); g.stop = true; break; }
              g.done++; g.fail++; g.error = apiErr(e); break;
            }
          }
          if (typeof apiSync === 'function') { try { await apiSync(); } catch (e) {} } render();
        }
      }
    } catch (e) { g.error = apiErr(e); }
    g.running = false; ST.busy = false; await done(label); render();
  }
  ACT.td_allstarter = () => batch(Object.values(S.courses || {}).filter(c => planState(c.id) === 'none').map(c => c.id), 'template', LBL('Starter outlines drafted', 'Plans types créés'));
  ACT.td_bstarter = () => batch(selected().filter(id => planState(id) === 'none'), 'template', LBL('Starter outlines drafted', 'Plans types créés'));
  ACT.td_bai = () => batch(selected().filter(id => ['draft', 'returned', 'none'].includes(planState(id))), 'ai', LBL('AI outlines drafted', 'Plans par IA créés'));

  /* ---- form controls ---- */
  let typing = 0;
  document.addEventListener('input', e => {
    const el = e.target; if (!el || !el.dataset || el.dataset.td !== 'q') return;
    ST.q = el.value; ST.page = 1; clearTimeout(typing); typing = setTimeout(() => { render(); const q = document.getElementById('td-q'); if (q) { q.focus(); try { q.setSelectionRange(q.value.length, q.value.length); } catch (x) {} } }, 250);
  });
  document.addEventListener('change', e => {
    const el = e.target; if (!el || !el.dataset || !el.dataset.td) return; const k = el.dataset.td, id = el.dataset.id;
    if (k === 'sel') { if (el.checked) ST.sel.add(id); else ST.sel.delete(id); return render(); }
    if (k === 'lead') return assign([id], { lead: el.value }, el.value ? LBL('Lead lecturer set', 'Responsable défini') : LBL('Lead lecturer cleared', 'Responsable retiré'));
    if (k === 'coadd') { if (!el.value) return; return assign([id], { addCo: [el.value] }, LBL('Co-lecturer added', 'Co-enseignant ajouté')); }
    if (['level', 'spec', 'sem', 'year', 'who', 'plan', 'lang', 'bLead', 'bCo'].includes(k)) { ST[k] = el.value; if (k === 'level') ST.spec = ''; if (['level', 'spec', 'sem', 'year', 'who', 'plan'].includes(k)) ST.page = 1; render(); }
  });
})();
