# Free hosting: Render + Neon

The project is prepared for Render's Free web service and Neon's Free PostgreSQL plan. Neon is connected and initialized. Render and GitHub account connections and the first web deployment are still required.

## Publish

1. Reuse the existing Neon project `sweet-credit-99657235`, branch `production`. The app tables and administrator already exist. The local `.env` contains the pooled `DATABASE_URL` and direct `DATABASE_URL_UNPOOLED`; configure these privately in Render.
2. Put this project's source into a GitHub repository you own. The included `.gitignore` excludes `.env`, local databases, personal login instructions and dependencies. A deployment ZIP can also be unpacked and uploaded into an empty repository. Keep `package.json` and `render.yaml` at the repository root.
3. Sign in to https://dashboard.render.com. Create a Blueprint from that repository. The included `render.yaml` selects the Free plan and configures the server automatically.
4. When prompted, enter both Neon connection values and the existing administrator password from the private local configuration. Render generates a new `JWT_SECRET`. The existing database account password is preserved.
5. Deploy. Startup creates tables, seeds courses once and creates the admin account only if it does not exist. Existing data survives redeploys. Visit `/form.html` and `/admin/login.html` on the generated HTTPS URL. Log in with the existing `admin` credentials; changing an environment variable does not change an existing account password.

If creating a Web Service manually instead, choose Node, Free, build command `npm ci --omit=dev`, start command `npm run start:cloud`, and health check `/healthz`. Add the environment settings listed in `render.yaml`. Generate a random JWT_SECRET of at least 32 characters.

## What to expect

- Render's Free web service sleeps after 15 minutes without traffic. The next visit may take around a minute to start. Free services have monthly usage limits.
- Do not use Render's Free PostgreSQL for ongoing storage: it expires after 30 days. Neon is the separate persistent database.
- Neon Free has storage and compute quotas. Check the account dashboard for current limits; no paid upgrade is selected by these files.
- The standalone local app and Render will share the existing Neon production database. The old SQLite file remains a local backup; do not upload database files or `.env` to GitHub.
- `ADMIN_DEFAULT_PASSWORD` is used only on initial account creation. Changing the environment variable later does not reset the database account password.
- The local app still uses `.env` and runs with `npm start`.

Current plan details: https://render.com/docs/free and https://neon.com/pricing
