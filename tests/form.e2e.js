'use strict';

/* ==========================================================================
   End-to-end smoke test:  FORM (real page + real form.js in jsdom)
                           -> POST /api/leads -> MySQL
                           -> Admin API retrieval of every field.

   Requires the server to be running:  npm start
   Run with:                           npm run test:form
   ========================================================================== */

require('dotenv').config();
const { JSDOM, VirtualConsole } = require('jsdom');

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASS = process.env.ADMIN_DEFAULT_PASSWORD || 'Admin@12345';

const TEST_LEAD = {
  full_name: 'Chidinma Okoro',
  phone: '08098765432',
  email: 'chidinma.' + Date.now() + '.e2e@example.com',
  course: 'Cybersecurity',
  learning_mode: 'Online',
  communication_method: 'WhatsApp',
  referral_source: 'Other',
  referral_other: 'Tech meetup in Port Harcourt'
};

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log('  PASS  ' + name);
  } else {
    failed++;
    console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''));
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, timeoutMs = 8000, label = 'condition') {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const v = await fn();
      if (v) return v;
    } catch (e) { /* keep polling */ }
    await sleep(120);
  }
  throw new Error('Timed out waiting for: ' + label);
}

async function api(path, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });
  let json = null;
  try { json = await res.json(); } catch (e) { /* non-JSON */ }
  return { status: res.status, json };
}

