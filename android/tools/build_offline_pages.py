#!/usr/bin/env python3
"""Rebuilds the pages packed inside the Android app (android/app/src/main/assets/offline/index.html).

The public Programmes, Fees and Contact pages are read from a running copy of the portal, in English and French,
and written as one self-contained page that needs neither internet nor the server.

Usage:  python3 android/tools/build_offline_pages.py [portal address, default http://localhost:4599]
Needs:  pip install playwright beautifulsoup4  (and a Chromium for Playwright)
"""
import sys, re, json, datetime, pathlib
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4599').rstrip('/')
PORTAL = 'https://adi-portal.onrender.com'
OUT = pathlib.Path(__file__).resolve().parents[1] / 'app/src/main/assets/offline/index.html'
LEVELS = [('HND', 'HND'), ('BTS', 'BTS'), ('BSC', 'Bachelor'), ('MSC', 'Master')]
KEEP_ATTR = {'href', 'class', 'colspan', 'rowspan', 'open'}

def capture():
    cap = {}
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for lang in ('en', 'fr'):
            ctx = b.new_context(viewport={'width': 390, 'height': 800}); pg = ctx.new_page()
            pg.add_init_script("try{localStorage.setItem('adi_lang','%s')}catch(e){}" % lang)
            pg.goto(BASE + '/'); pg.wait_for_function("typeof BOOT_DONE!=='undefined' && BOOT_DONE"); pg.wait_for_timeout(1500)
            assert pg.evaluate('()=>LANG') == lang
            def grab(route):
                pg.evaluate("r=>{location.hash='#/'+r}", route); pg.wait_for_timeout(1200)
                return pg.evaluate("()=>document.querySelector('main').innerHTML")
            cap[lang] = {'home': grab('home'), 'fees': grab('fees'), 'contact': grab('contact'), 'prog': {k: grab('programmes/' + k) for k, _ in LEVELS}}
            cap[lang]['util'] = pg.evaluate("()=>Array.from(document.querySelectorAll('.util .u1,.util .u2')).map(e=>e.innerText.trim())")
            ctx.close()
        b.close()
    return cap

def clean(node):
    for e in node.select('[data-full]'):
        if e.get('data-full'): e.string = e['data-full']
    for e in node.select('button, input, select, textarea, label, form, script, style, img, .fld, .curbox, .phero, .ms-hint, .rm-more, .tabs'): e.decompose()
    for t in node.select('table'):                       # "Open now / Overdue" depends on today's date: not kept in a saved copy
        if t.select('.badge'):
            for r in t.select('tr'):
                cells = r.find_all(['th', 'td'], recursive=False)
                if len(cells) > 2: cells[-1].decompose()
    for a in node.select('a[href]'):
        h = a['href']
        if h.startswith('#/'): a['href'] = PORTAL + '/' + h
        elif h.startswith('/'): a['href'] = PORTAL + h
    for e in node.find_all(True):
        for k in list(e.attrs):
            if k not in KEEP_ATTR: del e[k]
    for e in node.select('p, div'):
        if not e.get_text(strip=True) and not e.find(True): e.decompose()
    return node

def inner(html, sel='section.s .wrap'):
    s = BeautifulSoup(html, 'html.parser')
    return [clean(w) for w in s.select(sel)]

def programmes(html):
    w = inner(html)[0]
    for a in w.select('a.btn'): a.decompose()
    for h in w.find_all('h2'): h.decompose()
    for d in w.select('details'): del d['open']
    return w.decode_contents()

def page(html):
    return ''.join(w.decode_contents() for w in inner(html))

def home(html):
    s = BeautifulSoup(html, 'html.parser'); w = s.select_one('.hero .wrap')
    g = lambda q: (w.select_one(q).get_text(' ', strip=True) if w and w.select_one(q) else '')
    m = s.select_one('.mentor-band'); 
    return {'eyebrow': g('.eyebrow') or g('.kicker'), 'h1': g('h1'), 'p': g('p'), 'mentor': re.sub(r'\s+', ' ', m.get_text(' ', strip=True)) if m else ''}

def main():
    cap = capture(); data = {}
    for lang in ('en', 'fr'):
        c = cap[lang]
        data[lang] = {'home': home(c['home']), 'util': c['util'], 'fees': page(c['fees']), 'contact': page(c['contact']), 'prog': {k: programmes(v) for k, v in c['prog'].items()}}
    tpl = (pathlib.Path(__file__).parent / 'offline-template.html').read_text(encoding='utf-8')
    today = datetime.date.today()
    out = tpl.replace('/*__DATA__*/', 'const DATA = ' + json.dumps(data, ensure_ascii=False).replace('</', '<\\/') + ';\nconst BUILT = "' + today.isoformat() + '";\nconst PORTAL = "' + PORTAL + '";')
    OUT.write_text(out, encoding='utf-8'); print('written', OUT, len(out), 'bytes')
    for lang in ('en', 'fr'): print(lang, data[lang]['home'], data[lang]['util'], {k: v.count('<li>') for k, v in data[lang]['prog'].items()}, len(data[lang]['fees']), len(data[lang]['contact']))

if __name__ == '__main__': main()
