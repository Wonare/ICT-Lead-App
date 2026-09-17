'use strict';

/**
 * Admin authentication controller.
 * Passwords are stored as bcrypt hashes and compared with bcrypt -
 * plain passwords are never stored or logged.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { pool } = require('../database/connection');
const { clean } = require('../middleware/validate');

async function login(req, res, next) {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const username = clean(body.username);
    const password = typeof body.password === 'string' ? body.password : '';

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please enter your username and password.'
      });
    }

    const [rows] = await pool.query(
      'SELECT id, username, password_hash, full_name FROM admin_users WHERE username = ? LIMIT 1',
      [username]
    );
    const user = rows[0];

    // Same generic message for unknown user and wrong password
    // so the endpoint cannot be used to enumerate usernames.
    const passwordOk = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!user || !passwordOk) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    const token = jwt.sign(
      { sub: user.id, username: user.username },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    return res.json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        admin: { username: user.username, full_name: user.full_name }
      }
    });
  } catch (err) {
    return next(err);
  }
}

/** Returns the currently authenticated admin (used to validate a stored token). */
async function me(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT id, username, full_name FROM admin_users WHERE id = ? LIMIT 1',
      [req.admin.id]
    );
    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Account no longer exists. Please log in again.' });
    }
    return res.json({ success: true, data: { admin: rows[0] } });
  } catch (err) {
    return next(err);
  }
}

module.exports = { login, me };
