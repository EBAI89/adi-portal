#!/usr/bin/env node
/* Builds the files packed inside the ADI staff app (android/staff/src/main/assets/site).
 *
 * It starts the portal (server.js) on this machine with an empty data folder, signs in as the super administrator, and saves:
 *   - the portal page and every script, style and image it loads;
 *   - the first data load, the seal and signatures, as the super administrator receives them;
 *   - the portal's own document register module (adi-docreg.js), which the app runs inside the page;
 *   - the app's own files (web/) and the PDF library (vendor/).
 * The result is a copy of the portal that runs inside the app with no server and no internet.
 *
 * Usage: node android/staff/build-assets.mjs        (Node 20+, no packages needed)
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, cpSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, pbkdf2Sync, createCipheriv } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..', '..'), OUT = join(HERE, 'src', 'main', 'assets', 'site');
const PORT = 4700 + Math.floor(Math.random() * 200), BASE = 'http://127.0.0.1:' + PORT;
const EMAIL = 'offline-build@adi.local', PASS = randomBytes(18).toString('base64url') + 'aA1!';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const must = (ok, msg) => { if (!ok) throw new Error(msg); };

const data = mkdtempSync(join(tmpdir(), 'adi-staff-'));
const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
  env: Object.assign({}, process.env, { PORT: String(PORT), DATA_DIR: data, DATABASE_URL: '', NODE_ENV: 'development', SESSION_SECRET: randomBytes(32).toString('hex'), SUPER_ADMIN_EMAIL: EMAIL, SUPER_ADMIN_PASSWORD: PASS,
    EMAIL_PROVIDER: 'log', SMS_PROVIDER: 'log', WHATSAPP_PROVIDER: 'log', MOMO_MODE: 'off' }) });
let slog = ''; srv.stdout.on('data', d => { slog += d; }); srv.stderr.on('data', d => { slog += d; });

async function main() {
  let up = false;
  for (let i = 0; i < 60 && !up; i++) { await sleep(500); try { up = (await fetch(BASE + '/api/health')).ok; } catch (e) {} }
  must(up, 'the portal did not start:\n' + slog.slice(-2000));

  const lr = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASS }) });
  const lj = await lr.json(); must(lr.ok && lj.me, 'sign-in failed: ' + JSON.stringify(lj));
  const cookie = (lr.headers.getSetCookie ? lr.headers.getSetCookie() : [lr.headers.get('set-cookie')]).map(c => String(c).split(';')[0]).join('; ');
  const get = async (p, auth) => { const r = await fetch(BASE + p, { headers: auth ? { Cookie: cookie } : {} }); must(r.ok, p + ' → HTTP ' + r.status); return r; };

  rmSync(OUT, { recursive: true, force: true }); mkdirSync(join(OUT, 'offline-app', 'api'), { recursive: true });
  const put = (rel, buf) => { const f = join(OUT, rel); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, buf); };

  // ---- the page and what it loads
  let html = await (await get('/', true)).text();
  const urls = new Set(Array.from(html.matchAll(/(?:src|href)="(\/[^"#]+)"/g)).map(m => m[1]).filter(u => !u.startsWith('//') && !/\.zip(\?|$)/.test(u)));
  ['/mail-assets/adi-logo.png', '/mail-assets/adi-seal.png', '/partner-assets/ub-seal.png', '/assets/img2.js'].forEach(u => urls.add(u));
  let n = 0;
  for (const u of urls) {
    const path = u.split('?')[0]; if (path === '/' || path.startsWith('/api/')) continue;
    try { put(path, Buffer.from(await (await get(u, true)).arrayBuffer())); n++; } catch (e) { console.warn('skipped', u, e.message); }
  }
  must(existsSync(join(OUT, 'assets', 'app.js')), 'the portal script was not saved');

  html = html.replace(/<body><div style="position:sticky;top:0;z-index:99999;[\s\S]*?Download ADI-portal-kit\.zip<\/a><\/div>/, '<body>');   // the developer's kit banner, shown only outside production
  must(!html.includes('ADI-portal-kit.zip'), 'kit banner still in the page');
  // ---- documents issued offline cannot be checked on the portal's Verify page (the portal has no record of them), so they must not say they can:
  //      the QR code and the printed line lead to the Registry instead. Each wording is checked, so a change in the portal stops the build rather than slip through.
  {
    let app = readFileSync(join(OUT, 'assets', 'app.js'), 'utf8');
    const swap = (from, to, min) => { const k = app.split(from).length - 1; must(k >= (min || 1), 'portal script: expected wording not found — ' + from.slice(0, 60)); app = app.split(from).join(to); };
    const REGISTRY = 'e.bill@adiuniversity.com';
    swap("url = vbase + '/#/verify/' + reg.serial + '?c=' + reg.code;", "url = 'mailto:" + REGISTRY + "?subject=' + encodeURIComponent('Verification of document ' + reg.serial + ' (code ' + reg.code + ')');");
    swap("d.textWithLink(vhost + '/#/verify',", "d.textWithLink('" + REGISTRY + "',", 2);
    swap("'Not verifiable = not authentic. / Non v\\u00e9rifiable = non authentique.'", "'Issued offline: the Registry confirms it on request. / D\\u00e9livr\\u00e9 hors ligne : le Secr\\u00e9tariat le confirme sur demande.'");
    swap('a verification code that can be checked online.', 'a verification code that the Registry confirms on request.');
    swap('un code vérifiable en ligne.', 'un code de vérification que le Secrétariat confirme sur demande.');
    put('assets/app.js', app);
  }

  // ---- the PDF library: packed, not fetched from the internet
  const CDN = /https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/jspdf\/[^"']+\/jspdf\.umd\.min\.js/g;
  must(CDN.test(html), 'the page no longer loads jsPDF from the expected address'); html = html.replace(CDN, '/offline-app/jspdf.umd.min.js');
  put('offline-app/jspdf.umd.min.js', readFileSync(join(HERE, 'vendor', 'jspdf.umd.min.js')));
  put('offline-app/jspdf-LICENSE.txt', readFileSync(join(HERE, 'vendor', 'jspdf-LICENSE.txt')));

  // ---- the register module, run inside the page; offline serial numbers carry the device tag so they never collide with the portal's
  let reg = readFileSync(join(ROOT, 'adi-docreg.js'), 'utf8');
  const SER = "String(nextN()).padStart(6, '0')"; must(reg.split(SER).length === 2, 'adi-docreg.js: the serial number line has changed');
  reg = reg.replace(SER, "(ctx.serialTag || '') + String(nextN()).padStart(4, '0')");
  // the records transcribed into the module (holders' names, dates of birth and marks) are taken out of the packed script and travel with the sealed data
  const SEEDM = /const SP_SEED_RECS = (\[.*\]);\n/.exec(reg); must(SEEDM, 'adi-docreg.js: the transcribed records were not found');
  const spSeed = JSON.parse(SEEDM[1]); must(Array.isArray(spSeed), 'adi-docreg.js: transcribed records unreadable');
  reg = reg.replace(SEEDM[0], 'const SP_SEED_RECS = (ctx.seedRecs || []);\n');
  put('offline-app/docreg.js', 'window.__ADI_DOCREG = function (require, module, Buffer) {\n' + reg + '\n};\n');
  for (const f of ['offline-server.js', 'offline-after.js', 'gate.html']) cpSync(join(HERE, 'web', f), join(OUT, 'offline-app', f));

  // ---- the app's scripts: the in-page server first (before the page's first request), the glue last
  must(html.includes('<head>'), 'unexpected page head'); must(html.includes('</body>'), 'unexpected page end');
  html = html.replace('<head>', '<head><script src="/offline-app/docreg.js"></script><script src="/offline-app/offline-server.js"></script>');
  html = html.replace(/<\/body>(?![\s\S]*<\/body>)/, '<script src="/offline-app/offline-after.js"></script></body>');
  put('index.html', html);
  // Android leaves out of the app any packed file or folder whose name starts with "_" or ".": none may exist here
  const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e => [e.name, ...(e.isDirectory() ? walk(join(d, e.name)) : [])]);
  must(!walk(OUT).some(nm => /^[_.]/.test(nm)), 'a packed file or folder starts with "_" or ".": Android would leave it out');

  // ---- data, as the super administrator receives it
  const health = await (await get('/api/health', true)).json(); must(health.ok && health.me === lj.me, 'health check');
  const sync = await (await get('/api/sync?since=0&epoch=&vk=&lite=1', true)).json(); must(sync.full && sync.me === lj.me && sync.cols && sync.cols.users, 'first data load');
  const u = sync.cols.users[lj.me]; must(u && u.role === 'super_admin', 'super administrator account'); u.email = ''; u.name = 'Super Administrator';
  ['sessions', 'audit', 'notifs', 'mailbox'].forEach(c => { if (sync.cols[c]) sync.cols[c] = {}; });
  const sig = await (await get('/api/sig', true)).json(); must(sig && sig.seal && sig.admin, 'seal and signatures');
  put('offline-app/api/health.json', JSON.stringify(health));
  /* The students' records, the seal and the signatures are never packed in clear. They are sealed (AES-256-GCM) with a key drawn from the
     activation code, so the app, even downloaded by a stranger, shows and issues nothing without that code. Sealing needs the code and is
     done by the owner (ADI_SEAL_CODE=… node android/staff/build-assets.mjs); the sealed files are kept in android/staff/sealed and the
     automatic build only packs them. */
  const SEALED = join(HERE, 'sealed'), code = String(process.env.ADI_SEAL_CODE || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code) {
    must(code.length >= 12, 'the activation code must have at least 12 letters and digits');
    const salt = randomBytes(16), iter = 600000, key = pbkdf2Sync(code, salt, iter, 32, 'sha256');
    const seal = obj => { const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', key, iv), ct = Buffer.concat([c.update(Buffer.from(JSON.stringify(obj), 'utf8')), c.final(), c.getAuthTag()]); return JSON.stringify({ v: 1, salt: salt.toString('hex'), iter, iv: iv.toString('hex'), ct: ct.toString('base64') }); };
    mkdirSync(SEALED, { recursive: true });
    writeFileSync(join(SEALED, 'sync.enc.json'), seal(Object.assign({}, sync, { __spSeed: spSeed }))); writeFileSync(join(SEALED, 'sig.enc.json'), seal(sig));
    writeFileSync(join(SEALED, 'sealed-for.txt'), 'portal version ' + health.ver + ', sealed ' + new Date().toISOString() + '\n');
    console.log('data sealed with the activation code');
  }
  for (const f of ['sync.enc.json', 'sig.enc.json']) { must(existsSync(join(SEALED, f)), 'android/staff/sealed/' + f + ' is missing: seal the data first (ADI_SEAL_CODE=… node android/staff/build-assets.mjs)'); cpSync(join(SEALED, f), join(OUT, 'offline-app', 'api', f)); }
  console.log('staff app files written to', OUT, '—', n, 'page files, portal version', health.ver, ', students', Object.keys(sync.cols.students || {}).length);
}

main().then(() => 0, e => { console.error('BUILD FAILED:', e.message); return 1; }).then(code => { srv.kill(); try { rmSync(data, { recursive: true, force: true }); } catch (e) {} process.exit(code); });
