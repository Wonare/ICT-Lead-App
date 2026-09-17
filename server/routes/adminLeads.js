'use strict';

/**
 * Admin lead management routes - ALL protected by requireAdmin (JWT).
 *
 * GET    /api/admin/leads
 * GET    /api/admin/leads/:id
 * PUT    /api/admin/leads/:id
 * PATCH  /api/admin/leads/:id/status
 * DELETE /api/admin/leads/:id
 */

const express = require('express');
const leadController = require('../controllers/leadController');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAdmin);

router.get('/', leadController.getLeads);
router.get('/:id', leadController.getLeadById);
router.put('/:id', leadController.updateLead);
router.patch('/:id/status', leadController.updateLeadStatus);
router.delete('/:id', leadController.deleteLead);

module.exports = router;
