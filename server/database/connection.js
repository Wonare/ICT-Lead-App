'use strict';

/**
 * MySQL connection pool (mysql2/promise).
 * All queries in this project go through this pool using
 * parameterized placeholders (?) - never string concatenation.
 */

const mysql = require('mysql2/promise');
const config = require('../config');

const pool = config.db.driver === 'sqlite' ? require('./sqlite') : config.db.driver === 'postgres' ? require('./postgres') : mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4_unicode_ci'
});

/** Verifies connectivity - used at server startup. */
async function testConnection() {
  if (config.db.driver === 'sqlite') return pool.initialize();
  if (config.db.driver === 'postgres') return pool.testConnection();
  const connection = await pool.getConnection();
  try {
    await connection.ping();
  } finally {
    connection.release();
  }
}

module.exports = { pool, testConnection };
