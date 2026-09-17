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
const { pool, testConnection } = require('./database/connection');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const publicLeadRoutes = require('./routes/leads');
const publicCourseRoutes = require('./routes/courses');
const authRoutes = require('./routes/auth');
const adminLeadRoutes = require('./routes/adminLeads');
const adminCourseRoutes = require('./routes/adminCourses');
const adminDashboardRoutes = require('./routes/adminDashboard');

const app = express();

// Behind a reverse proxy (nginx, the sandbox preview proxy, etc.)
app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false);
app.disable('x-powered-by');

// ---------------------------------------------------------------------------
// Security headers (CSP allows our own files only; inline styles are permitted
// because admin chart bars are sized via the style attribute).
// ---------------------------------------------------------------------------
// frameAncestors comes from config (FRAME_ANCESTORS env var) and defaults to
// 'self'. The legacy X-Frame-Options header is only sent while framing is
// restricted, so it can never contradict a deliberately relaxed CSP.
const allowExternalFraming = config.security.frameAncestors !== "'self'";

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
        frameAncestors: [config.security.frameAncestors],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: config.env === 'production' ? [] : null
      }
    },
    xFrameOptions: allowExternalFraming ? false : { action: 'SAMEORIGIN' }
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

app.get('/healthz', (req, res) => res.json({ success: true }));

app.use(notFoundHandler);
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Startup - verify the database connection before accepting traffic.
// ---------------------------------------------------------------------------
async function start() {
  try {
    await testConnection();
    console.log(`[OK] ${config.db.driver} database ready.`);
  } catch (err) {
    console.error('-----------------------------------------------------');
    console.error('[FATAL] Cannot open database:', err.message);
    console.error('Check DATABASE_URL for PostgreSQL, or your configured local database settings.');
    console.error('Run "npm run setup" once to create tables + seed data.');
    console.error('-----------------------------------------------------');
    process.exit(1);
  }

  if (config.env === 'production' && config.jwt.secret === 'dev-only-insecure-secret-change-me') {
    console.error('[FATAL] Set a strong JWT_SECRET in .env before running in production.');
    process.exit(1);
  }

  const server = app.listen(config.port, config.host, () => {
    console.log('-----------------------------------------------------');
    console.log(' ICT Lead Form server is running');
    console.log(`   Form page:   http://localhost:${config.port}/form.html`);
    console.log(`   Admin login: http://localhost:${config.port}/admin/login.html`);
    console.log(`   Environment: ${config.env}`);
    console.log('-----------------------------------------------------');
  });
  let closing = false;
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
    if (closing) return;
    closing = true;
    server.close(async () => { await pool.end(); process.exit(0); });
    setTimeout(() => process.exit(1), 10000).unref();
  });
}

start();
