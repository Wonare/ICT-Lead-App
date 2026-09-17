'use strict';

/**
 * ICT Lead Form - Express server.
 *
 * Data flow:  FORM (public/form.html)  ->  POST /api/leads  ->  MySQL `leads`
 *             ADMIN PANEL (admin/*.html)  ->  /api/admin/*  ->  same MySQL data
 *
 * There is intentionally NO homepage/landing page.
 * The main public-facing page is /form.html.
 */

const path = require('path');
const express = require('express');
const helmet = require('helmet');

const config = require('./config');
const { testConnection } = require('./database/connection');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const publicLeadRoutes = require('./routes/leads');
const publicCourseRoutes = require('./routes/courses');
const authRoutes = require('./routes/auth');
const adminLeadRoutes = require('./routes/adminLeads');
const adminCourseRoutes = require('./routes/adminCourses');
const adminDashboardRoutes = require('./routes/adminDashboard');

const app = express();

// Behind a reverse proxy (nginx, the sandbox preview proxy, etc.)
app.set('trust proxy', 1);
app.disable('x-powered-by');

// ---------------------------------------------------------------------------
// Security headers (CSP allows our own files only; inline styles are permitted
// because admin chart bars are sized via the style attribute).
// ---------------------------------------------------------------------------
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"]
      }
    }
  })
);

// JSON bodies only, small limit - the form never needs more.
app.use(express.json({ limit: '100kb' }));

// ---------------------------------------------------------------------------
// Static files
//   /form.html          -> the public lead form (main public page)
//   /css/form.css       -> form styles
//   /js/form.js         -> form logic
//   /admin/login.html   -> admin panel (APIs behind it are JWT protected)
// ---------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));

// Convenience redirects (these are NOT landing pages).
app.get('/', (req, res) => res.redirect(302, '/form.html'));
app.get('/admin', (req, res) => res.redirect(302, '/admin/login.html'));
app.get('/admin/', (req, res) => res.redirect(302, '/admin/login.html'));

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
app.use('/api/leads', publicLeadRoutes);          // POST /api/leads (public, rate limited)
app.use('/api/courses', publicCourseRoutes);      // GET  /api/courses (active only)

app.use('/api/admin/auth', authRoutes);           // POST /login, GET /me
app.use('/api/admin/leads', adminLeadRoutes);     // list / view / update / status / delete
app.use('/api/admin/courses', adminCourseRoutes); // course management
app.use('/api/admin', adminDashboardRoutes);      // GET /api/admin/stats

app.use(notFoundHandler);
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Startup - verify the database connection before accepting traffic.
// ---------------------------------------------------------------------------
async function start() {
  try {
    await testConnection();
    console.log('[OK] MySQL connection established.');
  } catch (err) {
    console.error('-----------------------------------------------------');
    console.error('[FATAL] Cannot connect to MySQL:', err.message);
    console.error('Check that MySQL is running and that DB_HOST, DB_PORT,');
    console.error('DB_USER, DB_PASSWORD and DB_NAME in .env are correct.');
    console.error('Run "npm run setup" once to create tables + seed data.');
    console.error('-----------------------------------------------------');
    process.exit(1);
  }

  if (config.env === 'production' && config.jwt.secret === 'dev-only-insecure-secret-change-me') {
    console.error('[FATAL] Set a strong JWT_SECRET in .env before running in production.');
    process.exit(1);
  }

  app.listen(config.port, '0.0.0.0', () => {
    console.log('-----------------------------------------------------');
    console.log(' ICT Lead Form server is running');
    console.log(`   Form page:   http://localhost:${config.port}/form.html`);
    console.log(`   Admin login: http://localhost:${config.port}/admin/login.html`);
    console.log(`   Environment: ${config.env}`);
    console.log('-----------------------------------------------------');
  });
}

start();
