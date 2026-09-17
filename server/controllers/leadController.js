'use strict';

/**
 * Lead controller.
 *  - createLead       -> POST   /api/leads              (public, rate limited)
 *  - getLeads         -> GET    /api/admin/leads        (admin)
 *  - getLeadById      -> GET    /api/admin/leads/:id    (admin)
 *  - updateLead       -> PUT    /api/admin/leads/:id    (admin)
 *  - updateStatus     -> PATCH  /api/admin/leads/:id/status (admin)
 *  - deleteLead       -> DELETE /api/admin/leads/:id    (admin)
 *  - getStats         -> GET    /api/admin/stats        (admin dashboard)
 *
 * Every query is parameterized. Column names used in dynamic UPDATEs
 * come exclusively from the whitelisted validator output.
 */

const { pool } = require('../database/connection');
const { validateLeadPayload, parseId, LEAD_STATUSES } = require('../middleware/validate');

const LEAD_COLUMNS =
  'id, full_name, phone, email, course, learning_mode, communication_method, ' +
  'referral_source, referral_other, status, notes, created_at, updated_at';

/** Fields an admin may modify through PUT /api/admin/leads/:id. */
const UPDATABLE_LEAD_FIELDS = [
  'full_name',
  'phone',
  'email',
  'course',
  'learning_mode',
  'communication_method',
  'referral_source',
  'referral_other',
  'status',
  'notes'
];

