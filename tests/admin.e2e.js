'use strict';
require('dotenv').config();
const assert = require('node:assert/strict');
const { JSDOM, VirtualConsole } = require('jsdom');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
// Same fallbacks as form.e2e.js. Without these, process.env.ADMIN_DEFAULT_PASSWORD
// is undefined on a fresh clone (no .env), JSON.stringify drops the key, and the
// API answers 400 "Please enter your username and password" instead of a clear
// failure - which is a confusing way for the suite to break.
const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASS = process.env.ADMIN_DEFAULT_PASSWORD || 'Admin@12345';
let token, courseId, leadId;
async function request(path, method = 'GET', body, authenticated = true) {
  const res = await fetch(base + path, { method, headers: {
    'Content-Type': 'application/json',
    ...(authenticated && token ? { Authorization: 'Bearer ' + token } : {})
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: res.status, json: await res.json() };
}
async function waitFor(fn) {
  for (let i = 0; i < 600; i++) { if (fn()) return; await new Promise(r => setTimeout(r, 50)); }
  throw new Error('UI did not finish loading');
}
async function main() {
  assert.equal((await request('/api/admin/leads')).status, 401);
  assert.equal((await request('/api/admin/auth/login', 'POST', {username: 'admin', password: 'wrong'})).status, 401);
  const login = await request('/api/admin/auth/login', 'POST', {username: ADMIN_USER, password: ADMIN_PASS});
  assert.equal(login.status, 200, 'admin login failed - is ADMIN_DEFAULT_PASSWORD correct? response: ' + JSON.stringify(login.json));
  token = login.json.data.token;
  assert.equal((await request('/api/admin/auth/me')).status, 200);
  const name = 'Test Course ' + Date.now();
  let result = await request('/api/admin/courses', 'POST', {course_name: name, description: 'Workflow test'});
  assert.equal(result.status, 201); courseId = result.json.data.course.id;
  assert.equal((await request('/api/admin/courses', 'POST', {course_name: name})).status, 409);
  assert.ok((await request('/api/courses')).json.data.courses.some(c => c.id === courseId));
  const lead = {full_name: 'Workflow Tester', email: 'workflow.' + Date.now() + '@example.com', phone: '08012345678', course: name, learning_mode: 'Online', communication_method: 'Email', referral_source: 'Google'};
  result = await request('/api/leads', 'POST', lead, false);
  assert.equal(result.status, 201); leadId = result.json.data.id;
  result = await request('/api/admin/leads/' + leadId, 'PUT', {status: 'Contacted', notes: 'Follow up tomorrow'});
  assert.equal(result.json.data.lead.notes, 'Follow up tomorrow');
  assert.equal(result.json.data.lead.status, 'Contacted');
  assert.equal((await request('/api/admin/leads/' + leadId + '/status', 'PATCH', {status: 'invalid'})).status, 400);
  assert.equal((await request('/api/admin/leads?search=' + encodeURIComponent(lead.email))).json.data.pagination.total, 1);
  assert.equal((await request('/api/admin/leads?search=%25')).json.data.pagination.total, 0);
  const stats = await request('/api/admin/stats');
  assert.equal(stats.status, 200); assert.ok(stats.json.data.leads.total >= 1);
  assert.ok(stats.json.data.leads.today >= 1); assert.ok(stats.json.data.leads.this_month >= 1);
  await request('/api/admin/courses/' + courseId + '/status', 'PATCH', {status: 'Inactive'});
  assert.ok(!(await request('/api/courses')).json.data.courses.some(c => c.id === courseId));
  assert.equal((await request('/api/leads', 'POST', lead, false)).status, 400);
  assert.equal((await request('/api/admin/courses/' + courseId, 'PUT', {course_name: name + ' Updated'})).status, 200);
  console.log('PASS authentication, validation, course CRUD, lead updates, filtering, dashboard totals');
  for (const page of ['dashboard', 'leads', 'courses']) {
    const errors = [];
    const vc = new VirtualConsole();
    vc.on('jsdomError', e => { if (!/Could not parse stylesheet/.test(e.message)) errors.push(e.message); });
    const dom = await JSDOM.fromURL(base + '/admin/' + page + '.html', {
      resources: 'usable', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
      beforeParse(w) {
        w.pendingRequests = 0; w.lastRequest = Date.now();
        w.fetch = async (url, opts) => {
          w.pendingRequests++; w.lastRequest = Date.now();
          try { return await fetch(new URL(url, base), opts); }
          finally { w.pendingRequests--; w.lastRequest = Date.now(); }
        };
        w.localStorage.setItem('ict_admin_token', token);
      }
    });
    try {
      await waitFor(() => dom.window.document.readyState === 'complete');
      if (page === 'leads') {
        await waitFor(() => dom.window.document.getElementById('leadsBody').textContent.includes('Workflow Tester'));
        dom.window.document.querySelector('button[aria-label="View lead Workflow Tester"]').click();
        await waitFor(() => dom.window.document.getElementById('leadDetail').textContent.includes(lead.email));
        dom.window.document.getElementById('editNotes').value = 'Saved from admin UI';
        dom.window.document.getElementById('saveLeadBtn').click();
        await waitFor(() => !dom.window.document.getElementById('saveLeadBtn').disabled);
        assert.equal((await request('/api/admin/leads/' + leadId)).json.data.lead.notes, 'Saved from admin UI');
        await waitFor(() => dom.window.document.getElementById('leadsBody').textContent.includes('Workflow Tester'));
      } else {
        await waitFor(() => dom.window.pendingRequests === 0 && Date.now() - dom.window.lastRequest > 500);
      }
      assert.deepEqual(errors, []);
      console.log('PASS admin ' + page + ' page scripts' + (page === 'leads' ? ', detail and save controls' : ''));
    } finally {
      await waitFor(() => dom.window.pendingRequests === 0 && Date.now() - dom.window.lastRequest > 500);
      dom.window.close();
    }
  }
}
main().catch(e => {console.error(e); process.exitCode = 1;}).finally(async () => {
  if (leadId) assert.equal((await request('/api/admin/leads/' + leadId, 'DELETE')).status, 200);
  if (courseId) assert.equal((await request('/api/admin/courses/' + courseId, 'DELETE')).status, 200);
});
