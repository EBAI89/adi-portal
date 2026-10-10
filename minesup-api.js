'use strict';
/* MINESUP HND/BTS transcript & diploma applications.
   Students may file only after Finance has confirmed full tuition.
   Registry staff review eligibility and approve or reject. */

const LEVELS = ['HND', 'BTS'];
const REASONS = ['first', 'lost', 'damaged', 'studies', 'job', 'other'];
const DELIVERY = ['person', 'rep', 'school'];
const TYPES = ['diploma', 'transcript', 'duplicate', 'copy'];

const clip = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
const emailOk = v => /^\S+@\S+\.\S+$/.test(v);
const yearOk = v => /^\d{4}$/.test(v);
const dateOk = v => /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v + 'T12:00:00Z').getTime());

const serviceOk = (store, userId) => Object.values(store.all('payments')).some(p => p && p.userId === userId && p.kind === 'service' && p.status === 'confirmed');


/* Official MINESUP HND/BTS matricule list (defence session 2026). The second proof of identity: the unique number MINESUP assigned,
   printed on the candidate's HND/BTS registration form. The super administrator can replace the list under Review applications. */
const ROSTER_DEFAULT = [
  ['26SWE0762', 'NANSOU NCHIMIE CHARLY JUNIOR', 'HND', 'SWE', 18.5], ['26SWE0940', 'DOPGIMA SAMUEL BUMSAMIA', 'HND', 'SWE', 17.5],
  ['26SWE0716', 'BATE GIDEON TONG', 'HND', 'SWE', 17.5], ['26SWE0929', 'OSSIMBIE MESSINA DENIS LE PRINCE', 'HND', 'SWE', 19.5],
  ['26ACC0305', 'AJANGANAG FRANCINE UDAKOH', 'HND', 'ACC', 18.5], ['26ACC0347', 'MANISHIMWE DENISE', 'HND', 'ACC', 18.5],
  ['26ACC0306', 'NGO NKOT ERNESTINE BRENDA', 'HND', 'ACC', 17.5],
  ['26CGE0844', 'NSOGA MAHOTH OSCAR GUY LEBEL', 'BTS', 'CGE', 18], ['26CGE0942', 'BENE BOGNOKO PRISCILIA', 'BTS', 'CGE', 17],
  ['26CGE0945', 'TADIUM ARMELLE TATIANA', 'BTS', 'CGE', 18], ['26CGE0944', 'NGAH NOAH PERPETUE GIGELE ROZANA', 'BTS', 'CGE', 18.5],
  ['26CGE0910', 'GUIEBIE PATRICIA', 'BTS', 'CGE', 16.5], ['26CGE0943', 'DONA MENGHE CHEARNLE YASMIN', 'BTS', 'CGE', 17.5]
].map(r => ({ no: r[0], name: r[1], level: r[2], field: r[3], mark: r[4] }));
const normNo = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const noOk = s => /^\d{2}[A-Z]{3}\d{4}$/.test(normNo(s));
const fold = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
function rosterList(store) {
  const s = (store.get('settings', 'main') || {}).msRoster;
  return Array.isArray(s) && s.length ? s.map(r => ({ no: normNo(r.no), name: clip(r.name, 120), level: clip(r.level, 4), field: clip(r.field, 8), mark: r.mark })) : ROSTER_DEFAULT;
}
// The name on MINESUP's list must be the name on the ADI student record (at least two words in common).
function rosterMatch(store, no, name) {
  const n = normNo(no); if (!noOk(n)) return { ok: false, why: 'format' };
  const hits = rosterList(store).filter(r => r.no === n); if (!hits.length) return { ok: false, why: 'not_listed' };
  const mine = fold(name);
  const linked = Object.values(store.all('students')).some(s => s && normNo(s.msNo) === n && fold(s.name).join(' ') === mine.join(' '));
  if (linked) return { ok: true, entry: hits[0], no: n };
  const hit = hits.find(r => { const t = fold(r.name); const common = t.filter(w => mine.includes(w)).length; return common >= Math.min(2, t.length); });
  return hit ? { ok: true, entry: hit, no: n } : { ok: false, why: 'name' };
}
const msVerified = (store, u, st) => !!(u && u.msNo && st && rosterMatch(store, u.msNo, st.name).ok);

