'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ict-storage-'));
const env = { ...process.env, DB_DRIVER: 'sqlite', SQLITE_PATH: path.join(temp,'test.sqlite') };
function run(code) {
  const result = spawnSync(process.execPath, ['-e', code], {cwd: path.join(__dirname,'..'),env,encoding:'utf8'});
  assert.equal(result.status, 0, result.stderr + result.stdout);
}
try {
  run(`const db = require('./server/database/sqlite'); (async () => {
    await db.initialize();
    await db.query('INSERT INTO courses (course_name) VALUES (?)', ['Persistence Test']);
    await db.query('DELETE FROM courses WHERE course_name = ?', ['Other']);
    await db.query('INSERT INTO leads (full_name, phone, email, course, learning_mode, communication_method, referral_source) VALUES (?, ?, ?, ?, ?, ?, ?)', ['Saved Person','08012345678','saved@example.com','Persistence Test','Online','Email','Google']);
    await db.end();
  })().catch(e => { console.error(e); process.exit(1); });`);
  run(`const assert = require('node:assert/strict'); const db = require('./server/database/sqlite'); (async () => {
    await db.initialize();
    assert.equal((await db.query('SELECT * FROM courses WHERE course_name = ?', ['Persistence Test']))[0].length,1);
    assert.equal((await db.query('SELECT * FROM courses WHERE course_name = ?', ['Other']))[0].length,0);
    assert.equal((await db.query('SELECT * FROM leads WHERE email = ?', ['saved@example.com']))[0].length,1);
    assert.equal((await db.query('SELECT * FROM admin_users'))[0].length,1);
    await require('./server/controllers/leadController').getStats({}, {json(body) {
      assert.equal(body.data.leads.total,1);
      assert.equal(body.data.leads.today,1);
      assert.equal(body.data.leads.this_month,1);
      assert.equal(body.data.courses.active,11);
    }}, error => {throw error;});
    await db.end();
  })().catch(e => { console.error(e); process.exit(1); });`);
  console.log('PASS leads, course changes and admin account persist across separate process restarts');
} finally {
  fs.rmSync(temp, {recursive: true, force: true});
}
