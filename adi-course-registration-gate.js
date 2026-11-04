/**
 * ADI University — Course Registration Gate v1.0
 * ═══════════════════════════════════════════════════════════════
 * Enforces payment prerequisite before course enrolment:
 *   • Registration Fee:   50,000 XAF  (MoMo → +237678305489)
 *   • Platform Charge:      500 XAF  (MoMo → +237678305489)
 *   • Combined minimum:  50,500 XAF  (must both be CONFIRMED)
 *
 * Integration points
 * ──────────────────
 *   window.adiCourseGate.check()          → Promise<GateResult>
 *   window.adiCourseGate.guard(el)        → disables/enables a button/link
 *   window.adiCourseGate.renderBanner(el) → injects status banner into el
 *   document event  'adi:gate:open'       → fired when gate clears
 *   document event  'adi:gate:locked'     → fired when gate is locked
 *
 * ISO/IEC 25010 · WCAG 2.2 AA · ADI Design System v3
 * ═══════════════════════════════════════════════════════════════
 */
(function (root) {
  'use strict';

  /* ── Design tokens (ADI Design System v3) ───────────────── */
  var DS = {
    navy:    '#0B2559',
    royal:   '#2447B8',
    crimson: '#B3131E',
    gold:    '#C9A227',
    ok:      '#136F3F',
    okBg:    '#DDF3E6',
    warn:    '#8A5A00',
    warnBg:  '#FFF0CC',
    bad:     '#9B1420',
    badBg:   '#FBE0E2',
    info:    '#1B3F9A',
    infoBg:  '#E1E9FB'
  };

  /* ── Required payments ───────────────────────────────────── */
  var REQUIRED = [
    { key: 'registration', label: 'Registration Fee',   amount: 50000, currency: 'XAF' },
    { key: 'platform',     label: 'Platform Charge',    amount:   500, currency: 'XAF' }
  ];

  /* ── Storage key ─────────────────────────────────────────── */
  var STORE_KEY = 'adi_courseGate_v1';

  /* ── State cache ─────────────────────────────────────────── */
  var _cache = null;

  /* ─────────────────────────────────────────────────────────── */
  /*  Persistence helpers                                        */
  /* ─────────────────────────────────────────────────────────── */

  function loadStore() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function saveStore(data) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  /* ─────────────────────────────────────────────────────────── */
  /*  Gate logic                                                 */
  /* ─────────────────────────────────────────────────────────── */

  /**
   * GateResult
   * { open: Boolean, paid: [{key,label,amount,currency,confirmed,txId,date}], missing: [...] }
   */
  function computeGate(store) {
    var paid    = [];
    var missing = [];

    REQUIRED.forEach(function (req) {
      var record = store[req.key];
      if (record && record.confirmed) {
        paid.push(Object.assign({}, req, record));
      } else {
        missing.push(Object.assign({}, req));
      }
    });

    return { open: missing.length === 0, paid: paid, missing: missing };
  }

  /**
   * check() — returns current gate state.
   * Re-reads localStorage on every call so it reflects
   * confirmations made by the finance office in real time.
   */
  function check() {
    var store  = loadStore();
    var result = computeGate(store);
    _cache     = result;

    var eventName = result.open ? 'adi:gate:open' : 'adi:gate:locked';
    document.dispatchEvent(new CustomEvent(eventName, { detail: result }));

    return result;
  }

  /**
   * confirmPayment(key, txId) — called by the finance office
   * confirmation flow once a MoMo payment is validated.
   * key: 'registration' | 'platform'
   */
  function confirmPayment(key, txId) {
    var store = loadStore();
    store[key] = {
      confirmed: true,
      txId:      txId || '',
      date:      new Date().toISOString()
    };
    saveStore(store);
    _cache = null;
    return check();
  }

  /**
   * resetGate() — admin/testing utility.
   */
  function resetGate() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    _cache = null;
    check();
  }

  /* ─────────────────────────────────────────────────────────── */
  /*  UI helpers                                                 */
  /* ─────────────────────────────────────────────────────────── */

  /**
   * guard(el) — disables a button/link until the gate is open.
   * Automatically re-enables when 'adi:gate:open' fires.
   */
  function guard(el) {
    if (!el) return;

    function update(result) {
      if (result.open) {
        el.removeAttribute('disabled');
        el.removeAttribute('aria-disabled');
        el.style.opacity = '';
        el.style.cursor  = '';
        el.title = '';
      } else {
        el.setAttribute('disabled', '');
        el.setAttribute('aria-disabled', 'true');
        el.style.opacity = '0.45';
        el.style.cursor  = 'not-allowed';
        el.title = 'Complete Registration Fee (50,000 XAF) and Platform Charge (500 XAF) to unlock course enrolment.';
      }
    }

    var result = check();
    update(result);

    document.addEventListener('adi:gate:open',   function (e) { update(e.detail); });
    document.addEventListener('adi:gate:locked', function (e) { update(e.detail); });
  }

  /**
   * renderBanner(containerEl) — injects a styled status banner.
   */
  function renderBanner(containerEl) {
    if (!containerEl) return;

    var result = check();

    var existing = containerEl.querySelector('[data-adi-gate-banner]');
    if (existing) existing.remove();

    var banner = document.createElement('div');
    banner.setAttribute('data-adi-gate-banner', '1');
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');

    if (result.open) {
      banner.style.cssText = [
        'display:flex', 'align-items:flex-start', 'gap:12px',
        'background:' + DS.okBg,
        'border-left:4px solid ' + DS.ok,
        'border-radius:0 4px 4px 0',
        'padding:14px 16px', 'margin:0 0 20px',
        'font-family:\'Public Sans\',system-ui,sans-serif',
        'font-size:0.88rem', 'line-height:1.55',
        'color:#101828'
      ].join(';');

      banner.innerHTML =
        '<span style="font-size:1.3rem;flex:0 0 auto;margin-top:-1px" aria-hidden="true">✅</span>' +
        '<div>' +
          '<strong style="display:block;font-size:0.92rem;color:' + DS.ok + ';margin-bottom:4px">' +
            'Enrolment Unlocked — Payments Confirmed' +
          '</strong>' +
          '<span>Both the Registration Fee (50,000 XAF) and Platform Charge (500 XAF) ' +
          'have been verified by the Finance Office. You may now proceed to register your courses for this semester.</span>' +
        '</div>';

    } else {
      /* Build checklist rows */
      var rows = REQUIRED.map(function (req) {
        var store  = loadStore();
        var record = store[req.key];
        var done   = record && record.confirmed;
        var color  = done ? DS.ok : DS.crimson;
        var icon   = done ? '✓' : '✗';
        return (
          '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(0,0,0,.07)">' +
            '<span style="font-weight:700;font-size:0.95rem;color:' + color + ';flex:0 0 20px;text-align:center">' + icon + '</span>' +
            '<span style="flex:1">' +
              '<strong>' + req.label + '</strong> — ' +
              req.amount.toLocaleString() + ' ' + req.currency +
            '</span>' +
            (done
              ? '<span style="font-size:0.76rem;color:' + DS.ok + ';font-weight:600;white-space:nowrap">Confirmed ✓</span>'
              : '<span style="font-size:0.76rem;color:' + DS.crimson + ';font-weight:600;white-space:nowrap">Pending</span>') +
          '</div>'
        );
      }).join('');

      banner.style.cssText = [
        'background:' + DS.warnBg,
        'border-left:4px solid ' + DS.gold,
        'border-radius:0 4px 4px 0',
        'padding:14px 16px', 'margin:0 0 20px',
        'font-family:\'Public Sans\',system-ui,sans-serif',
        'font-size:0.88rem', 'line-height:1.55',
        'color:#101828'
      ].join(';');

      banner.innerHTML =
        '<div style="font-weight:700;font-size:0.93rem;color:' + DS.warn + ';margin-bottom:8px;display:flex;align-items:center;gap:7px">' +
          '<span aria-hidden="true">🔒</span> ' +
          'Course Enrolment is Currently Locked' +
        '</div>' +
        '<p style="margin:0 0 10px;color:#475467">' +
          'To gain access to course registration, you must complete and have confirmed by ' +
          'the Finance Office the following mandatory payments:' +
        '</p>' +
        '<div style="background:#fff;border:1px solid #E5C76A;border-radius:4px;padding:8px 12px;margin-bottom:12px">' +
          rows +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:7px;font-size:0.82rem;color:' + DS.info + '">' +
          '<span aria-hidden="true">ℹ</span> ' +
          'Once your payment is processed via MTN MoMo and confirmed, this page will update automatically.' +
        '</div>';
    }

    containerEl.insertBefore(banner, containerEl.firstChild);

    /* Auto-refresh banner when gate state changes */
    document.addEventListener('adi:gate:open',   function () { renderBanner(containerEl); });
    document.addEventListener('adi:gate:locked', function () { renderBanner(containerEl); });
  }

  /* ─────────────────────────────────────────────────────────── */
  /*  Polling — re-check every 30 s for finance confirmation    */
  /* ─────────────────────────────────────────────────────────── */
  var _pollTimer = null;

  function startPolling(intervalMs) {
    if (_pollTimer) return;
    _pollTimer = setInterval(function () {
      var prev = _cache ? _cache.open : false;
      var next = check();
      if (!prev && next.open) {
        /* Gate just opened — stop polling */
        clearInterval(_pollTimer);
        _pollTimer = null;
      }
    }, intervalMs || 30000);
  }

  /* ─────────────────────────────────────────────────────────── */
  /*  Public API                                                 */
  /* ─────────────────────────────────────────────────────────── */
  root.adiCourseGate = {
    check:          check,
    guard:          guard,
    renderBanner:   renderBanner,
    confirmPayment: confirmPayment,
    resetGate:      resetGate,
    startPolling:   startPolling,
    REQUIRED:       REQUIRED
  };

  /* ── Auto-init on DOM ready ──────────────────────────────── */
  function init() {
    check();
    startPolling(30000);

    /* Auto-guard any element with data-adi-course-gate="guard" */
    document.querySelectorAll('[data-adi-course-gate="guard"]').forEach(guard);

    /* Auto-banner into any element with data-adi-course-gate="banner" */
    document.querySelectorAll('[data-adi-course-gate="banner"]').forEach(renderBanner);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}(window));
