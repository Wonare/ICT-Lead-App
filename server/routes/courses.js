'use strict';

/**
 * Public course route.
 * GET /api/courses - active courses only (feeds the form dropdown).
 * Admin course management lives under /api/admin/courses.
 */

const express = require('express');
const courseController = require('../controllers/courseController');
const { coursesLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.get('/', coursesLimiter, courseController.getActiveCourses);

module.exports = router;
