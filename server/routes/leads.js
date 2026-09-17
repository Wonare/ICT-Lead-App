'use strict';

/**
 * Public lead route.
 * POST /api/leads  - receives the form submission (rate limited).
 */

const express = require('express');
const leadController = require('../controllers/leadController');
const { leadSubmitLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.post('/', leadSubmitLimiter, leadController.createLead);

module.exports = router;
