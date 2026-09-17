'use strict';

/**
 * Admin dashboard route - protected by requireAdmin (JWT).
 * GET /api/admin/stats
 */

const express = require('express');
const leadController = require('../controllers/leadController');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAdmin);

router.get('/stats', leadController.getStats);

module.exports = router;
