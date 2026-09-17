'use strict';

/**
 * DEMO SERVER - runs the public lead form WITHOUT MySQL.
 *
 * Use this only to preview/test the form UI in a browser. It:
 *   - Serves the exact same public/ files (form.html, css, js)
 *   - Serves /api/courses from an in-memory list (same defaults as init.js)
 *   - Accepts POST /api/leads, validates it with the real validation
 *     rules, and stores it in memory (lost on restart, nothing written
 *     to disk or to any database)
 *
 * The admin panel (/admin/*) is NOT usable in this mode - it needs the
 * real MySQL-backed server (npm start) because login/leads/courses
 * management all read and write the database.
 *
 * Run with:  node demo-server.js
 * Then open: http://localhost:3000/form.html
 */

const path = require('path');
const express = require('express');
const helmet = require('helmet');

const { validateLeadPayload } = require('./server/middleware/validate');

const PORT = process.env.PORT || 3000;

// Same default course list as server/database/init.js, Active only.
const COURSES = [
  'Web Development',
  'Python Programming',
  'JavaScript',
  'HTML & CSS',
  'Graphics Design',
  'Microsoft Office',
  'Database Management',
  'Networking',
  'Cybersecurity',
  'Data Analysis',
  'Other'
].map((name, i) => ({ id: i + 1, course_name: name }));

// In-memory "table" - just for previewing the flow, not persisted.
const leads = [];

const app = express();
app.disable('x-powered-by');

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

app.use(express.json({ limit: '100kb' }));

// Serve only the public form (admin needs the real DB-backed server).
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.redirect(302, '/form.html'));

app.get('/admin', (req, res) => {
  res
    .status(200)
    .send('Admin panel needs the real server (npm start) with MySQL configured - it is disabled in demo mode.');
});

// ---------------------------------------------------------------------------
// GET /api/courses - same shape as the real endpoint, no DB involved.
// ---------------------------------------------------------------------------
app.get('/api/courses', (req, res) => {
  res.json({ success: true, data: { courses: COURSES } });
});

// ---------------------------------------------------------------------------
// POST /api/leads - real validation, in-memory "storage".
// ---------------------------------------------------------------------------
app.post('/api/leads', (req, res) => {
  const { errors, data } = validateLeadPayload(req.body);
  if (errors.length) {
    return res.status(400).json({ success: false, message: 'Please fix the errors below.', errors });
  }

  const activeNames = COURSES.map((c) => c.course_name);
  if (!activeNames.includes(data.course)) {
    return res.status(400).json({
      success: false,
      message: 'Please fix the errors below.',
      errors: [{ field: 'course', message: 'Please choose a valid ICT course.' }]
    });
  }

  const id = leads.length + 1;
  const record = { id, ...data, created_at: new Date().toISOString() };
  leads.push(record);

  console.log(`[demo] New lead received (not saved to any database): ${record.full_name} <${record.email}>`);

  return res.status(201).json({
    success: true,
    message: 'Lead submitted successfully (demo mode - not saved to a real database).',
    data: { id }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('-----------------------------------------------------');
  console.log(' DEMO MODE - no MySQL required');
  console.log(`   Form page: http://localhost:${PORT}/form.html`);
  console.log('   Submitted leads are only kept in memory for this run.');
  console.log('   Admin panel is disabled in this mode (needs npm start + MySQL).');
  console.log('-----------------------------------------------------');
});