function tuitionComplete(logic, store, st) {
  if (!st || !LEVELS.includes(st.level)) return false;
  try {
    logic.load(store);
    const fb = logic.core.feeBook(JSON.parse(JSON.stringify(st)));
    return !!(fb && fb.regOk && Number(fb.balance) <= 0);
  } catch (e) { return false; }
}

function filesOf(store, id, owner) {
  return Object.values(store.all('files')).filter(f => f && f.ctx === 'ms:' + id && (!owner || f.owner === owner));
}
const hasType = (files, k) => files.some(f => f.dtype === k);

function cleanTypes(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  TYPES.forEach(k => { if (src[k] === true || src[k] === 'true' || src[k] === 1) out[k] = true; });
  return out;
}

function validateBody(n, files) {
  const types = cleanTypes(n.types);
  if (!Object.keys(types).length) return 'Choose at least one document / Cochez au moins un document.';
  const certName = clip(n.certName, 160);
  const dob = clip(n.dob, 10), pob = clip(n.pob, 120), sex = clip(n.sex, 12);
  const nationality = clip(n.nationality, 80), nid = clip(n.nid, 40);
  const phone = clip(n.phone, 30), email = clip(n.email, 160).toLowerCase();
  const postal = clip(n.postal, 200);
  const gradYear = clip(n.gradYear, 4), session = clip(n.session, 80), resultDate = clip(n.resultDate, 10);
  const reason = clip(n.reason, 20), reasonOther = clip(n.reasonOther, 160);
  const delivery = clip(n.delivery, 20), destName = clip(n.destName, 160), destAddr = clip(n.destAddr, 240);
  const signName = clip(n.signName, 160), place = clip(n.place, 80), declDate = clip(n.declDate, 10);
  if (certName.length < 3) return 'Full name is required. / Le nom complet est obligatoire.';
  if (!dateOk(dob)) return 'Date of birth is required. / La date de naissance est obligatoire.';
  if (pob.length < 2) return 'Place of birth is required. / Le lieu de naissance est obligatoire.';
  if (!['F', 'M'].includes(sex)) return 'Sex is required. / Le sexe est obligatoire.';
  if (nationality.length < 2) return 'Nationality is required. / La nationalité est obligatoire.';
  if (nid.length < 5) return 'National ID number is required. / Le numéro de la CNI est obligatoire.';
  if (phone.replace(/\D/g, '').length < 8) return 'A telephone number is required. / Un numéro de téléphone est obligatoire.';
  if (!emailOk(email)) return 'A valid email is required. / Une adresse électronique valide est obligatoire.';
  if (postal.length < 3) return 'Postal address is required. / L\'adresse postale est obligatoire.';
  if (!yearOk(gradYear)) return 'Academic year of graduation is required. / L\'année d\'obtention est obligatoire.';
  if (session.length < 3) return 'Examination session is required. / La session d\'examen est obligatoire.';
  if (!dateOk(resultDate)) return 'Date of result publication is required. / La date de publication des résultats est obligatoire.';
  if (!REASONS.includes(reason)) return 'Reason for the request is required. / Le motif de la demande est obligatoire.';
  if (reason === 'other' && reasonOther.length < 3) return 'Please specify the other reason. / Précisez le motif.';
  if (!DELIVERY.includes(delivery)) return 'Delivery method is required. / Le mode de remise est obligatoire.';
  if (delivery === 'school' && (destName.length < 2 || destAddr.length < 3)) return 'Institution name and address are required. / Le nom et l\'adresse de l\'établissement sont obligatoires.';
  if (!dateOk(declDate)) return 'Declaration date is required. / La date de la déclaration est obligatoire.';
  if (place.length < 2) return 'Place of declaration is required. / Le lieu de la déclaration est obligatoire.';
  if (signName.length < 3) return 'Signature (full name) is required. / La signature (nom complet) est obligatoire.';
  if (n.agree !== true) return 'You must accept the declaration. / Vous devez accepter la déclaration.';
  if (n.photos2 !== true) return 'Confirm that two passport photographs are attached. / Confirmez les deux photos d\'identité.';
  if (!hasType(files, 'id')) return 'Scanned national ID is required. / La CNI numérisée est obligatoire.';
  if (!hasType(files, 'birth')) return 'Scanned birth certificate is required. / L\'acte de naissance est obligatoire.';
  if (!hasType(files, 'results')) return 'Proof of graduation or result slip is required. / L\'attestation de réussite ou le relevé est obligatoire.';
  if (!hasType(files, 'receipt')) return 'Receipt of complete fees is required. / Le reçu des frais complets est obligatoire.';
  if (!hasType(files, 'photo')) return 'Passport photograph is required. / La photo d\'identité est obligatoire.';
  if (reason === 'lost' && !hasType(files, 'police')) return 'Police loss declaration is required. / La déclaration de perte est obligatoire.';
  if (delivery === 'rep' && !hasType(files, 'auth')) return 'Authorisation letter is required. / La lettre d\'autorisation est obligatoire.';
  return {
    types, certName, dob, pob, sex, nationality, nid, phone, email, postal,
    gradYear, session, resultDate, reason, reasonOther, delivery, destName, destAddr,
    signName, place, declDate, agree: true, photos2: true
  };
}

