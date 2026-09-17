'use strict';
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const config = require('../config');
const { translateQuery } = require('./postgres-query');

const connectionUrl = new URL(config.db.url);
if (connectionUrl.hostname.endsWith('.neon.tech')) connectionUrl.searchParams.set('sslmode', 'verify-full');

const pool = new Pool({
  connectionString: connectionUrl.toString(),
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 15000
});
pool.on('error', err => console.error('[DATABASE] Idle connection error:', err.code || 'connection closed'));

async function query(sql, params = []) {
  try {
    const result = await pool.query(translateQuery(sql), params);
    if (result.command === 'SELECT') return [result.rows];
    return [{ affectedRows: result.rowCount, insertId: result.rows[0]?.id }];
  } catch (err) {
    if (err.code === '23505') err.code = 'ER_DUP_ENTRY';
    throw err;
  }
}

async function initialize() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialize startup migrations if two deploys briefly overlap.
    await client.query('SELECT pg_advisory_xact_lock(92817364)');
    await client.query(fs.readFileSync(path.join(__dirname, 'schema.postgres.sql'), 'utf8'));
    const seeded = await client.query('SELECT name FROM app_migrations WHERE name = $1', ['initial-courses']);
    if (!seeded.rows.length) {
      for (const [name, description] of require('./default-courses')) {
        await client.query('INSERT INTO courses (course_name, description) VALUES ($1, $2) ON CONFLICT DO NOTHING', [name, description]);
      }
      await client.query('INSERT INTO app_migrations (name) VALUES ($1)', ['initial-courses']);
    }
    const admin = await client.query('SELECT id FROM admin_users LIMIT 1');
    if (!admin.rows.length) {
      const hash = await bcrypt.hash(config.admin.defaultPassword, 12);
      await client.query('INSERT INTO admin_users (username, password_hash, full_name) VALUES ($1, $2, $3)',
        [config.admin.username, hash, config.admin.fullName]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally { client.release(); }
}

module.exports = {
  query, execute: query, initialize,
  testConnection: () => pool.query('SELECT 1'),
  end: () => pool.end()
};
