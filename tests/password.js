'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ict-password-'));
process.env.DB_DRIVER = 'sqlite';
process.env.SQLITE_PATH = path.join(temp, 'test.sqlite');
process.env.ADMIN_USERNAME = 'password-test';
process.env.ADMIN_DEFAULT_PASSWORD = 'Original-Test-Password-123';
const express = require('express');
const { pool } = require('../server/database/connection');
(async () => {
  await pool.initialize();
  const app = express(); app.use(express.json());
  app.use('/api/admin/auth', require('../server/routes/auth'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port + '/api/admin/auth';
  async function request(url, body, token) {
    const response = await fetch(base + url, {method: body ? 'POST' : 'GET', headers: {'Content-Type':'application/json', ...(token ? {Authorization: 'Bearer ' + token} : {})}, ...(body ? {body: JSON.stringify(body)} : {})});
    return { status: response.status, json: await response.json() };
  }
  const login = password => request('/login', {username: 'password-test', password});
  try {
    const oldPassword = process.env.ADMIN_DEFAULT_PASSWORD;
    const newPassword = 'Replacement-Test-Password-456';
    const token = (await login(oldPassword)).json.data.token;
    const body = {currentPassword: oldPassword, newPassword, confirmPassword: newPassword};
    assert.equal((await request('/password', body)).status, 401);
    assert.equal((await request('/password', {...body, currentPassword:'wrong'}, token)).status, 400);
    assert.equal((await request('/password', {...body, newPassword:'short', confirmPassword:'short'}, token)).status, 400);
    assert.equal((await request('/password', {...body, confirmPassword:'mismatch'}, token)).status, 400);
    assert.equal((await request('/password', {...body, newPassword:'💙'.repeat(20), confirmPassword:'💙'.repeat(20)}, token)).status, 400);
    assert.equal((await request('/password', body, token)).status, 200);
    assert.equal((await request('/me', undefined, token)).status, 401);
    assert.equal((await login(oldPassword)).status, 401);
    const fresh = await login(newPassword); assert.equal(fresh.status, 200);
    assert.equal((await request('/me', undefined, fresh.json.data.token)).status, 200);
    console.log('PASS password validation, authentication, password update, old-password rejection and session revocation');
    const {JSDOM} = require('jsdom');
    const dom = new JSDOM(fs.readFileSync(path.join(__dirname, '../admin/dashboard.html'),'utf8'), {runScripts:'outside-only'});
    const w = dom.window; let sent, loggedOut;
    w.AdminAPI = {post: async (url, body) => {sent=body;return {message:'changed'};}, forceLogout: message => {loggedOut=message;}};
    w.eval(fs.readFileSync(path.join(__dirname, '../admin/js/password.js'),'utf8'));
    w.document.getElementById('currentPassword').value=oldPassword;
    w.document.getElementById('newPassword').value=newPassword;
    w.document.getElementById('confirmPassword').value='mismatch';
    const submit=()=>w.document.getElementById('passwordForm').dispatchEvent(new w.Event('submit',{cancelable:true}));
    submit(); assert.equal(sent,undefined);
    w.document.getElementById('confirmPassword').value=newPassword;submit();
    await new Promise(r=>setTimeout(r,10));
    assert.deepEqual(JSON.parse(JSON.stringify(sent)),body);assert.equal(loggedOut,'changed');
    dom.window.close();console.log('PASS password form mismatch, submission and logout');
  } finally { await new Promise(resolve=>server.close(resolve)); await pool.end(); fs.rmSync(temp,{recursive:true,force:true}); }
})().catch(error=>{console.error(error);process.exitCode=1;});

