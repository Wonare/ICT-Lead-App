'use strict';

/**
 * Course controller.
 *  - getActiveCourses -> GET    /api/courses              (public: form dropdown)
 *  - getAllCourses    -> GET    /api/admin/courses        (admin)
 *  - createCourse     -> POST   /api/admin/courses        (admin)
 *  - updateCourse     -> PUT    /api/admin/courses/:id    (admin)
 *  - setCourseStatus  -> PATCH  /api/admin/courses/:id/status (admin)
 *  - deleteCourse     -> DELETE /api/admin/courses/:id    (admin)
 *
 * Only ACTIVE courses are returned to the public form, so the admin
 * controls the dropdown without touching any HTML.
 */

const { pool } = require('../database/connection');
const { validateCoursePayload, parseId, COURSE_STATUSES } = require('../middleware/validate');

const COURSE_COLUMNS = 'id, course_name, description, status, created_at, updated_at';
const UPDATABLE_COURSE_FIELDS = ['course_name', 'description', 'status'];

// ---------------------------------------------------------------------------
// PUBLIC: active courses for the form dropdown
// ---------------------------------------------------------------------------
async function getActiveCourses(req, res, next) {
  try {
    const [courses] = await pool.query(
      "SELECT id, course_name FROM courses WHERE status = 'Active' ORDER BY course_name ASC"
    );
    return res.json({ success: true, data: { courses } });
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// ADMIN: all courses (any status)
// ---------------------------------------------------------------------------
async function getAllCourses(req, res, next) {
  try {
    const [courses] = await pool.query(
      `SELECT ${COURSE_COLUMNS} FROM courses ORDER BY course_name ASC`
    );
    return res.json({ success: true, data: { courses } });
  } catch (err) {
    return next(err);
  }
}

async function fetchCourseById(id) {
  const [rows] = await pool.query(`SELECT ${COURSE_COLUMNS} FROM courses WHERE id = ?`, [id]);
  return rows[0] || null;
}

// ---------------------------------------------------------------------------
// ADMIN: create course
// ---------------------------------------------------------------------------
async function createCourse(req, res, next) {
  try {
    const { errors, data } = validateCoursePayload(req.body);
    if (errors.length) {
      return res.status(400).json({ success: false, message: 'Please fix the errors below.', errors });
    }

    try {
      const [result] = await pool.execute(
        'INSERT INTO courses (course_name, description, status) VALUES (?, ?, ?)',
        [data.course_name, data.description, data.status]
      );
      const course = await fetchCourseById(result.insertId);
      return res.status(201).json({ success: true, message: 'Course created successfully.', data: { course } });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          message: 'A course with that name already exists.',
          errors: [{ field: 'course_name', message: 'A course with that name already exists.' }]
        });
      }
      throw err;
    }
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// ADMIN: update course
// ---------------------------------------------------------------------------
async function updateCourse(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid course ID.' });

    const { errors, data } = validateCoursePayload(req.body, { partial: true });
    if (errors.length) {
      return res.status(400).json({ success: false, message: 'Please fix the errors below.', errors });
    }

    const fields = UPDATABLE_COURSE_FIELDS.filter((f) => Object.prototype.hasOwnProperty.call(data, f));
    if (!fields.length) {
      return res.status(400).json({ success: false, message: 'No valid fields to update.' });
    }

    const setSql = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) => data[f]);

    try {
      const [result] = await pool.query(`UPDATE courses SET ${setSql} WHERE id = ?`, [...values, id]);
      if (!result.affectedRows) {
        const existing = await fetchCourseById(id);
        if (!existing) return res.status(404).json({ success: false, message: 'Course not found.' });
      }
      const course = await fetchCourseById(id);
      return res.json({ success: true, message: 'Course updated successfully.', data: { course } });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          message: 'Another course with that name already exists.',
          errors: [{ field: 'course_name', message: 'Another course with that name already exists.' }]
        });
      }
      throw err;
    }
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// ADMIN: activate / deactivate a course
// ---------------------------------------------------------------------------
async function setCourseStatus(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid course ID.' });

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const status = typeof body.status === 'string' ? body.status.trim() : '';
    if (!COURSE_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Please choose a valid course status (Active or Inactive).'
      });
    }

    const [result] = await pool.query('UPDATE courses SET status = ? WHERE id = ?', [status, id]);
    if (!result.affectedRows) {
      const existing = await fetchCourseById(id);
      if (!existing) return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    const course = await fetchCourseById(id);
    return res.json({
      success: true,
      message: `Course ${status === 'Active' ? 'activated' : 'deactivated'} successfully.`,
      data: { course }
    });
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// ADMIN: delete course
// (Existing leads keep the course name they submitted - nothing breaks.)
// ---------------------------------------------------------------------------
async function deleteCourse(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid course ID.' });

    const [result] = await pool.query('DELETE FROM courses WHERE id = ?', [id]);
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    return res.json({ success: true, message: 'Course deleted successfully.' });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getActiveCourses,
  getAllCourses,
  createCourse,
  updateCourse,
  setCourseStatus,
  deleteCourse
};
