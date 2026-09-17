'use strict';

/**
 * Shared validation helpers for the public lead form and admin endpoints.
 * Returns friendly, human-readable error messages and a sanitized `data`
 * object that is safe to bind into parameterized SQL queries.
 */

const LEARNING_MODES = ['Physical', 'Online'];
const COMMUNICATION_METHODS = ['WhatsApp', 'Phone Call', 'Email', 'SMS'];
const REFERRAL_SOURCES = ['Facebook', 'Instagram', 'Google', 'Friend or Family', 'WhatsApp', 'Other'];
const LEAD_STATUSES = ['New', 'Contacted', 'Enrolled', 'Not Interested', 'Closed'];
const COURSE_STATUSES = ['Active', 'Inactive'];

const LIMITS = {
  full_name: 120,
  phone: 20,
  email: 190,
  course: 120,
  referral_other: 150,
  notes: 2000,
  course_name: 120,
  description: 500
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
const PHONE_RE = /^\+?[0-9\s\-().]{7,20}$/;
const NAME_RE = /^[A-Za-z\u00C0-\u024F' .-]{2,120}$/;

/** Removes NUL/control characters, collapses whitespace and trims. */
function clean(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/\0/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Validates a lead payload.
 * @param {object} body
 * @param {{partial?: boolean}} opts  partial=true -> only validate fields present (admin update)
 */
function validateLeadPayload(body, { partial = false } = {}) {
  const errors = [];
  const data = {};

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: [{ field: 'form', message: 'Invalid form submission.' }], data: null };
  }

  const has = (key) => body[key] !== undefined && body[key] !== null;
  const needed = (key) => !partial || has(key);

  // ---- Full name ----------------------------------------------------------
  if (needed('full_name')) {
    const v = clean(body.full_name);
    if (!v) errors.push({ field: 'full_name', message: 'Please enter your full name.' });
    else if (v.length > LIMITS.full_name) errors.push({ field: 'full_name', message: `Full name must not exceed ${LIMITS.full_name} characters.` });
    else if (!NAME_RE.test(v)) errors.push({ field: 'full_name', message: 'Please enter a valid full name (letters, spaces, hyphens and apostrophes only).' });
    else data.full_name = v;
  }

  // ---- Phone --------------------------------------------------------------
  if (needed('phone')) {
    const v = clean(body.phone);
    const digits = v.replace(/\D/g, '');
    if (!v) errors.push({ field: 'phone', message: 'Please enter your phone/WhatsApp number.' });
    else if (!PHONE_RE.test(v) || digits.length < 7 || digits.length > 15) errors.push({ field: 'phone', message: 'Please enter a valid phone number.' });
    else data.phone = v;
  }

  // ---- Email --------------------------------------------------------------
  if (needed('email')) {
    const v = clean(body.email).toLowerCase();
    if (!v) errors.push({ field: 'email', message: 'Please enter your email address.' });
    else if (v.length > LIMITS.email || !EMAIL_RE.test(v)) errors.push({ field: 'email', message: 'Please enter a valid email address.' });
    else data.email = v;
  }

  // ---- Course -------------------------------------------------------------
  if (needed('course')) {
    const v = clean(body.course);
    if (!v) errors.push({ field: 'course', message: 'Please select an ICT course.' });
    else if (v.length > LIMITS.course) errors.push({ field: 'course', message: 'Please select a valid ICT course.' });
    else data.course = v;
  }

  // ---- Learning mode ------------------------------------------------------
  if (needed('learning_mode')) {
    const v = clean(body.learning_mode);
    if (!LEARNING_MODES.includes(v)) errors.push({ field: 'learning_mode', message: 'Please select a preferred learning mode.' });
    else data.learning_mode = v;
  }

  // ---- Communication method -------------------------------------------------
  if (needed('communication_method')) {
    const v = clean(body.communication_method);
    if (!COMMUNICATION_METHODS.includes(v)) errors.push({ field: 'communication_method', message: 'Please select how you would like us to contact you.' });
    else data.communication_method = v;
  }

  // ---- Referral source ------------------------------------------------------
  if (needed('referral_source')) {
    const v = clean(body.referral_source);
    if (!REFERRAL_SOURCES.includes(v)) errors.push({ field: 'referral_source', message: 'Please tell us how you heard about us.' });
    else data.referral_source = v;
  }

  // ---- Referral "Other" details -------------------------------------------
  const source =
    data.referral_source !== undefined
      ? data.referral_source
      : has('referral_source')
        ? clean(body.referral_source)
        : undefined;

  if (source === 'Other') {
    const v = clean(body.referral_other);
    if (!v) errors.push({ field: 'referral_other', message: 'Please specify how you heard about us.' });
    else if (v.length > LIMITS.referral_other) errors.push({ field: 'referral_other', message: `Please keep this under ${LIMITS.referral_other} characters.` });
    else data.referral_other = v;
  } else if (source !== undefined && source !== '') {
    data.referral_other = null;
  } else if (has('referral_other')) {
    const v = clean(body.referral_other);
    data.referral_other = v ? v.slice(0, LIMITS.referral_other) : null;
  }

  // ---- Status (admin only) --------------------------------------------------
  if (has('status')) {
    const v = clean(body.status);
    if (!LEAD_STATUSES.includes(v)) errors.push({ field: 'status', message: 'Please choose a valid lead status.' });
    else data.status = v;
  }

  // ---- Notes (admin only) ---------------------------------------------------
  if (has('notes')) {
    const v = clean(body.notes);
    if (v.length > LIMITS.notes) errors.push({ field: 'notes', message: `Notes must not exceed ${LIMITS.notes} characters.` });
    else data.notes = v === '' ? null : v;
  }

  return { errors, data: errors.length ? null : data };
}

/** Validates a course payload (admin course management). */
function validateCoursePayload(body, { partial = false } = {}) {
  const errors = [];
  const data = {};

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: [{ field: 'form', message: 'Invalid request body.' }], data: null };
  }

  const has = (key) => body[key] !== undefined && body[key] !== null;
  const needed = (key) => !partial || has(key);

  if (needed('course_name')) {
    const v = clean(body.course_name);
    if (!v) errors.push({ field: 'course_name', message: 'Please enter the course name.' });
    else if (v.length < 2) errors.push({ field: 'course_name', message: 'Course name must be at least 2 characters.' });
    else if (v.length > LIMITS.course_name) errors.push({ field: 'course_name', message: `Course name must not exceed ${LIMITS.course_name} characters.` });
    else data.course_name = v;
  }

  if (has('description')) {
    const v = clean(body.description);
    if (v.length > LIMITS.description) errors.push({ field: 'description', message: `Description must not exceed ${LIMITS.description} characters.` });
    else data.description = v === '' ? null : v;
  } else if (!partial) {
    data.description = null;
  }

  if (has('status')) {
    const v = clean(body.status);
    if (!COURSE_STATUSES.includes(v)) errors.push({ field: 'status', message: 'Please choose a valid course status (Active or Inactive).' });
    else data.status = v;
  } else if (!partial) {
    data.status = 'Active';
  }

  return { errors, data: errors.length ? null : data };
}

/** Validates a positive integer route param such as :id. */
function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) return null;
  return id;
}

module.exports = {
  LEARNING_MODES,
  COMMUNICATION_METHODS,
  REFERRAL_SOURCES,
  LEAD_STATUSES,
  COURSE_STATUSES,
  LIMITS,
  clean,
  parseId,
  validateLeadPayload,
  validateCoursePayload
};