async function apply(ctx, u, id, o, n) {
  const { S, R, logic, save, audit, now, usersWith, notifyUser, bi } = ctx;
  if (!u || u.status !== 'active') throw ['auth'];
  if (!/^ms[a-z0-9]{4,40}$/.test(id)) throw ['bad id'];
  if (!o) {
    const own = u.purpose === 'minesup' && u.msMatric;                                      // an independent MINESUP account is cleared against a matricule, not linked to a student account
    const st = own ? S.get('students', u.msMatric) : R.myStudent(u);
    if (!st || !(u.role === 'student' || own) || st.matric !== clip(n.matric, 40)) throw ['Only an ADI student cleared by matricule can apply. / Seul un étudiant ADI dont le matricule est vérifié peut postuler.'];
    if (!msVerified(S, u, st)) throw ['The unique MINESUP HND/BTS matricule (from your registration form) is not verified. / Le matricule unique HND/BTS attribué par le MINESUP (sur votre fiche d\'inscription) n\'est pas vérifié.'];
    if (!serviceOk(S, u.id)) throw ['The service fee (2,000 XAF) is not paid and confirmed. / Les frais de service (2 000 XAF) ne sont pas payés et confirmés.'];
    if (!LEVELS.includes(st.level)) throw ['This form is only for HND and BTS. / Ce formulaire est réservé au HND et au BTS.'];
    if (!logic.platformOk(S, st)) throw ['The platform charge (500 XAF) is not paid and confirmed. / Les frais de plateforme (500 XAF) ne sont pas payés et confirmés.'];
    if (!tuitionComplete(logic, S, st)) throw ['Tuition is not fully paid and confirmed. / La scolarité n\'est pas entièrement payée et confirmée.'];
    if (Object.values(S.all('msapp')).some(a => a && a.userId === u.id && a.status === 'submitted')) throw ['An application is already awaiting review. / Une demande est déjà en examen.'];
    const files = filesOf(S, id, u.id);
    const body = validateBody(n, files);
    if (typeof body === 'string') throw [body];
    const seq = Number(S.meta.msn || 0) + 1;
    await S.setMeta('msn', seq);
    const year = new Date(now()).getFullYear();
    const ref = 'MS/' + year + '/' + String(seq).padStart(4, '0');
    const doc = Object.assign({
      userId: u.id, matric: st.matric, msNo: normNo(u.msNo), name: st.name, level: st.level, specId: st.specId || '', gid: st.gid || '',
      institution: 'American Ditek Institute (ADI University)',
      status: 'submitted', at: now(), ref, eligOk: false, remark: ''
    }, body);
    await save('msapp', id, doc);
    await audit(u, 'MINESUP application ' + ref);
    for (const s of usersWith('manage_students')) await notifyUser(s.id, bi('MINESUP application to review', 'Demande MINESUP à examiner'), st.name + ' (' + st.matric + ') — ' + ref);
    await notifyUser(u.id, bi('MINESUP application received', 'Demande MINESUP reçue'), ref + ' — ' + bi('Your application is with the Registry. You may download your application form as proof that you applied. The transcript itself cannot be downloaded: you will be notified when it is ready, and you collect it in person at the office in charge of issuing transcripts.', 'Votre demande est à la scolarité. Vous pouvez télécharger votre formulaire comme preuve de votre demande. Le relevé lui-même ne se télécharge pas : vous serez averti lorsqu\'il est prêt et vous le retirez en personne au bureau chargé de la délivrance des relevés.'));
    return;
  }
  const staff = u.role === 'super_admin' || R.has(u, 'manage_students') || R.has(u, 'manage_transcripts');
  if (!staff) throw ['forbidden'];
  const status = clip(n.status, 20);
  if (!['approved', 'rejected', 'submitted'].includes(status)) throw ['status'];
  if (status === 'submitted' && o.status !== 'submitted') throw ['status'];
  const remark = clip(n.remark, 800);
  if (status === 'rejected' && remark.length < 3) throw ['A remark is required to reject. / Une observation est obligatoire pour rejeter.'];
  if (status === 'approved') {
    if (n.eligOk !== true) throw ['Confirm eligibility before approval. / Confirmez l\'éligibilité avant d\'approuver.'];
    const st = S.get('students', o.matric);
    if (!st || !tuitionComplete(logic, S, st)) throw ['Tuition is not fully confirmed for this student. / La scolarité de cet étudiant n\'est pas entièrement confirmée.'];
    if (!LEVELS.includes(o.level)) throw ['Not an HND/BTS record. / Dossier hors HND/BTS.'];
    const files = filesOf(S, id, o.userId);
    if (!hasType(files, 'id') || !hasType(files, 'birth') || !hasType(files, 'results') || !hasType(files, 'receipt') || !hasType(files, 'photo')) throw ['Required documents are missing. / Pièces obligatoires manquantes.'];
    if (o.reason === 'lost' && !hasType(files, 'police')) throw ['Police declaration missing. / Déclaration de perte manquante.'];
    if (o.delivery === 'rep' && !hasType(files, 'auth')) throw ['Authorisation letter missing. / Lettre d\'autorisation manquante.'];
  }
  const doc = Object.assign({}, o, {
    status, remark, eligOk: status === 'approved',
    endorsedBy: u.name, endorsedTitle: clip(n.endorsedTitle || 'Administrative Director', 140),
    verifiedBy: u.name, decisionAt: now()
  });
  await save('msapp', id, doc);
  await audit(u, 'MINESUP ' + status + ' ' + o.ref);
  const title = status === 'approved'
    ? bi('MINESUP application approved', 'Demande MINESUP approuvée')
    : status === 'rejected'
      ? bi('MINESUP application rejected', 'Demande MINESUP rejetée')
      : bi('MINESUP application updated', 'Demande MINESUP mise à jour');
  const collect = status === 'approved' ? ' — ' + bi('Your transcript will be issued in person by the office in charge of issuing transcripts. It cannot be downloaded online. You will be told when to come.', 'Votre relevé sera remis en personne par le bureau chargé de la délivrance des relevés. Il ne peut pas être téléchargé en ligne. Vous serez informé de la date de retrait.') : '';
  await notifyUser(o.userId, title, (o.ref || '') + (remark ? ' — ' + remark : '') + collect);
}


