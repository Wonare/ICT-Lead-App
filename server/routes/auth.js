'use strict';

/**
 * Admin authentication routes.
 * POST /api/admin/auth/login - username + password -> JWT (rate limited)
 * GET  /api/admin/auth/me    - validates the current token
 */

const express = require('express');
const authController = require('../controllers/authController');
const { requireAdmin } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.post('/login', loginLimiter, authController.login);
router.post('/password', requireAdmin, loginLimiter, authController.changePassword);
router.get('/me', requireAdmin, authController.me);

module.exports = router;
