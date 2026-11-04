(function () {
  'use strict';

  /* ── Account definitions ─────────────────────────────────── */
  var ACCOUNTS = {
    primary: {
      number:  '237678305489',
      display: '+237 678 305 489',
      name:    'GLOBAL INVESTMENT CREDIT COOPERATIVE BOD',
      label:   'Tuition & Registration'
    },
    secondary: {
      number:  '237674225990',
      display: '+237 674 225 990',
      name:    'ADI University Finance Office',
      label:   'Other Fees'
    }
  };

  /* ── Keywords that route to the PRIMARY account ─────────── */
  var PRIMARY_KEYWORDS = [
    'tuition', 'scolarit', 'registration', 'inscription',
    'enrolment', 'enrollment', 'school fees', 'frais de scolarit',
    'frais scol', 'annual fee', 'frais annuel'
  ];

  /* ── Amounts that route to the PRIMARY account ───────────── */
  /* 200 000 XAF tuition OR 50 000 XAF registration             */
  var PRIMARY_AMOUNTS = [200000, 50000];

  /* ─────────────────────────────────────────────────────────── */

  function isPrimaryByText(text) {
    if (!text) return false;
    var lower = text.toLowerCase();
    return PRIMARY_KEYWORDS.some(function (kw) { return lower.indexOf(kw) !== -1; });
  }

  function isPrimaryByAmount(text) {
    if (!text) return false;
    /* Strip non-digits, parse as number */
    var num = parseInt(text.replace(/[^0-9]/g, ''), 10);
    return PRIMARY_AMOUNTS.indexOf(num) !== -1;
  }

  /* Collect every visible text string in/near the open modal */
  function gatherModalText() {
    var parts = [];

    /* 1. URL hash — e.g. #/fees-me?type=tuition */
    parts.push(window.location.hash);
    parts.push(window.location.search);

    /* 2. Common heading/label selectors (broad) */
    var selectors = [
      '.modal', '#fee-modal', '#pay-modal',
      '.pay-section', '.fee-pay-row', '.fee-detail',
      '.fee-name', '.fee-title', '.fee-label',
      '[data-fee-name]', '[data-fee-type]',
      '.modal h1', '.modal h2', '.modal h3', '.modal h4',
      '.modal .title', '.modal .subtitle',
      '.modal .description', '.modal .fee-description',
      /* Vue / React rendered wrappers */
      '[class*="fee"]', '[class*="Fee"]',
      '[class*="payment"]', '[class*="Payment"]',
      '[id*="fee"]', '[id*="Fee"]'
    ];
    selectors.forEach(function (sel) {
      try {
        document.querySelectorAll(sel).forEach(function (el) {
          parts.push(el.textContent || '');
        });
      } catch (e) {}
    });

    /* 3. Amount display — look for XAF figures */
    var amountEls = document.querySelectorAll(
      '.fee-amount, .amount, [class*="amount"], [class*="Amount"], ' +
      '.modal .price, .modal strong, .mf-head, [class*="header"]'
    );
    amountEls.forEach(function (el) { parts.push(el.textContent || ''); });

    /* 4. Page <title> and document body scan for fee keywords */
    parts.push(document.title);

    return parts.join(' ');
  }

  function resolveAccount() {
    var text = gatherModalText();

    /* Amount check first — 200 000 or 50 000 XAF → primary */
    if (isPrimaryByAmount(text)) return ACCOUNTS.primary;

    /* Keyword check */
    if (isPrimaryByText(text)) return ACCOUNTS.primary;

    /* Default → secondary */
    return ACCOUNTS.secondary;
  }

  /* ── Fill phone inputs ───────────────────────────────────── */
  function fillInputs(account) {
    var phoneInputs = document.querySelectorAll(
      'input[name="momoPhone"], input[id*="momoPhone"], ' +
      'input[name*="phone"], input[id*="phone"], ' +
      'input[placeholder*="phone"], input[placeholder*="Phone"], ' +
      'input[placeholder*="téléphone"], input[placeholder*="Téléphone"], ' +
      'input[data-field="momoPhone"], input[type="tel"]'
    );

    var filled = false;
    phoneInputs.forEach(function (inp) {
      /* Always overwrite — previous autofill may have been wrong */
      inp.value = account.number;
      inp.dataset.adiAutofilled = '1';
      inp.dispatchEvent(new Event('input',  { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      filled = true;
    });
    return filled;
  }

  /* ── Update instruction text ─────────────────────────────── */
  function updateInstructions(account) {
    var noteEls = document.querySelectorAll(
      '.momo-note, .payment-note, .note, [data-momo-note], ' +
      '.pay-instructions, #momo-instructions, ' +
      '[class*="instruction"], [class*="Instruction"], ' +
      '[class*="note"], [class*="Note"]'
    );
    var phoneRegex  = /\+?237\s?6\d{2}\s?\d{3}\s?\d{3}/g;
    var nameRegex   = /(GLOBAL INVESTMENT CREDIT COOPERATIVE BOD|ADI University Finance Office)/gi;

    noteEls.forEach(function (el) {
      var html    = el.innerHTML;
      var updated = html
        .replace(phoneRegex, account.display)
        .replace(nameRegex,  account.name);
      if (updated !== html) el.innerHTML = updated;
    });

    /* Bold/strong phone numbers anywhere in modal */
    document.querySelectorAll('.modal strong, .modal b, strong, b').forEach(function (el) {
      if (phoneRegex.test(el.textContent)) {
        el.textContent = account.display + ' (' + account.name + ')';
      }
      phoneRegex.lastIndex = 0; /* reset stateful regex */
    });
  }

  /* ── Master autofill entry point ─────────────────────────── */
  function autofill() {
    var account = resolveAccount();
    var filled  = fillInputs(account);
    updateInstructions(account);
    return filled;
  }

  /* ── Retry loop — keep trying until inputs appear ────────── */
  function autofillWithRetry(maxMs) {
    var start    = Date.now();
    var interval = 80;
    maxMs = maxMs || 2000;

    function attempt() {
      var filled = autofill();
      if (!filled && Date.now() - start < maxMs) {
        setTimeout(attempt, interval);
      }
    }
    attempt();
  }

  /* ── MutationObserver — watch for modal/payment DOM nodes ── */
  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        var node = added[j];
        if (node.nodeType !== 1) continue;
        try {
          if (
            node.matches('.modal, #fee-modal, #pay-modal, .pay-section, .fee-pay-row, [class*="modal"], [class*="Modal"]') ||
            node.querySelector('.modal, #fee-modal, #pay-modal, [class*="modal"]')
          ) {
            autofillWithRetry(2000);
            break;
          }
        } catch (e) {}
      }
    }
  });

  observer.observe(document.getElementById('app') || document.body, {
    childList: true, subtree: true
  });

  /* ── Hash / route change ─────────────────────────────────── */
  window.addEventListener('hashchange', function () {
    setTimeout(function () { autofillWithRetry(1500); }, 150);
  });

  /* ── Public API ──────────────────────────────────────────── */
  /**
   * window.adiPaymentAutofill(feeTypeOrName)
   *
   * Call with the fee name/type string when opening a payment modal:
   *   window.adiPaymentAutofill('tuition');
   *   window.adiPaymentAutofill('Library fee');
   *   window.adiPaymentAutofill();  // auto-detect from DOM
   */
  window.adiPaymentAutofill = function (feeType) {
    var account;
    if (feeType) {
      account = (isPrimaryByText(feeType) || isPrimaryByAmount(feeType))
        ? ACCOUNTS.primary
        : ACCOUNTS.secondary;
    } else {
      account = resolveAccount();
    }
    fillInputs(account);
    updateInstructions(account);
  };

  /* ── Initial run on page load ────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { autofillWithRetry(1500); });
  } else {
    autofillWithRetry(1500);
  }

})();
