'use strict';
/* The ADI Students Guide as an editable document.
 * - sanitize(): the only HTML the portal accepts and shows for the guide (an allowlist; everything else is dropped).
 * - docHtml(): the complete printable page (cover, contents, sections, ADI seal on every page, logo watermark on every page but the cover).
 *   The same page is used to read the guide online, to save it as a PDF, and, in edit mode, as the super administrator's editing surface. */

const TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'p', 'br', 'hr', 'b', 'strong', 'i', 'em', 'u', 's', 'sup', 'sub', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span', 'section', 'blockquote', 'a']);
const VOID = new Set(['br', 'hr']);
const CLASSES = new Set(['sec', 'front', 'nosub', 'kick', 'art', 'l1', 'l2', 'n', 't', 'note', 'small', 'grades', 'fees', 'svc', 'rate', 'q', 'rn', 'blank', 'ln', 's', 'lines', 'evalform', 'freq', 'center', 'toc', 'annex', 'al-a', 'al-g', 'pagebreak', 'keep', 'docnote']);
const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|svg|math|template|form|textarea|select|button|noscript|title|head)\b[\s\S]*?<\/\1\s*>/gi;
const FONTSZ = { 1: '0.63em', 2: '0.82em', 3: '1em', 4: '1.13em', 5: '1.5em', 6: '2em', 7: '3em' };
const SIZEKW = new Set(['xx-small', 'x-small', 'small', 'medium', 'large', 'x-large', 'xx-large', 'xxx-large', 'smaller', 'larger']);
const COLOR = /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\)|[a-z]{3,20})$/i;

