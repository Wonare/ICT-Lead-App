'use strict';

/**
 * Central application configuration.
 * Everything sensitive comes from environment variables (.env) -
 * credentials are NEVER hard-coded or exposed to the frontend.
 */

require('dotenv').config();

const toInt = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

const config = {
  env: process.env.NODE_ENV || 'development',
  host: process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'),
  port: toInt(process.env.PORT, 3000),

  db: {
    driver: process.env.DB_DRIVER || (process.env.DATABASE_URL ? 'postgres' : 'sqlite'),
    url: process.env.DATABASE_URL,
    file: process.env.SQLITE_PATH || require('path').join(__dirname, '..', 'data', 'ict-leads.sqlite'),
    host: process.env.DB_HOST || '127.0.0.1',
    port: toInt(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ict_leads'
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h'
  },

  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    fullName: process.env.ADMIN_FULL_NAME || 'Administrator',
    defaultPassword: process.env.ADMIN_DEFAULT_PASSWORD || 'Admin@12345'
  },

  rateLimit: {
    leads: toInt(process.env.LEAD_RATE_LIMIT, 30),
    login: toInt(process.env.LOGIN_RATE_LIMIT, 20)
  }
};

if (!['sqlite', 'mysql', 'postgres'].includes(config.db.driver)) {
  throw new Error('DB_DRIVER must be sqlite, mysql or postgres.');
}
if (config.db.driver === 'postgres' && !config.db.url) {
  throw new Error('DATABASE_URL is required for PostgreSQL.');
}
if (config.env === 'production') {
  if (config.jwt.secret.length < 32 || /^(dev-only-|replace-with-)/.test(config.jwt.secret)) {
    throw new Error('Set JWT_SECRET to a random secret of at least 32 characters.');
  }
  if (!process.env.ADMIN_DEFAULT_PASSWORD || config.admin.defaultPassword.length < 12 || config.admin.defaultPassword === 'Admin@12345') {
    throw new Error('Set ADMIN_DEFAULT_PASSWORD to a unique password of at least 12 characters.');
  }
  if (process.env.RENDER && config.db.driver === 'sqlite') {
    throw new Error('Render requires an external database. Set DB_DRIVER=postgres and DATABASE_URL.');
  }
}
module.exports = config;
