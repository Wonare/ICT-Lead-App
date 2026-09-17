'use strict';

// SQLite adapter preserves the mysql2 result shape used by the controllers.
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const config = require('../config');
let db;

async function initialize() {
  if (db) return;
  fs.mkdirSync(path.dirname(path.resolve(config.db.file)), { recursive: true });
  db = new DatabaseSync(config.db.file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Inactive')),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL,
      course TEXT NOT NULL, learning_mode TEXT NOT NULL,
      communication_method TEXT NOT NULL, referral_source TEXT NOT NULL,
      referral_other TEXT, status TEXT NOT NULL DEFAULT 'New', notes TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_leads_course ON leads(course);
    CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);
    CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_hash TEXT NOT NULL, full_name TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE IF NOT EXISTS app_migrations (name TEXT PRIMARY KEY);
  `);
  for (const table of ['leads', 'courses', 'admin_users']) {
    db.exec(`CREATE TRIGGER IF NOT EXISTS ${table}_updated AFTER UPDATE ON ${table}
      BEGIN UPDATE ${table} SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id; END;`);
  }
  // Seed once, so deliberately deleted courses stay deleted after restarting.
  if (!db.prepare('SELECT name FROM app_migrations WHERE name = ?').get('initial-courses')) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const insert = db.prepare('INSERT OR IGNORE INTO courses (course_name, description) VALUES (?, ?)');
      for (const course of require('./default-courses')) insert.run(...course);
      db.prepare('INSERT INTO app_migrations (name) VALUES (?)').run('initial-courses');
      db.exec('COMMIT');
    } catch (err) { db.exec('ROLLBACK'); throw err; }
  }
  if (!db.prepare('SELECT id FROM admin_users LIMIT 1').get()) {
    const hash = bcrypt.hashSync(config.admin.defaultPassword, 12);
    db.prepare('INSERT INTO admin_users (username, password_hash, full_name) VALUES (?, ?, ?)')
      .run(config.admin.username, hash, config.admin.fullName);
  }
}

async function query(sql, params = []) {
  if (!db) throw new Error('Database has not been initialized');
  // Only the two MySQL date expressions used by dashboard totals differ.
  sql = sql.replace(/CURDATE\(\)/g, "strftime('%Y-%m-%dT00:00:00.000Z','now')")
    .replace(/DATE_FORMAT\(NOW\(\), '%Y-%m-01'\)/g, "strftime('%Y-%m-01T00:00:00.000Z','now')")
    .replace(/LIKE \?/g, "LIKE ? ESCAPE '\\'");
  try {
    const statement = db.prepare(sql);
    if (/^\s*SELECT\b/i.test(sql)) return [statement.all(...params)];
    const result = statement.run(...params);
    return [{ affectedRows: Number(result.changes), insertId: Number(result.lastInsertRowid) }];
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) err.code = 'ER_DUP_ENTRY';
    throw err;
  }
}

module.exports = { initialize, query, execute: query, async end() { if (db) { db.close(); db = null; } } };