/* The HND/BTS final-year cohort (defence session 2026): ADI names, the MINESUP matricule and the tuition paid to date, as recorded by Finance.
   All are second-year students, so they are exempt from registration, T-shirt and bank-account fees. Seeded once; ADI matricules are issued by the portal. */
const COHORT = [
  ['Manishimwe Denise', '26ACC0347', 'HND', 'hnd-biz', 'hnd-biz:accounting', 350000],
  ['Ngo Nkot Ernestine Brenda', '26ACC0306', 'HND', 'hnd-biz', 'hnd-biz:accounting', 350000],
  ['Ajangang Francine Udakoh', '26ACC0305', 'HND', 'hnd-biz', 'hnd-biz:accounting', 350000],
  ['Ossimbie Messina Denis Le Prince', '26SWE0929', 'HND', 'hnd-eng', 'hnd-eng:software-engineering', 400000],
  ['Bate Gideon Tong', '26SWE0716', 'HND', 'hnd-eng', 'hnd-eng:software-engineering', 280000],
  ['Dopgima Samuel Bumsamia', '26SWE0940', 'HND', 'hnd-eng', 'hnd-eng:software-engineering', 290000],
  ['Nansou Nchimie Charly Junior', '26SWE0762', 'HND', 'hnd-eng', 'hnd-eng:software-engineering', 0],
  ['Guiebie Patricia', '26CGE0910', 'BTS', 'bts-biz', 'bts-biz:comptabilite-des-entreprises-et-gestion', 350000],
  ['Ngah Noah Perpetue Gigele Rozana', '26CGE0944', 'BTS', 'bts-biz', 'bts-biz:comptabilite-des-entreprises-et-gestion', 325000],
  ['Don A Menghe Schearyl Yasmine', '26CGE0943', 'BTS', 'bts-biz', 'bts-biz:comptabilite-des-entreprises-et-gestion', 250000],
  ['Bene Bognoko Priscillia', '26CGE0942', 'BTS', 'bts-biz', 'bts-biz:comptabilite-des-entreprises-et-gestion', 250000],
  ['Nsoga Mahoth Oscar Guy Lebel', '26CGE0844', 'BTS', 'bts-biz', 'bts-biz:comptabilite-des-entreprises-et-gestion', 100000],
  ['Tadium Armelle Tatiana', '26CGE0945', 'BTS', 'bts-biz', 'bts-biz:comptabilite-des-entreprises-et-gestion', 100000]
].map(r => ({ name: r[0], no: r[1], level: r[2], gid: r[3], specId: r[4], paid: r[5] }));

