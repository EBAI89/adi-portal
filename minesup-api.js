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
    const st = R.myStudent(u);
    if (!st || u.role !== 'student' || st.matric !== clip(n.matric, 40)) throw ['Only a linked ADI student can apply. / Seul un étudiant ADI rattaché peut postuler.'];
    if (!LEVELS.includes(st.level)) throw ['This form is only for HND and BTS. / Ce formulaire est réservé au HND et au BTS.'];
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
      userId: u.id, matric: st.matric, name: st.name, level: st.level, specId: st.specId || '', gid: st.gid || '',
      institution: 'American Ditek Institute (ADI University)',
      status: 'submitted', at: now(), ref, eligOk: false, remark: ''
    }, body);
    await save('msapp', id, doc);
    await audit(u, 'MINESUP application ' + ref);
    for (const s of usersWith('manage_students')) await notifyUser(s.id, bi('MINESUP application to review', 'Demande MINESUP à examiner'), st.name + ' (' + st.matric + ') — ' + ref);
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
  await notifyUser(o.userId, title, (o.ref || '') + (remark ? ' — ' + remark : ''));
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
  const amounts = [{ k: 'registration', a: 50000, label: 'Registration + savings' }].concat((fb.plan.inst || []).map((a, i) => ({ k: 'inst' + (i + 1), a, label: 'Tuition instalment ' + (i + 1) })));
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

module.exports = { apply, seed, tuitionComplete, LEVELS };
