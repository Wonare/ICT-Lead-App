'use strict';
// Run the real PostgreSQL schema, adapter and HTTP workflows against PGlite's
// embedded PostgreSQL engine. This does not connect to or mutate a cloud DB.
require('dotenv').config();
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { PGlite } = require('@electric-sql/pglite');
const pg = require('pg');
const db = new PGlite();
process.env.DB_DRIVER = 'postgres';
process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
process.env.PORT = '3101';
process.env.HOST = '127.0.0.1';
process.env.NODE_ENV = 'test';
process.env.TEST_BASE_URL = 'http://127.0.0.1:3101';

class TestPool {
  on() {}
  async query(sql, params) {
    let result;
    if (params) result = await db.query(sql, params);
    else result = (await db.exec(sql)).at(-1);
    return {rows: result?.rows || [], rowCount: result?.affectedRows || 0, command: sql.trim().split(/\s/)[0].toUpperCase()};
  }
  async connect() {return {query: this.query.bind(this), release() {}};}
  async end() {await db.close();}
}
pg.Pool = TestPool;
async function run(file) {
  const child = spawn(process.execPath, [file], {env:process.env,stdio:'inherit'});
  await new Promise((resolve,reject) => {child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(file + ' failed: ' + code)));});
}
async function main() {
  const adapter = require('../server/database/postgres');
  await adapter.initialize();
  await adapter.query('DELETE FROM courses WHERE course_name = ?', ['Other']);
  await adapter.initialize();
  assert.equal((await adapter.query('SELECT id FROM courses WHERE course_name = ?', ['Other']))[0].length,0);
  assert.equal((await adapter.query('SELECT id FROM admin_users'))[0].length,1);
  console.log('PASS repeatable PostgreSQL migrations; deleted courses stay deleted');
  require('../server/server');
  let ready = false;
  for (let i=0;i<100;i++) {
    try {if ((await fetch(process.env.TEST_BASE_URL+'/healthz')).ok) {ready=true;break;}} catch {}
    await new Promise(r=>setTimeout(r,50));
  }
  assert.ok(ready,'Test server started');
  await run('tests/form.e2e.js');
  await run('tests/admin.e2e.js');
  console.log('PASS PostgreSQL schema, adapter and end-to-end form/admin workflows');
  process.emit('SIGTERM');
}
main().catch(e=>{console.error(e);process.exit(1);});
