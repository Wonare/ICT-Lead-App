'use strict';

/**
 * JWT authentication guard for every /api/admin/* route (except login).
 * The token is sent as:  Authorization: Bearer <token>
 */

const { createHmac } = require('node:crypto');
const { pool } = require('../database/connection');
const jwt = require('jsonwebtoken');
const config = require('../config');

async function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in.'
    });
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret);
    const [rows] = await pool.query('SELECT password_hash FROM admin_users WHERE id = ?', [payload.sub]);
    if (!rows[0] || payload.pv !== passwordVersion(rows[0].password_hash)) {
      return res.status(401).json({ success: false, message: 'Please log in again. Your session is no longer valid.' });
    }
    req.admin = { id: payload.sub, username: payload.username };
    return next();
  } catch (err) {
    if (!['TokenExpiredError', 'JsonWebTokenError', 'NotBeforeError'].includes(err.name)) return next(err);
    const expired = err.name === 'TokenExpiredError';
    return res.status(401).json({
      success: false,
      message: expired
        ? 'Your session has expired. Please log in again.'
        : 'Invalid authentication token. Please log in again.'
    });
  }
}

function passwordVersion(hash) {
  return createHmac('sha256', config.jwt.secret).update(hash).digest('hex');
}
module.exports = { requireAdmin, passwordVersion };
