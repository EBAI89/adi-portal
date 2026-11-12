'use strict';
/* MINESUP candidate (pre-registration) sheet.
 * - GET  /api/prereg/template?level=HND|BTS  the blank sheet. HND is issued in English (headers, regions, countries, diplomas translated), BTS stays in French.
 * - POST /api/prereg/parse                   reads an uploaded .xlsx (the zip is opened here, no library) and returns the candidates in one clean form.
 *   For HND the French words of the sheet (country, region, diploma) are translated to English; BTS keeps its French wording.
 * The portal page then matches the candidates with the students on record and updates their biodata; nothing is written here. */
const zlib = require('zlib'), fs = require('fs'), path = require('path');
const LEX = require('./adi-prereg-lex.js');

const MAX_ZIP = 8 * 1024 * 1024, MAX_OUT = 40 * 1024 * 1024;
const unesc = s => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');
const clean = s => String(s == null ? '' : s).replace(/[\u0000-\u001f <>]/g, ' ').replace(/\s+/g, ' ').trim();
const up = s => clean(s).toUpperCase();
const strip = s => up(s).normalize('NFD').replace(/[̀-ͯ]/g, '');

function unzip(buf) {
  if (buf.length < 22 || buf.length > MAX_ZIP) throw new Error('The file is not a valid Excel workbook.');
  let e = buf.length - 22; while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('The file is not a valid Excel workbook (.xlsx).');
  const n = buf.readUInt16LE(e + 10); let off = buf.readUInt32LE(e + 16); const out = {}; let total = 0;
  if (n > 400) throw new Error('The workbook has too many parts.');
  for (let i = 0; i < n; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const method = buf.readUInt16LE(off + 10), csize = buf.readUInt32LE(off + 20), nl = buf.readUInt16LE(off + 28), xl = buf.readUInt16LE(off + 30), cl = buf.readUInt16LE(off + 32), lh = buf.readUInt32LE(off + 42);
    const name = buf.slice(off + 46, off + 46 + nl).toString('utf8'); off += 46 + nl + xl + cl;
    if (!/^(xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml))$/.test(name)) continue;
    const ds = lh + 30 + buf.readUInt16LE(lh + 26) + buf.readUInt16LE(lh + 28), raw = buf.slice(ds, ds + csize);
    const data = method === 0 ? raw : method === 8 ? zlib.inflateRawSync(raw, { maxOutputLength: MAX_OUT }) : null; if (!data) throw new Error('Unsupported compression in the workbook.');
    total += data.length; if (total > MAX_OUT) throw new Error('The workbook is too large.'); out[name] = data.toString('utf8');
  }
  return out;
}
const colN = ref => { const m = /^([A-Z]+)/.exec(ref); let n = 0; for (const ch of m ? m[1] : '') n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
function sheetRows(z) {
  const wb = z['xl/workbook.xml'] || '', rels = z['xl/_rels/workbook.xml.rels'] || '', sheets = [];
  wb.replace(/<sheet\b[^>]*>/g, t => { const nm = /\bname="([^"]*)"/.exec(t), id = /\br:id="([^"]*)"/.exec(t); if (nm && id) sheets.push({ name: unesc(nm[1]), id: id[1] }); return t; });
  const pick = sheets.find(s => /^candidats$/i.test(s.name)) || sheets[0]; if (!pick) throw new Error('No worksheet found in the workbook.');
  let target = ''; rels.replace(/<Relationship\b[^>]*>/g, t => { if (new RegExp('\\bId="' + pick.id + '"').test(t)) { const m = /\bTarget="([^"]*)"/.exec(t); if (m) target = m[1]; } return t; });
  const key = 'xl/' + target.replace(/^\/?(xl\/)?/, ''), xml = z[key] || z['xl/worksheets/sheet1.xml']; if (!xml) throw new Error('The worksheet could not be read.');
  const sst = []; (z['xl/sharedStrings.xml'] || '').replace(/<si\b[^>]*>([\s\S]*?)<\/si>/g, (_, b) => { let s = ''; b.replace(/<t\b[^>]*>([\s\S]*?)<\/t>/g, (__, t) => { s += unesc(t); return __; }); sst.push(s); return _; });
  const rows = [];
  xml.replace(/<row\b[^>]*>([\s\S]*?)<\/row>/g, (_, rb) => {
    const r = []; rb.replace(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, (__, at, inner) => {
      const ref = /\br="([A-Z]+\d+)"/.exec(at), t = /\bt="([^"]*)"/.exec(at); if (!ref) return __;
      let v = null; inner = inner || '';
      if (t && t[1] === 's') { const m = /<v>([\s\S]*?)<\/v>/.exec(inner); v = m ? sst[Number(m[1])] : null; }
      else if (t && t[1] === 'inlineStr') { let s = ''; inner.replace(/<t\b[^>]*>([\s\S]*?)<\/t>/g, (___, x) => { s += unesc(x); return ___; }); v = s; }
      else { const m = /<v>([\s\S]*?)<\/v>/.exec(inner); if (m) v = t && (t[1] === 'str' || t[1] === 'e') ? unesc(m[1]) : Number(m[1]); }
      r[colN(ref[1])] = v; return __;
    });
    rows.push(r); return _;
  });
  return rows;
}
const isoDate = (y, m, d) => y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0') : '';
function dobOf(v) {
  if (typeof v === 'number' && v > 1000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 86400e3)); return isoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); }
  const s = clean(v); let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s); if (m) return isoDate(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(s); return m ? isoDate(+m[3], +m[2], +m[1]) : '';
}
const title = s => { s = clean(s); return s && (s === s.toUpperCase() || s === s.toLowerCase()) ? s.toLowerCase().replace(/(^|[\s'’\-\/(.])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()) : s; };
const COUNTRY = {}, REGION = {}, DIPLOMA = {};
Object.keys(LEX.country).forEach(k => { COUNTRY[strip(k)] = LEX.country[k]; }); Object.keys(LEX.region).forEach(k => { REGION[strip(k)] = LEX.region[k]; }); Object.keys(LEX.diploma).forEach(k => { DIPLOMA[strip(k)] = LEX.diploma[k]; });
function parse(buf) {
  const rows = sheetRows(unzip(buf)), head = String((rows[0] || [])[0] || ''), hint = /BTS/i.test(head) ? 'BTS' : /HND/i.test(head) ? 'HND' : '';
  const out = []; let skipped = 0;
  rows.slice(2).forEach(r => {
    const name = title(r[0]); if (!name) return;
    const exam = up(r[10]), level = exam === 'BTS' ? 'BTS' : exam === 'HND' ? 'HND' : hint;
    if (!level) { skipped++; return; }
    const en = level === 'HND', g = strip(r[5]), phone = typeof r[6] === 'number' ? String(Math.round(r[6])) : clean(r[6]).replace(/[^\d+]/g, '');
    const country = up(r[3]), region = up(r[4]), dip = up(r[12]);
    out.push({
      name, level, dob: dobOf(r[1]), pob: title(r[2]),
      country: en ? (COUNTRY[strip(country)] || country) : country, region: en ? (REGION[strip(region)] || region) : region,
      sex: /^(M|MALE|MASCULIN|HOMME)/.test(g) ? 'M' : /^(F|FEMALE|FEMININ|FEMME)/.test(g) ? 'F' : '', phone, email: clean(r[7]).toLowerCase(),
      option: up(r[11]), diploma: en ? (DIPLOMA[strip(dip)] || dip) : dip, diplomaYear: /^\d{4}$/.test(String(Math.round(Number(r[13]) || 0))) ? Math.round(Number(r[13])) : 0, year: Math.round(Number(r[9]) || 0) || 1
    });
  });
  return { level: hint, rows: out, skipped };
}
module.exports = function makePrereg(ctx) {
  const { S, send, body, limited, audit, can } = ctx;
  async function handle(req, res, u, url, p) {
    const ok = !!u && u.status === 'active' && can(u);
    if (p === '/api/prereg/template' && req.method === 'GET') {
      if (!ok) { send(res, 403, { error: 'Only the Super Administrator or an officer who manages students may use the candidate sheet.' }); return true; }
      const lv = url.searchParams.get('level') === 'BTS' ? 'BTS' : 'HND';
      let buf; try { buf = fs.readFileSync(path.join(__dirname, 'prereg-template-' + lv.toLowerCase() + '.xlsx')); } catch (e) { send(res, 404, { error: 'Template not found.' }); return true; }
      res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Length': buf.length, 'Content-Disposition': 'attachment; filename="' + (lv === 'HND' ? 'HND-pre-registration-template-EN.xlsx' : 'BTS-fiche-de-pre-inscription-FR.xlsx') + '"', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(buf); return true;
    }
    if (p === '/api/prereg/parse' && req.method === 'POST') {
      if (!ok) { send(res, 403, { error: 'Only the Super Administrator or an officer who manages students may use the candidate sheet.' }); return true; }
      if (limited('prereg:' + u.id, 40, 3600e3)) { send(res, 429, { error: 'Too many uploads in one hour. Please wait.' }); return true; }
      let b; try { b = await body(req, 8e6); } catch (e) { send(res, e.code || 400, { error: e.code === 413 ? 'The file is too large (limit 5 MB).' : 'The upload could not be read.' }); return true; }
      let buf; try { buf = Buffer.from(String(b.b64 || ''), 'base64'); const r = parse(buf); send(res, 200, Object.assign({ ok: true }, r)); } catch (e) { send(res, 400, { error: String((e && e.message) || 'The workbook could not be read.').slice(0, 200) }); }
      return true;
    }
    return false;
  }
  return { handle, parse };
};
module.exports.parse = parse;
