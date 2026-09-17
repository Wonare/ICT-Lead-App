'use strict';

/**
 * Admin course management routes - ALL protected by requireAdmin (JWT).
 *
 * GET    /api/admin/courses
 * POST   /api/admin/courses
 * PUT    /api/admin/courses/:id
 * PATCH  /api/admin/courses/:id/status
 * DELETE /api/admin/courses/:id
 */

const express = require('express');
const courseController = require('../controllers/courseController');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAdmin);

router.get('/', courseController.getAllCourses);
router.post('/', courseController.createCourse);
router.put('/:id', courseController.updateCourse);
router.patch('/:id/status', courseController.setCourseStatus);
router.delete('/:id', courseController.deleteCourse);

module.exports = router;