async function seedCohort(ctx) {
  const { S, save, now, uid, logic } = ctx;
  if (S.meta && S.meta.cohort26 === 'v1') return;
  const d = new Date(now()), y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1, ay = y + '/' + (y + 1);
  let made = 0, n = 0;
  for (const c of COHORT) {
    logic.load(S);
    const key = fold(c.name).slice().sort().join(' ');
    let st = Object.values(S.all('students')).find(s => s && LEVELS.includes(s.level) && (normNo(s.msNo) === c.no || fold(s.name).slice().sort().join(' ') === key));
    if (!st) { st = { matric: logic.core.newMatric(c.level), name: c.name, level: c.level, gid: c.gid, specId: c.specId, entryYear: y - 1, status: 'registered', email: '', phone: '' }; made++; }
    st = Object.assign({}, st, { msNo: c.no, exemptReg: true });
    await save('students', st.matric, st);
    const ref = 'REC-' + st.matric;
    if (c.paid > 0 && !Object.values(S.all('payments')).some(p => p && p.ref === ref)) {
      n++;
      await save('payments', uid('pay'), { userId: '', matric: st.matric, payerName: st.name, kind: 'tuition_rec', label: 'Tuition paid to date (recorded by the Finance Office)', amount: c.paid, ref, payerPhone: '', status: 'confirmed', at: now(), ay, method: 'recorded', momoTo: '', receiptNo: 'ADI/' + String(y) + '/REC' + String(n).padStart(3, '0'), confirmedBy: 'ADI Finance Office', confirmedAt: now() });
    }
  }
  await S.setMeta('cohort26', 'v1');
  console.log('[minesup] cohort seeded: ' + made + ' new student records');
}

