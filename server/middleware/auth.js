'use strict';

/**
 * JWT authentication guard for every /api/admin/* route (except login).
 * The token is sent as:  Authorization: Bearer <token>
 */

const jwt = require('jsonwebtoken');
const config = require('../config');

function requireAdmin(req, res, next) {
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
    req.admin = { id: payload.sub, username: payload.username };
    return next();
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    return res.status(401).json({
      success: false,
      message: expired
        ? 'Your session has expired. Please log in again.'
        : 'Invalid authentication token. Please log in again.'
    });
  }
}

module.exports = { requireAdmin };