async function main() {
  console.log('\n== ICT Lead Form E2E test (' + BASE + ') ==\n');

  /* ---------------------------------------------------------- 1. Load page */
  console.log('[1] Loading /form.html in a simulated browser...');
  const jsdomErrors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => {
    // jsdom's CSS parser chokes on some modern CSS - not a JS failure.
    if (!/Could not parse stylesheet/i.test(e.message)) jsdomErrors.push(e.message);
  });

  const dom = await JSDOM.fromURL(BASE + '/form.html', {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      // jsdom has no fetch/scroll - provide minimal shims used by form.js.
      window.fetch = (url, opts) => fetch(new URL(url, BASE), opts);
      window.scrollTo = () => {};
    }
  });
  const { window } = dom;
  const doc = window.document;

  ok('page title', /ICT Journey/.test(doc.title), doc.title);
  ok('heading "Start Your ICT Journey Today!" present',
    doc.querySelector('h1') && doc.querySelector('h1').textContent.trim() === 'Start Your ICT Journey Today!');
  ok('subtitle present', /Interested in learning practical ICT skills/.test(doc.body.textContent));
  ok('submit button says "Get Course Details"',
    doc.getElementById('submitLabel').textContent.trim() === 'Get Course Details');

  /* ------------------------------------------- 2. Courses loaded from DB */
  console.log('[2] Course dropdown loaded from the database...');
  await waitFor(() => {
    const opts = doc.querySelectorAll('#course option');
    return opts.length > 5 && doc.querySelector('#course option').textContent !== 'Loading courses\u2026';
  }, 8000, 'course options');
  const courseNames = Array.from(doc.querySelectorAll('#course option')).map((o) => o.value).filter(Boolean);
  ok('dropdown contains DB courses (>= 10)', courseNames.length >= 10, courseNames.length + ' options');
  ok('dropdown includes "Web Development"', courseNames.includes('Web Development'));
  ok('no leftover "Loading courses..." placeholder', !doc.getElementById('course').textContent.includes('Loading'));
  ok('form.js produced no jsdom errors so far', jsdomErrors.length === 0, jsdomErrors.join(' | '));

  /* ------------------------------------------------- 3. Empty submit test */
  console.log('[3] Submitting the empty form (frontend validation)...');
  const form = doc.getElementById('leadForm');
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await sleep(150);
  const visibleErrors = Array.from(doc.querySelectorAll('.error-msg.visible')).map((e) => e.textContent);
  ok('validation errors shown for all required fields', visibleErrors.length >= 7, visibleErrors.length + ' errors');
  ok('"Please enter your full name." shown', visibleErrors.includes('Please enter your full name.'));
  ok('"Please enter a valid phone number." or required-phone shown',
    visibleErrors.some((m) => /phone/i.test(m)));
  ok('general alert shown', !doc.getElementById('formAlert').hidden);
  ok('form NOT submitted (success card still hidden)', doc.getElementById('successCard').hidden);

  /* ------------------------------------------ 4. Invalid email/phone test */
  console.log('[4] Invalid email + phone values...');
  const set = (id, v) => { const el = doc.getElementById(id); el.value = v; el.dispatchEvent(new window.Event('input', { bubbles: true })); };
  set('fullName', 'Chidinma Okoro');
  set('phone', 'abc123');
  set('email', 'not-an-email');
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await sleep(150);
  ok('"Please enter a valid phone number." shown',
    doc.getElementById('err-phone').textContent === 'Please enter a valid phone number.');
  ok('"Please enter a valid email address." shown',
    doc.getElementById('err-email').textContent === 'Please enter a valid email address.');

  /* ------------------------------------------- 5. Referral Other toggle */
  console.log('[5] Referral "Other" dynamic field...');
  const refSel = doc.getElementById('referralSource');
  ok('"Please specify" field hidden initially', doc.getElementById('referralOtherField').hidden);
  refSel.value = 'Other';
  refSel.dispatchEvent(new window.Event('change', { bubbles: true }));
  ok('selecting Other reveals "Please specify"', !doc.getElementById('referralOtherField').hidden);
  const specLabel = doc.querySelector('label[for="referralOther"]').textContent;
  ok('label says "Please specify"', /Please specify/.test(specLabel), specLabel);

  /* ------------------------------------------------ 6. Fill & submit form */
  console.log('[6] Filling every field and submitting...');
  set('phone', TEST_LEAD.phone);
  set('email', TEST_LEAD.email);
  const courseSel = doc.getElementById('course');
  courseSel.value = TEST_LEAD.course;
  courseSel.dispatchEvent(new window.Event('change', { bubbles: true }));
  const onlineRadio = doc.querySelector('input[name="learning_mode"][value="Online"]');
  onlineRadio.checked = true;
  onlineRadio.dispatchEvent(new window.Event('change', { bubbles: true }));
  const commSel = doc.getElementById('communicationMethod');
  commSel.value = TEST_LEAD.communication_method;
  commSel.dispatchEvent(new window.Event('change', { bubbles: true }));
  set('referralOther', TEST_LEAD.referral_other);

  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  // handleSubmit runs synchronously up to the fetch -> check loading state immediately.
  const btn = doc.getElementById('submitBtn');
  ok('loading state active while submitting', btn.disabled && btn.classList.contains('loading') &&
    doc.getElementById('submitLabel').textContent === 'Submitting\u2026');

  await waitFor(() => !doc.getElementById('successCard').hidden, 8000, 'success card');
  ok('success card displayed', !doc.getElementById('successCard').hidden);
  ok('form card hidden after success', doc.getElementById('formCard').hidden);
  const successText = doc.getElementById('successCard').textContent.replace(/\s+/g, ' ');
  ok('success message text correct',
    /Thank you! 🎉 Your details have been received\. We[\u2019']ll contact you shortly with more information about your selected ICT course\./.test(successText),
    successText.slice(0, 120));
  ok('"Submit Another Response" button present', !!doc.getElementById('resetBtn'));

  /* --------------------------------------- 7. Admin API sees the new lead */
  console.log('[7] Admin API retrieval...');
  const login = await api('/api/admin/auth/login', { method: 'POST', body: { username: ADMIN_USER, password: ADMIN_PASS } });
  ok('admin login', login.status === 200 && login.json.success);
  const token = login.json.data.token;
  const auth = { headers: { Authorization: 'Bearer ' + token } };

  const list = await api('/api/admin/leads?search=' + encodeURIComponent(TEST_LEAD.email), auth);
  const match = list.json.data.leads.find((l) => l.email === TEST_LEAD.email);
  ok('lead found via admin list API', !!match);

  const detail = await api('/api/admin/leads/' + match.id, auth);
  const lead = detail.json.data.lead;
  ok('full name stored', lead.full_name === TEST_LEAD.full_name, lead.full_name);
  ok('phone stored', lead.phone === TEST_LEAD.phone, lead.phone);
  ok('email stored', lead.email === TEST_LEAD.email, lead.email);
  ok('course stored', lead.course === TEST_LEAD.course, lead.course);
  ok('learning mode stored', lead.learning_mode === TEST_LEAD.learning_mode, lead.learning_mode);
  ok('communication method stored', lead.communication_method === TEST_LEAD.communication_method);
  ok('referral source stored', lead.referral_source === TEST_LEAD.referral_source);
  ok('referral "other" stored', lead.referral_other === TEST_LEAD.referral_other, lead.referral_other);
  ok('status defaults to New', lead.status === 'New', lead.status);
  ok('created_at set automatically', !!lead.created_at);
  ok('updated_at set automatically', !!lead.updated_at);

  const stat = await api('/api/admin/leads/' + lead.id + '/status', { method: 'PATCH', headers: auth.headers, body: { status: 'Enrolled' } });
  ok('status change via admin API', stat.json.success && stat.json.data.lead.status === 'Enrolled');

  /* ------------------------------------------ 8. Submit another response */
  console.log('[8] "Submit Another Response" reset...');
  doc.getElementById('resetBtn').dispatchEvent(new window.Event('click', { bubbles: true }));
  await sleep(200);
  ok('form card visible again', !doc.getElementById('formCard').hidden);
  ok('success card hidden again', doc.getElementById('successCard').hidden);
  ok('form fields cleared', doc.getElementById('fullName').value === '' && doc.getElementById('email').value === '');
  ok('"Please specify" hidden again after reset', doc.getElementById('referralOtherField').hidden);
  ok('button re-enabled', !doc.getElementById('submitBtn').disabled);

  ok('no jsdom errors during the whole run', jsdomErrors.length === 0, jsdomErrors.join(' | '));

  /* ------------------------------------------------------- 9. Cleanup DB */
  console.log('[9] Cleaning up test leads...');
  const cleanup = await api('/api/admin/leads/' + lead.id, { method: 'DELETE', headers: auth.headers });
  ok('only this test lead removed', cleanup.status === 200);

  window.close();

  /* ----------------------------------------------------------- Summary */
  console.log('\n== Result: ' + passed + ' passed, ' + failed + ' failed ==\n');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('\nE2E TEST CRASHED:', err.message);
  process.exit(1);
});
