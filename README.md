# ICT Lead Registration Form

A standalone, production-style **ICT Lead Registration Form** page with a Node.js + Express backend, MySQL storage, and a protected admin panel.

**Data flow:** `FORM (/form.html)` → `POST /api/leads` → `MySQL (leads table)` → `Admin Panel (/admin)`

There is intentionally **no homepage, landing page or marketing site**. The only public page is the form.

---

## Free cloud hosting

See [DEPLOYMENT.md](DEPLOYMENT.md) for Render Free hosting with a Neon Free PostgreSQL database. The included `render.yaml` configures the web service. `npm run start:cloud` applies idempotent database setup before starting. Cloud account connections and deployment are still required. `npm run test:postgres` runs the actual PostgreSQL schema and application workflows locally in an isolated embedded PostgreSQL engine.

## Local startup

The app now defaults to persistent SQLite storage and serves the complete admin panel. See `START-HERE.md` for this computer’s login details and startup instructions. Run `npm ci`, then `npm start`; tables and default courses are created automatically. Data is stored in `data/ict-leads.sqlite`. Stop the server before copying the `data` folder for backup. Keep `.env` alongside the app to preserve configuration.

For a new installation, copy `.env.example` to `.env` and set a unique admin password and JWT secret before first startup. Editing the initial admin password after the database exists does not reset the saved account.

`npm run test:form` checks the public form, `npm run test:admin` checks the admin workflows, and `npm run test:storage` checks persistence in an isolated database. The form and admin tests need a running server and remove only records they create.

## Features

- **Public form page** (`/form.html`) — responsive (mobile / tablet / laptop / desktop), centered card design
  - Full Name, Phone/WhatsApp, Email, Course (loaded from the database), Learning Mode (radio pills), Communication Method, Referral Source (+ dynamic "Please specify" when *Other* is selected)
  - Friendly frontend validation, loading state, double-submit protection, success screen with *Submit Another Response*
- **Express + MySQL backend**
  - `POST /api/leads` with backend validation, sanitization and **parameterized queries**
  - `GET /api/courses` — only **Active** courses are shown in the form dropdown
- **Admin panel** (`/admin/login.html`)
  - Dashboard with lead statistics (total, new, enrolled, this month), leads-by-course and leads-by-referral-source charts, recent leads
  - Leads: search, filter by status/course, pagination, view **every submitted field**, change status, add admin notes, delete, CSV export
  - Courses: add, edit, activate/deactivate, delete — the form dropdown updates without touching HTML
- **Security**
  - bcrypt-hashed admin passwords, JWT-protected admin APIs
  - Rate limiting on the public form, courses endpoint and admin login
  - Helmet security headers + strict CSP, secrets in `.env`, generic error responses (no server internals leaked)

---

## Project structure

```text
ict-lead-form/
├── public/                  # The standalone form page (main public page: /form.html)
│   ├── form.html
│   ├── css/form.css
│   └── js/form.js
├── admin/                   # Admin panel (static pages, data via protected APIs)
│   ├── login.html
│   ├── dashboard.html
│   ├── leads.html
│   ├── courses.html
│   ├── css/admin.css
│   └── js/ (admin.js, login.js, dashboard.js, leads.js, courses.js)
├── server/
│   ├── server.js            # Express app + static serving + route mounting
│   ├── config.js            # Environment configuration
│   ├── routes/              # leads.js, courses.js, auth.js, adminLeads.js,
│   │                        # adminCourses.js, adminDashboard.js
│   ├── controllers/         # leadController, courseController, authController
│   ├── middleware/          # auth (JWT), validate, rateLimiters, errorHandler
│   └── database/
│       ├── connection.js    # mysql2 connection pool
│       ├── schema.sql       # leads / courses / admin_users tables
│       └── init.js          # npm run setup (tables + seed data + admin user)
├── tests/form.e2e.js        # End-to-end smoke test (form -> API -> MySQL)
├── .env                     # Local secrets (never commit)
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## Requirements

- Node.js 22.13+ (Node.js 24 recommended for local SQLite)
- MySQL 5.7+ / 8.x (or MariaDB 10.4+)

## MySQL setup (optional)

Set `DB_DRIVER=mysql` in `.env` before following these steps.

**1. Create the database and a dedicated MySQL user:**

```sql
CREATE DATABASE ict_leads CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ictuser'@'localhost' IDENTIFIED BY 'your-strong-password';
GRANT ALL PRIVILEGES ON ict_leads.* TO 'ictuser'@'localhost';
FLUSH PRIVILEGES;
```

**2. Configure the environment:**

```bash
cp .env.example .env
# then edit .env: DB credentials, JWT_SECRET, admin username/password
```

Generate a strong JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**3. Install dependencies and initialise the database:**

```bash
npm install
npm run setup     # creates tables, seeds the 11 default courses + admin user
```

**4. Start the server:**

```bash
npm start         # or: npm run dev (auto-restart on changes)
```

| Page          | URL                                   |
| ------------- | ------------------------------------- |
| Form (public) | `http://localhost:3000/form.html`     |
| Admin login   | `http://localhost:3000/admin/login.html` |

