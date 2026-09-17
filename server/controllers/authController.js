'use strict';

/**
 * Admin authentication controller.
 * Passwords are stored as bcrypt hashes and compared with bcrypt -
 * plain passwords are never stored or logged.
 */

const { passwordVersion } = require('../middleware/auth');
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
      { sub: user.id, username: user.username, pv: passwordVersion(user.password_hash) },
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

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body || {};
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' ||
        newPassword.length < 12 || Buffer.byteLength(newPassword, 'utf8') > 72 || newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Use at least 12 characters (up to 72 bytes) and make sure the new passwords match.' });
    }
    const [rows] = await pool.query('SELECT password_hash FROM admin_users WHERE id = ?', [req.admin.id]);
    const user = rows[0];
    if (!user || !await bcrypt.compare(currentPassword, user.password_hash)) {
      return res.status(400).json({ success: false, message: 'Your current password is incorrect.' });
    }
    if (currentPassword === newPassword) return res.status(400).json({ success: false, message: 'Choose a different new password.' });
    const hash = await bcrypt.hash(newPassword, 12);
    const [result] = await pool.query('UPDATE admin_users SET password_hash = ? WHERE id = ? AND password_hash = ?', [hash, req.admin.id, user.password_hash]);
    if (!result.affectedRows) return res.status(409).json({ success: false, message: 'Your password changed in another session. Please log in again.' });
    return res.json({ success: true, message: 'Password changed. Please log in with your new password.' });
  } catch (err) { return next(err); }
}

module.exports = { login, me, changePassword };
