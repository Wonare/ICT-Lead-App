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
  port: toInt(process.env.PORT, 3000),

  db: {
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

module.exports = config;