**Default admin credentials** (from `.env`, created by `npm run setup`):
username `admin` / password `Admin@12345` — **change them before going live.**

---

## Database schema

### `leads`
| Column | Type | Notes |
| --- | --- | --- |
| id | INT UNSIGNED AUTO_INCREMENT | PRIMARY KEY |
| full_name | VARCHAR(120) | NOT NULL |
| phone | VARCHAR(20) | NOT NULL |
| email | VARCHAR(190) | NOT NULL |
| course | VARCHAR(120) | NOT NULL (validated against active `courses`) |
| learning_mode | ENUM('Physical','Online') | NOT NULL |
| communication_method | ENUM('WhatsApp','Phone Call','Email','SMS') | NOT NULL |
| referral_source | ENUM('Facebook','Instagram','Google','Friend or Family','WhatsApp','Other') | NOT NULL |
| referral_other | VARCHAR(150) | NULL unless referral_source = 'Other' |
| status | ENUM('New','Contacted','Enrolled','Not Interested','Closed') | DEFAULT 'New' |
| notes | TEXT | Admin-only notes, NULL default |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP |

### `courses`
`id`, `course_name` (UNIQUE), `description`, `status` ENUM('Active','Inactive') DEFAULT 'Active', `created_at`, `updated_at`

### `admin_users`
`id`, `username` (UNIQUE), `password_hash` (bcrypt), `full_name`, `created_at`, `updated_at`

---

## API reference

### Public
| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/leads` | Submit the form (rate limited). Returns `{"success":true,"message":"Lead submitted successfully"}` |
| GET | `/api/courses` | Active courses for the dropdown |

### Admin (all require `Authorization: Bearer <JWT>`)
| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/admin/auth/login` | Login (rate limited) → JWT |
| GET | `/api/admin/auth/me` | Validate token / get current admin |
| GET | `/api/admin/stats` | Dashboard statistics |
| GET | `/api/admin/leads?search=&status=&course=&page=&limit=` | List leads (paginated) |
| GET | `/api/admin/leads/:id` | Full lead detail (every submitted field) |
| PUT | `/api/admin/leads/:id` | Update lead fields incl. notes (partial) |
| PATCH | `/api/admin/leads/:id/status` | Change status only |
| DELETE | `/api/admin/leads/:id` | Delete lead |
| GET | `/api/admin/courses` | All courses (any status) |
| POST | `/api/admin/courses` | Create course |
| PUT | `/api/admin/courses/:id` | Update course |
| PATCH | `/api/admin/courses/:id/status` | Activate / deactivate |
| DELETE | `/api/admin/courses/:id` | Delete course |

---

## End-to-end test

With the server running:

```bash
npm run test:form
```

The test loads `/form.html` in a simulated browser (jsdom), fills every field, submits the real form JS against the real API, verifies the success screen, then logs in as admin and confirms the lead is retrievable with **every field intact** via the admin API.

---

## Security notes

- All SQL uses parameterized placeholders; dynamic `UPDATE` columns come from a hard whitelist.
- Admin passwords are bcrypt-hashed (cost 12); login failures return a generic message.
- JWT secret and DB credentials live only in `.env` (server-side); the frontend never sees them.
- Rate limits: form submissions, courses endpoint and admin login (configurable in `.env`).
- Error handler never exposes stack traces or SQL errors to clients.
- For production: serve over HTTPS, set `NODE_ENV=production`, change the default admin password, and back up the database regularly.