async function seed(ctx) {
  const { S, save, now, uid, logic, hashPw, PROD } = ctx;
  if (PROD) return;
  if (S.meta && S.meta.msDemo) return;
  if (Object.keys(S.all('students')).length) { await S.setMeta('msDemo', 'skipped'); return; }
  const d = new Date(now());
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  const ay = y + '/' + (y + 1);
  const pwStudent = await hashPw('Student@2026');
  const pwRegistry = await hashPw('Registry@2026');
  const regId = uid('u');
  await save('users', regId, { email: 'registry@adiuniversity.com', name: 'ADI Registry', phone: '+237651187835', role: 'super_admin', status: 'active', lang: 'en', createdAt: now(), pw: pwRegistry });
  async function addStudent(spec) {
    const id = uid('u');
    await save('users', id, { email: spec.email, name: spec.name, phone: spec.phone, role: 'student', status: 'active', lang: 'en', createdAt: now(), pw: pwStudent });
    const st = { matric: spec.matric, name: spec.name, level: 'HND', gid: 'hnd-eng', specId: 'hnd-eng:software-engineering', entryYear: spec.entryYear, status: spec.status, email: spec.email, phone: spec.phone, userId: id };
    await save('students', spec.matric, st);
    return { id, st };
  }
  const paid = await addStudent({ email: 'hnd.student@adiuniversity.com', name: 'Ngo Bih Marie Claire', phone: '+237670112233', matric: 'HND26-0142', entryYear: y - 1, status: 'registered' });
  await addStudent({ email: 'fees.due@adiuniversity.com', name: 'Tamba Junior Ndi', phone: '+237680445566', matric: 'HND26-0208', entryYear: y, status: 'admitted' });
  logic.load(S);
  const fb = logic.core.feeBook(JSON.parse(JSON.stringify(paid.st)));
  const amounts = [{ k: 'platform', a: 500, label: 'Platform charge' }, { k: 'registration', a: 50000, label: 'Registration + savings' }].concat((fb.plan.inst || []).map((a, i) => ({ k: 'inst' + (i + 1), a, label: 'Tuition instalment ' + (i + 1) })));
  let n = 1;
  for (const it of amounts) {
    const pid = uid('pay');
    await save('payments', pid, {
      userId: paid.id, matric: paid.st.matric, payerName: paid.st.name, kind: it.k, label: it.label,
      amount: it.a, ref: 'DEMO' + String(100000 + n), payerPhone: paid.st.phone, status: 'confirmed',
      at: now() - (8 - n) * 864e5, ay, method: 'manual', momoTo: '+237674225990',
      receiptNo: 'ADI/RCPT/' + ay.replace('/', '-') + '/' + String(n).padStart(5, '0'),
      confirmedAt: now() - (7 - n) * 864e5, confirmedBy: 'Finance Office'
    });
    n++;
  }
  await S.setMeta('rcpt', Math.max(Number(S.meta.rcpt || 0), amounts.length));
  await S.setMeta('msDemo', true);
  console.log('MINESUP demo ready — hnd.student@adiuniversity.com / fees.due@adiuniversity.com (Student@2026), registry@adiuniversity.com (Registry@2026)');
}

module.exports = { apply, seed, seedCohort, COHORT, fold, tuitionComplete, LEVELS, rosterList, rosterMatch, msVerified, normNo, noOk, ROSTER_DEFAULT };
