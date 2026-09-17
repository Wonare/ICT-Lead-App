'use strict';

/**
 * Rate limiters - basic abuse protection.
 * Applied to the public form endpoint, the public courses endpoint
 * and the admin login endpoint.
 */

const rateLimit = require('express-rate-limit');
const config = require('../config');

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/** Public lead form: a handful of submissions per window is plenty. */
const leadSubmitLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: config.rateLimit.leads,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many submissions from your device. Please try again in 15 minutes.'
  }
});

/** Public active-courses list. */
const coursesLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again in a few minutes.'
  }
});

/** Admin login: slows down brute-force attempts. */
const loginLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: config.rateLimit.login,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again in 15 minutes.'
  }
});

module.exports = { leadSubmitLimiter, coursesLimiter, loginLimiter };
