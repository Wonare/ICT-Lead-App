'use strict';

/**
 * Database setup script.
 *
 *   npm run setup
 *
 * 1. Creates all tables from schema.sql (safe to re-run).
 * 2. Seeds the default ICT courses (INSERT IGNORE - never duplicates).
 * 3. Creates the default admin user (only when no admin exists yet).
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();
if (process.env.DB_DRIVER === 'postgres' && process.env.DATABASE_URL_UNPOOLED) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED;
}
const config = require('../config');

const DEFAULT_COURSES = require('./default-courses');

async function main() {
  if (config.db.driver === 'sqlite' || config.db.driver === 'postgres') {
    const db = require('./' + config.db.driver);
    await db.initialize();
    await db.end();
    console.log('Database ready. Start with npm start.');
    return;
  }
  console.log('--------------------------------------------------');
  console.log(' ICT Lead Form - Database Setup');
  console.log('--------------------------------------------------');
  console.log(`Connecting to MySQL at ${config.db.host}:${config.db.port} as "${config.db.user}"...`);

  // multipleStatements is required to execute schema.sql in one go.
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    multipleStatements: true,
    charset: 'utf8mb4_unicode_ci'
  });

  try {
    // 1. Tables ----------------------------------------------------------------
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await connection.query(schema);
    console.log('[OK] Tables ready: leads, courses, admin_users');

    // 2. Default courses ---------------------------------------------------------
    for (const [name, description] of DEFAULT_COURSES) {
      await connection.query(
        'INSERT IGNORE INTO courses (course_name, description, status) VALUES (?, ?, ?)',
        [name, description, 'Active']
      );
    }
    const [[courseCount]] = await connection.query('SELECT COUNT(*) AS n FROM courses');
    console.log(`[OK] Courses in database: ${courseCount.n}`);

    // 3. Default admin -----------------------------------------------------------
    const [[adminCount]] = await connection.query('SELECT COUNT(*) AS n FROM admin_users');
    if (adminCount.n === 0) {
      const hash = await bcrypt.hash(config.admin.defaultPassword, 12);
      await connection.query(
        'INSERT INTO admin_users (username, password_hash, full_name) VALUES (?, ?, ?)',
        [config.admin.username, hash, config.admin.fullName]
      );
      console.log('[OK] Default admin account created.');
      console.log(`     Username: ${config.admin.username}`);

      console.log('     >> Change this password before going live! <<');
    } else {
      console.log(`[OK] Admin account(s) already exist (${adminCount.n}) - left untouched.`);
    }

    console.log('--------------------------------------------------');
    console.log(' Setup complete. Start the server with: npm start');
    console.log('--------------------------------------------------');
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('\n[SETUP FAILED]');
  if (err.code === 'ECONNREFUSED') {
    console.error('Could not connect to MySQL. Is the server running? Check DB_HOST/DB_PORT in .env.');
  } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
    console.error('MySQL rejected the credentials. Check DB_USER/DB_PASSWORD in .env.');
  } else if (err.code === 'ER_BAD_DB_ERROR') {
    console.error(`Database "${config.db.database}" does not exist. Create it first:`);
    console.error(`  CREATE DATABASE ${config.db.database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  } else {
    console.error(err.message);
  }
  process.exit(1);
});