function cleanStyle(s) {
  const out = [];
  String(s || '').split(';').forEach(part => {
    const i = part.indexOf(':'); if (i < 1) return;
    const k = part.slice(0, i).trim().toLowerCase(), v = part.slice(i + 1).trim().toLowerCase();
    if (!v || v.length > 40 || /url|expression|import|\\|\/\*/.test(v)) return;
    if (k === 'text-align' && /^(left|right|center|justify)$/.test(v)) out.push(k + ':' + v);
    else if ((k === 'color' || k === 'background-color') && COLOR.test(v)) out.push(k + ':' + v);
    else if (k === 'font-size' && (SIZEKW.has(v) || /^\d{1,3}(\.\d{1,2})?(px|pt|em|rem|%)$/.test(v))) out.push(k + ':' + v);
    else if (k === 'font-weight' && /^(bold|normal|[1-9]00)$/.test(v)) out.push(k + ':' + v);
    else if (k === 'font-style' && /^(italic|normal)$/.test(v)) out.push(k + ':' + v);
    else if (k === 'text-decoration' && /^(underline|line-through|none)( (underline|line-through))?$/.test(v)) out.push(k + ':' + v);
    else if (k === 'line-height' && /^\d(\.\d{1,2})?$/.test(v)) out.push(k + ':' + v);
  });
  return out.join(';');
}
function cleanAttrs(tag, raw) {
  const a = {}, re = /([a-zA-Z_:][-\w:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g; let m;
  while ((m = re.exec(raw))) {
    const k = m[1].toLowerCase(), v = (m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] || '').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    if (k === 'class') { const c = v.split(/\s+/).filter(x => CLASSES.has(x)); if (c.length) a.class = c.join(' '); }
    else if (k === 'id' && /^[\w-]{1,30}$/.test(v)) a.id = v;
    else if (k === 'style') { const s = cleanStyle(v); if (s) a.style = s; }
    else if ((k === 'colspan' || k === 'rowspan') && /^\d{1,2}$/.test(v) && (tag === 'td' || tag === 'th')) a[k] = v;
    else if (k === 'href' && tag === 'a' && /^(https?:\/\/|mailto:|#)[^\s"<>]{0,300}$/i.test(v)) a.href = v;
    else if (tag === 'font' && (k === 'size' || k === 'color')) a['f' + k] = v;
  }
  return a;
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function sanitize(html) {
  let s = String(html || '').replace(/<!--[\s\S]*?-->/g, '').replace(DROP_WITH_CONTENT, '');
  const out = [], stack = [], re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^<>]*)>|([^<]+)|</g; let m;
  while ((m = re.exec(s))) {
    if (m[4] !== undefined) { out.push(m[4].replace(/&(?!(?:[a-z]+|#\d+|#x[0-9a-f]+);)/gi, '&amp;')); continue; }
    if (!m[2]) { out.push('&lt;'); continue; }
    const closing = m[1] === '/', tag = m[2].toLowerCase();
    if (tag === 'font' && !closing) {
      const a = cleanAttrs('font', m[3]), st = [];
      if (a.fsize && FONTSZ[a.fsize]) st.push('font-size:' + FONTSZ[a.fsize]); if (a.fcolor && COLOR.test(a.fcolor)) st.push('color:' + a.fcolor);
      out.push('<span' + (st.length ? ' style="' + st.join(';') + '"' : '') + '>'); stack.push('span'); continue;
    }
    if (tag === 'font') { const i = stack.lastIndexOf('span'); if (i >= 0) { while (stack.length > i + 1) out.push('</' + stack.pop() + '>'); out.push('</' + stack.pop() + '>'); } continue; }
    if (!TAGS.has(tag)) continue;
    if (closing) { const i = stack.lastIndexOf(tag); if (i < 0) continue; while (stack.length > i + 1) out.push('</' + stack.pop() + '>'); out.push('</' + stack.pop() + '>'); continue; }
    const a = cleanAttrs(tag, m[3]), at = Object.keys(a).map(k => ' ' + k + '="' + esc(a[k]) + '"').join('');
    if (VOID.has(tag)) { out.push('<' + tag + at + '>'); continue; }
    out.push('<' + tag + at + '>'); stack.push(tag);
  }
  while (stack.length) out.push('</' + stack.pop() + '>');
  return out.join('');
}

const FONTS = { serif: '"Liberation Serif","Times New Roman",Times,serif', sans: '"Liberation Sans",Arial,Helvetica,sans-serif' };
const HEAD_DEF = { en: ['ADI Students’ Guide', '2024 edition'], fr: ['Guide de l’étudiant ADI', 'Édition 2024'] };
function defaultFmt(lang) { const h = HEAD_DEF[lang] || HEAD_DEF.en; return { font: 'serif', size: 10.3, lh: 1.42, hc: '#0b2559', ac: '#c9a24b', hl: h[0], hr: h[1], seal: true, wm: true, wmo: 0.07, num: true, just: true }; }
function cleanFmt(f, lang) {
  const d = defaultFmt(lang), o = Object.assign({}, d, f && typeof f === 'object' ? f : {});
  const num = (v, lo, hi, df) => { v = Number(v); return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : df; }, col = (v, df) => /^#[0-9a-f]{6}$/i.test(String(v)) ? String(v).toLowerCase() : df;
  return { font: o.font === 'sans' ? 'sans' : 'serif', size: num(o.size, 8, 14, d.size), lh: num(o.lh, 1.1, 2, d.lh), hc: col(o.hc, d.hc), ac: col(o.ac, d.ac), hl: String(o.hl == null ? d.hl : o.hl).slice(0, 80), hr: String(o.hr == null ? d.hr : o.hr).slice(0, 80), seal: o.seal !== false, wm: o.wm !== false, wmo: num(o.wmo, 0, 0.3, d.wmo), num: o.num !== false, just: o.just !== false };
}

const CSS = `
:root{--navy:#0b2559;--gold:#c9a24b;--crimson:#9b1c31;--ink:#17202f;--line:#cfd6e4;--soft:#f3f6fb;--gfont:"Liberation Serif",serif;--gsize:10.3pt;--glh:1.42;--gjust:justify}
*{box-sizing:border-box}
html{font:var(--gsize)/var(--glh) var(--gfont);color:var(--ink);-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;hyphens:auto}
.doc{position:relative;z-index:1}
.wm{position:fixed;left:50%;top:50%;width:118mm;transform:translate(-50%,-50%);opacity:var(--wmo,.07);z-index:0;pointer-events:none}
.seal{position:fixed;right:11mm;bottom:4mm;width:20mm;opacity:.9;mix-blend-mode:multiply;z-index:3;pointer-events:none}
.nowm .wm,.noseal .seal,.noseal .cseal{display:none}
.cover{position:relative;z-index:5;width:210mm;height:297mm;break-after:page;page:cover;background:#fff}
.cover img.cv{width:210mm;height:297mm;display:block}
.cover img.cseal{position:absolute;left:26mm;bottom:64mm;width:32mm;opacity:.92;mix-blend-mode:multiply}
.front,.tocpg{page:plain;break-after:page}
.sec{break-before:page;padding-top:2mm}
.front.sec{break-before:auto}
.tocpg{break-before:page}
h1{font:700 17pt/1.2 "Liberation Sans",Arial,sans-serif;color:var(--gh,var(--navy));margin:0 0 6mm;padding-bottom:3mm;border-bottom:1.2pt solid var(--gac,var(--gold));break-after:avoid}
.kick{font:700 9pt "Liberation Sans",Arial,sans-serif;letter-spacing:.16em;color:var(--crimson);margin:0 0 2mm}
h2{font:700 12pt/1.3 "Liberation Sans",Arial,sans-serif;color:var(--gh,var(--navy));margin:6mm 0 2.4mm;break-after:avoid}
h3{font:700 10.4pt/1.3 "Liberation Sans",Arial,sans-serif;color:var(--gh,#243a6b);margin:4.5mm 0 2mm;break-after:avoid}
h4{font:700 10pt "Liberation Sans",Arial,sans-serif;margin:3mm 0 1.5mm;color:var(--gh,var(--navy))}
h2.annex{break-before:page;margin-top:0}
p{margin:0 0 2.8mm;text-align:var(--gjust);orphans:3;widows:3}p.center{text-align:center}
ul{margin:0 0 3mm;padding-left:6mm}li{margin:0 0 1.2mm;text-align:var(--gjust)}ul li::marker{color:var(--gac,var(--gold))}
ol{list-style:none;margin:0 0 3mm;padding-left:8mm;counter-reset:al}
ol li{counter-increment:al;position:relative;margin:0 0 1.4mm}
ol li::before{content:counter(al,lower-alpha) ".";position:absolute;left:-7mm;width:6mm;text-align:right;font-weight:700;color:var(--gh,var(--navy))}
ol.al-g{counter-reset:al 6}
.art{display:flex;gap:3mm;margin:0 0 2.6mm;break-inside:avoid-page}
.art .n{flex:0 0 14mm;font:700 9.6pt/1.5 "Liberation Sans",Arial,sans-serif;color:var(--gh,var(--navy))}
.art.l2{margin-left:14mm}.art.l2 .n{flex-basis:7mm}.art .t{flex:1;text-align:var(--gjust);min-width:0}
.note{border-left:2.4pt solid var(--gac,var(--gold));background:rgba(243,246,251,.85);padding:2.4mm 4mm;margin:3mm 0;break-inside:avoid}
blockquote{margin:0 0 4mm;padding:3mm 5mm;border-left:2.4pt solid var(--crimson);background:rgba(243,246,251,.85);text-align:var(--gjust);font-style:italic}
table{border-collapse:collapse;width:100%;margin:2mm 0 4mm;font:9.6pt/1.35 "Liberation Sans",Arial,sans-serif;break-inside:avoid}
th{background:var(--gh,var(--navy));color:#fff;text-align:left;padding:1.8mm 2.4mm;font-weight:700}
td{padding:1.6mm 2.4mm;border-bottom:.5pt solid var(--line)}
tbody tr:nth-child(even) td{background:rgba(243,246,251,.85)}
table.grades td,table.grades th{text-align:center}table.grades td:last-child,table.grades th:last-child{text-align:left}
table.fees td:not(:first-child),table.fees th:not(:first-child){text-align:right;white-space:nowrap}table.fees{font-size:9pt}table.fees:not(.small) td:first-child,table.fees:not(.small) th:first-child{width:40%}table.fees:not(.small) td:not(:first-child),table.fees:not(.small) th:not(:first-child){padding-left:1.4mm;padding-right:1.4mm}table.fees td{padding:1.1mm 2.2mm}p:has(+table),h3:has(+p+table){break-after:avoid}
table.fees.small{width:auto;min-width:60%}table.fees.small td,table.fees.small th,table.fees.svc td,table.fees.svc th{text-align:left}
.evalform{border:1pt solid var(--line);padding:4mm;margin-top:2mm}
.blank{margin:0 0 3mm;font:10pt/1.5 "Liberation Sans",Arial,sans-serif}.blank .ln{display:inline-block;border-bottom:.8pt solid #333;width:105mm;height:4mm}.blank .ln.s{width:42mm}.freq{margin-left:4mm}
table.rate td.q{text-align:left;width:112mm}table.rate th{text-align:center}table.rate td{height:6mm;border:.6pt solid #888;text-align:center;background:#fff!important}table.rate th.q{text-align:left}.rn{display:inline-block;width:9mm;font-weight:700}
.lines div{border-bottom:.8pt dotted #555;height:7mm}
.pagebreak{break-after:page;height:0}
.sigimg{display:block;max-height:17mm;max-width:46mm;margin:1mm auto;mix-blend-mode:multiply}
.docnote{font:9.4pt/1.5 "Liberation Sans",Arial,sans-serif;color:#2b3a59;margin-top:8mm}
.tocpg .ttl{font:700 17pt "Liberation Sans",Arial,sans-serif;color:var(--gh,var(--navy));margin:0 0 6mm;padding-bottom:3mm;border-bottom:1.2pt solid var(--gac,var(--gold))}
.tl{display:flex;align-items:baseline;gap:2mm;font:9.4pt/1.38 "Liberation Sans",Arial,sans-serif;color:inherit;text-decoration:none}
.tl .tt{flex:0 1 auto}.tl .dots{flex:1;border-bottom:1pt dotted #8a97b5;transform:translateY(-1.2mm);min-width:6mm}.tl .pg{font-weight:700;color:var(--gh,var(--navy));min-width:6mm;text-align:right}
.tl.s{margin-top:1.8mm;font-weight:700;color:var(--gh,var(--navy))}.tl.u{padding-left:7mm;font-size:8.8pt;color:#2b3a59}
.nopg .tl .dots,.nopg .tl .pg{display:none}
@page{size:A4;margin:27mm 20mm 25mm 20mm}
@page cover{margin:0}
@page plain{margin:27mm 20mm 25mm 20mm}
@media screen{
 body{background:#8e98ad}
 .bar{position:sticky;top:0;z-index:50;background:#0b2559;color:#fff;font:600 14px/1.3 "Liberation Sans",Arial,sans-serif;padding:10px 14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
 .bar a,.bar button{background:#c9a24b;color:#241b00;border:0;border-radius:8px;padding:8px 14px;font:700 14px "Liberation Sans",Arial,sans-serif;text-decoration:none;cursor:pointer}
 .bar a.g{background:transparent;color:#fff;border:1px solid #ffffff66}
 .bar span{flex:1;min-width:140px;font-weight:500;opacity:.9}
 .doc{width:210mm;max-width:100%;margin:12px auto;background:#fff;padding:0}
 .cover,.cover img.cv{max-width:100%;height:auto}.cover{width:210mm;height:auto;aspect-ratio:210/297}
 .doc>section,.doc>.tocpg,.doc>#gbody>section,.doc>#gfront>section{padding:14mm 17mm;border-bottom:3px dashed #d3d8e4;background:#fff}
 .wm{position:fixed}
 .tocpg{padding:14mm 17mm}
}
.edit .bar,.edit .wm,.edit .seal{display:none}
.edit body{background:#e9edf5}
.edit .doc{margin:0 auto;box-shadow:none}
.edit #gbody,.edit #gfront{outline:none}.edit #gbody{min-height:60vh}
.edit #gbody section{outline:1px dashed transparent}.edit #gbody section:hover{outline-color:#9db0d6}
.edit #gbody td,.edit #gbody th{outline:1px dotted #b9c4dd}
.edit .tocpg::before{content:"Contents (generated automatically)";display:block;font:600 11px Arial;color:#6b7aa0;margin-bottom:6px}
@media print{.bar{display:none!important}.doc{display:contents}.doc>section,.doc>.tocpg,.doc>#gbody,.doc>#gfront{position:relative;z-index:1}}
`;
const JS = `
window.applyFmt=function(f){var F={serif:'"Liberation Serif","Times New Roman",Times,serif',sans:'"Liberation Sans",Arial,Helvetica,sans-serif'};
var r=document.documentElement,q=function(s){return String(s||'').replace(/\\\\/g,'').replace(/"/g,'\\\\"').replace(/[\\r\\n]/g,' ')};
r.style.setProperty('--gfont',F[f.font]||F.serif);r.style.setProperty('--gsize',f.size+'pt');r.style.setProperty('--glh',f.lh);r.style.setProperty('--gh',f.hc);r.style.setProperty('--gac',f.ac);r.style.setProperty('--wmo',f.wmo);r.style.setProperty('--gjust',f.just===false?'left':'justify');
r.classList.toggle('nowm',f.wm===false);r.classList.toggle('noseal',f.seal===false);
var fr=window.GLANG==='fr',pgw='Page',ofw=fr?'sur':'of';\nvar hf='font:8.5pt "Liberation Sans",Arial;color:#5b6b8c;border-bottom:.6pt solid '+f.ac+';padding-bottom:2mm;vertical-align:bottom';
var css='@page{@top-left{content:"'+q(f.hl)+'";'+hf+'}@top-right{content:"'+q(f.hr)+'";'+hf+'}'+(f.num===false?'':'@bottom-center{content:"'+pgw+' " counter(page) " '+ofw+' " counter(pages);font:9pt "Liberation Sans",Arial;color:'+f.hc+'}')+'}@page cover{@top-left{content:none;border:0}@top-right{content:none;border:0}@bottom-center{content:none}}@page plain{@top-left{content:none;border:0}@top-right{content:none;border:0}'+(f.num===false?'':'@bottom-center{content:"'+pgw+' " counter(page) " '+ofw+' " counter(pages);font:9pt "Liberation Sans",Arial;color:'+f.hc+'}')+'}';
var s=document.getElementById('gfmt');if(!s){s=document.createElement('style');s.id='gfmt';document.head.appendChild(s)}s.textContent=css};
`;
const strip = h => String(h).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const KEEP = { ADI: 'ADI', ID: 'ID', IT: 'IT', HND: 'HND', BTS: 'BTS', GPA: 'GPA', BSC: 'BSc', MSC: 'MSc', DITEK: 'Ditek', AMERICAN: 'American', INSTITUTE: 'Institute', INSTITUT: 'Institut', SCHOOL: 'School', SCHOOLS: 'Schools', UNIT: 'Unit', 'ÉCOLE': 'École', 'ÉCOLES': 'Écoles' };
// All-capital headings read as sentence case in the table of contents, keeping acronyms and the Institute's proper names intact.
function niceCase(h) {
  if (!h || /[a-zà-ÿ]/.test(h)) return h;
  let first = true;
  return h.replace(/[A-ZÀ-ÖØ-Þ0-9]+/g, w => { let o = KEEP[w] || (first ? w.charAt(0) + w.slice(1).toLowerCase() : w.toLowerCase()); first = false; return o; });
}
function tocEntries(html) {
  const out = [], re = /<section\b([^>]*)>([\s\S]*?)<\/section>/g; let m;
  while ((m = re.exec(html))) {
    if (/\bfront\b/.test(m[1])) continue;
    const id = (/\bid="([\w-]+)"/.exec(m[1]) || [])[1] || '', k = strip((/<div class="kick">([\s\S]*?)<\/div>/.exec(m[2]) || [])[1] || ''), h = strip((/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(m[2]) || [])[1] || '');
    out.push({ s: true, id, t: (k ? k.charAt(0) + k.slice(1).toLowerCase() + ' — ' : '') + niceCase(h) });
    if (!/\bnosub\b/.test(m[1])) { const r2 = /<h2 class="[^"]*\btoc\b[^"]*"[^>]*>([\s\S]*?)<\/h2>/g; let q; while ((q = r2.exec(m[2]))) out.push({ s: false, id: '', t: strip(q[1]) }); }
  }
  return out;
}
const TOC_T = { en: 'Table of contents', fr: 'Table des matières' };
function docHtml(o) {
  const lang = o.lang === 'fr' ? 'fr' : 'en', fmt = cleanFmt(o.fmt, lang), html = o.html || '', pg = o.pg || null, base = o.base || '/guide-assets/';
  const ents = tocEntries(html);
  const toc = '<section class="tocpg' + (pg ? '' : ' nopg') + '"><div class="ttl">' + TOC_T[lang] + '</div>' + ents.map((e, i) => (e.id && !o.edit ? '<a class="tl s" href="#' + e.id + '">' : '<div class="tl ' + (e.s ? 's' : 'u') + '">') + '<span class="tt">' + esc(e.t) + '</span><span class="dots"></span><span class="pg">' + (pg && pg[i] ? esc(pg[i]) : '') + '</span>' + (e.id && !o.edit ? '</a>' : '</div>')).join('') + '</section>';
  // Automatic signatures: the tokens [[SIG:admission]], [[SIG:administrative]] and [[SIGNDATE]] in the text become the signatory's signature image and the date of signature (o.signDate). In edit mode the tokens stay visible so that saving keeps them.
  const signed = h => o.edit ? h : String(h).replace(/\[\[SIG:(admission|administrative)\]\]/g, (m, k) => '<img class="sigimg" src="' + base + 'sig-' + k + '.png" alt="' + (k === 'admission' ? 'Signature of the Admission Director' : 'Signature of the Administrative Director') + '">').replace(/\[\[SIGNDATE\]\]/g, esc(o.signDate || ''));
  const fm = /^\s*((?:<section\b[^>]*\bfront\b[^>]*>[\s\S]*?<\/section>\s*)*)([\s\S]*)$/.exec(html), front = fm ? fm[1] : '', rest = fm ? fm[2] : html;
  const bar = o.edit ? '' : '<div class="bar"><span>' + esc(fmt.hl) + ' — ' + esc(fmt.hr) + '</span>' + (o.print ? '<span>' + (lang === 'fr' ? 'Dans la fenêtre d’impression, choisissez « Enregistrer au format PDF ».' : 'In the print window, choose “Save as PDF”.') + '</span>' : '') + '<button onclick="window.print()">' + (lang === 'fr' ? 'Imprimer / PDF' : 'Print / PDF') + '</button><a class="g" href="#/' + (o.back || 'guide') + '" onclick="if(window.opener){window.close();return false}location.href=\'/#/' + (o.back || 'guide') + '\';return false">' + (lang === 'fr' ? 'Retour' : 'Back') + '</a></div>';
  return '<!doctype html><html lang="' + lang + '"' + (o.edit ? ' class="edit"' : '') + '><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(fmt.hl) + ' — ' + esc(fmt.hr) + '</title><style>' + CSS + '</style><script>' + JS + '</script></head><body>'
    + bar + '<img class="wm" src="' + base + 'adi-logo.png" alt=""><img class="seal" src="' + base + 'adi-seal.png" alt=""><div class="doc">'
    + '<div class="cover"><img class="cv" src="' + base + (o.cover || 'guide-cover-' + lang + '.jpg') + (o.assetV ? '?v=' + esc(o.assetV) : '') + '" alt="">' + (o.noCoverSeal ? '' : '<img class="cseal" src="' + base + 'adi-seal.png" alt="">') + '</div>'
    + (o.edit ? '<div id="gfront" contenteditable="true" spellcheck="true">' + front + '</div>' + toc + '<div id="gbody" contenteditable="true" spellcheck="true">' + rest + '</div>' : signed(front + toc + rest))
    + '</div><script>window.GLANG="' + (lang === 'fr' ? 'fr' : 'en') + '";window.GFMT=' + JSON.stringify(fmt).replace(/</g, '\\u003c') + ';applyFmt(' + JSON.stringify(fmt).replace(/</g, '\\u003c') + ');' + (o.print ? 'addEventListener("load",function(){setTimeout(function(){print()},900)});' : '') + '</script></body></html>';
}
module.exports = { sanitize, docHtml, cleanFmt, defaultFmt, tocEntries };