function likeEscape(value) {
  return value.replace(/[%_\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// PUBLIC: submit the lead form
// ---------------------------------------------------------------------------
async function createLead(req, res, next) {
  try {
    const { errors, data } = validateLeadPayload(req.body);
    if (errors.length) {
      return res.status(400).json({
        success: false,
        message: 'Please fix the errors below.',
        errors
      });
    }

    // The selected course must exist and be active in the database
    // (courses are managed from the admin panel).
    const [courses] = await pool.query(
      "SELECT course_name FROM courses WHERE status = 'Active'"
    );
    const activeNames = courses.map((c) => c.course_name);
    if (!activeNames.includes(data.course)) {
      return res.status(400).json({
        success: false,
        message: 'Please fix the errors below.',
        errors: [
          { field: 'course', message: 'The selected course is no longer available. Please choose another ICT course.' }
        ]
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO leads
         (full_name, phone, email, course, learning_mode, communication_method, referral_source, referral_other)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.full_name,
        data.phone,
        data.email,
        data.course,
        data.learning_mode,
        data.communication_method,
        data.referral_source,
        data.referral_other
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Lead submitted successfully',
      data: { id: result.insertId }
    });
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// ADMIN: list leads (search / status / course filters + pagination)
// ---------------------------------------------------------------------------
async function getLeads(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;

    const where = [];
    const params = [];

    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (search) {
      const like = `%${likeEscape(search)}%`;
      where.push('(full_name LIKE ? OR email LIKE ? OR phone LIKE ?)');
      params.push(like, like, like);
    }

    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    if (status) {
      if (!LEAD_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status filter.' });
      }
      where.push('status = ?');
      params.push(status);
    }

    const course = typeof req.query.course === 'string' ? req.query.course.trim() : '';
    if (course) {
      where.push('course = ?');
      params.push(course);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM leads ${whereSql}`,
      params
    );
    const total = Number(countRows[0].total);

    const [leads] = await pool.query(
      `SELECT ${LEAD_COLUMNS} FROM leads ${whereSql}
       ORDER BY created_at DESC, id DESC
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      params
    );

    return res.json({
      success: true,
      data: {
        leads,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit))
        }
      }
    });
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// ADMIN: single lead
// ---------------------------------------------------------------------------
async function getLeadById(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid lead ID.' });

    const [rows] = await pool.query(
      `SELECT ${LEAD_COLUMNS} FROM leads WHERE id = ?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Lead not found.' });

    return res.json({ success: true, data: { lead: rows[0] } });
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// ADMIN: update a lead (partial update with whitelisted, validated fields)
// ---------------------------------------------------------------------------
async function updateLead(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid lead ID.' });

    const { errors, data } = validateLeadPayload(req.body, { partial: true });
    if (errors.length) {
      return res.status(400).json({ success: false, message: 'Please fix the errors below.', errors });
    }

    const fields = UPDATABLE_LEAD_FIELDS.filter((f) => Object.prototype.hasOwnProperty.call(data, f));
    if (!fields.length) {
      return res.status(400).json({ success: false, message: 'No valid fields to update.' });
    }

    // If the course is being changed it must exist in the courses table.
    if (data.course) {
      const [rows] = await pool.query('SELECT id FROM courses WHERE course_name = ?', [data.course]);
      if (!rows.length) {
        return res.status(400).json({
          success: false,
          message: 'Please fix the errors below.',
          errors: [{ field: 'course', message: 'The selected course does not exist.' }]
        });
      }
    }

    const setSql = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) => data[f]);

    const [result] = await pool.query(`UPDATE leads SET ${setSql} WHERE id = ?`, [...values, id]);
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    const [rows] = await pool.query(`SELECT ${LEAD_COLUMNS} FROM leads WHERE id = ?`, [id]);
    return res.json({ success: true, message: 'Lead updated successfully.', data: { lead: rows[0] } });
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// ADMIN: change lead status only
// ---------------------------------------------------------------------------
async function updateLeadStatus(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid lead ID.' });

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const status = typeof body.status === 'string' ? body.status.trim() : '';
    if (!LEAD_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Please choose a valid lead status.',
        errors: [{ field: 'status', message: `Status must be one of: ${LEAD_STATUSES.join(', ')}.` }]
      });
    }

    const [result] = await pool.query('UPDATE leads SET status = ? WHERE id = ?', [status, id]);
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    const [rows] = await pool.query(`SELECT ${LEAD_COLUMNS} FROM leads WHERE id = ?`, [id]);
    return res.json({ success: true, message: 'Lead status updated.', data: { lead: rows[0] } });
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// ADMIN: delete a lead
// ---------------------------------------------------------------------------
async function deleteLead(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid lead ID.' });

    const [result] = await pool.query('DELETE FROM leads WHERE id = ?', [id]);
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    return res.json({ success: true, message: 'Lead deleted successfully.' });
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// ADMIN: dashboard statistics
// ---------------------------------------------------------------------------
async function getStats(req, res, next) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7) + '-01';
    const [[totals]] = await pool.query(`
      SELECT
        COUNT(*)                                            AS total,
        COALESCE(SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END), 0)           AS today,
        COALESCE(SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END), 0) AS this_month
      FROM leads`, [today, month]);

    const [statusRows] = await pool.query(
      'SELECT status, COUNT(*) AS count FROM leads GROUP BY status'
    );
    const byStatus = { New: 0, Contacted: 0, Enrolled: 0, 'Not Interested': 0, Closed: 0 };
    for (const row of statusRows) byStatus[row.status] = Number(row.count);

    const [byCourse] = await pool.query(
      'SELECT course, COUNT(*) AS count FROM leads GROUP BY course ORDER BY count DESC, course ASC LIMIT 12'
    );
    const [bySource] = await pool.query(
      'SELECT referral_source, COUNT(*) AS count FROM leads GROUP BY referral_source ORDER BY count DESC'
    );
    const [byMode] = await pool.query(
      'SELECT learning_mode, COUNT(*) AS count FROM leads GROUP BY learning_mode ORDER BY count DESC'
    );
    const [recent] = await pool.query(
      `SELECT id, full_name, email, course, status, created_at
       FROM leads ORDER BY created_at DESC, id DESC LIMIT 6`
    );
    const [[courseTotals]] = await pool.query(`
      SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END), 0) AS active FROM courses`);

    return res.json({
      success: true,
      data: {
        leads: {
          total: Number(totals.total),
          today: Number(totals.today),
          this_month: Number(totals.this_month),
          by_status: byStatus
        },
        courses: {
          total: Number(courseTotals.total),
          active: Number(courseTotals.active)
        },
        by_course: byCourse.map((r) => ({ course: r.course, count: Number(r.count) })),
        by_source: bySource.map((r) => ({ referral_source: r.referral_source, count: Number(r.count) })),
        by_mode: byMode.map((r) => ({ learning_mode: r.learning_mode, count: Number(r.count) })),
        recent
      }
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createLead,
  getLeads,
  getLeadById,
  updateLead,
  updateLeadStatus,
  deleteLead,
  getStats
};
