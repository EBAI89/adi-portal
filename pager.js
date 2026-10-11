'use strict';
/* Back / Next paging for every long table in the portal (applications, students, payments, logs ...).
 * Rows stay in the page and are only hidden, so every button inside a row keeps working.
 * On phones the tables already show as cards; the cards are the same rows, so they are paged too. */
(function () {
  if (window.__PG_INSTALLED) return;
  window.__PG_INSTALLED = true;

  const SIZE = 20;                       // rows per page
  const LBL = (en, fr) => (typeof LANG !== 'undefined' && LANG === 'fr') ? fr : en;
  const memo = new Map();                // table key -> { page, n }
  let queued = false;

  function keyOf(tb, i) {
    const heads = Array.from(tb.querySelectorAll('thead th')).map(h => h.textContent.trim()).join('|');
    return (location.hash || '') + '#' + i + '#' + heads;
  }
  function rowsOf(tb) {
    const body = tb.tBodies && tb.tBodies[0];
    return body ? Array.from(body.rows).filter(r => !r.querySelector('[colspan]')) : [];
  }

  function build(tb, i) {
    const rows = rowsOf(tb);
    if (tb.dataset.pg) return;
    if (rows.length <= SIZE || tb.classList.contains('nopage')) return;
    tb.dataset.pg = '1';
    const host = tb.closest('.tw') || tb;
    const key = keyOf(tb, i), pages = Math.ceil(rows.length / SIZE);
    const saved = memo.get(key);
    let cur = saved && saved.n === rows.length ? Math.min(saved.page, pages) : 1;

    const bar = document.createElement('div');
    bar.className = 'pgbar';
    bar.innerHTML = `<button type="button" class="btn sm pg-prev">&larr; ${LBL('Back', 'Retour')}</button>
      <span class="small muted pg-info" aria-live="polite"></span>
      <button type="button" class="btn sm pg-next">${LBL('Next', 'Suivant')} &rarr;</button>`;
    host.insertAdjacentElement('afterend', bar);
    const prev = bar.querySelector('.pg-prev'), next = bar.querySelector('.pg-next'), info = bar.querySelector('.pg-info');

    const show = (n, user) => {
      cur = Math.max(1, Math.min(pages, n));
      memo.set(key, { page: cur, n: rows.length });
      const a = (cur - 1) * SIZE, b = Math.min(rows.length, a + SIZE);
      rows.forEach((r, k) => r.classList.toggle('pg-h', k < a || k >= b));
      prev.disabled = cur <= 1; next.disabled = cur >= pages;
      info.textContent = LBL('Page ', 'Page ') + cur + ' / ' + pages + ' · ' + (a + 1) + '–' + b + ' ' + LBL('of', 'sur') + ' ' + rows.length;
      if (user) { const top = host.getBoundingClientRect().top; if (top < 0 || top > window.innerHeight * .6) host.scrollIntoView({ block: 'start' }); }
    };
    prev.addEventListener('click', () => show(cur - 1, true));
    next.addEventListener('click', () => show(cur + 1, true));
    show(cur, false);
  }

  function pass() {
    queued = false;
    document.querySelectorAll('.tw table').forEach((tb, i) => {
      const bar = tb.closest('.tw') && tb.closest('.tw').nextElementSibling;
      if (tb.dataset.pg && !(bar && bar.classList.contains('pgbar'))) delete tb.dataset.pg;   // bar was lost in a redraw
      try { build(tb, i); } catch (e) { /* never break the page for a pager */ }
    });
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(pass); } }

  const root = document.getElementById('app') || document.body;
  new MutationObserver(queue).observe(root, { childList: true, subtree: true });
  queue();
})();
