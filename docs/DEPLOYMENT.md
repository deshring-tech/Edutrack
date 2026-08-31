# Deploying EduTrack

## 1. Switch SQLite → PostgreSQL

Local development uses SQLite so the project runs with zero infrastructure.
Production must use PostgreSQL: several teachers marking registers at 6pm is
concurrent-write traffic, which is exactly what SQLite handles worst.

**a. Create the database.** Neon is the easiest — free tier, no card, and it
gives you both a pooled and a direct connection string, which is what a
serverless deployment needs. Supabase, Railway and Render all work too.

**b. Run the switch:**

```bash
npm run db:use-postgres
```

That rewrites the `datasource` block to PostgreSQL (adding `directUrl`) and
deletes the SQLite migration history, which cannot replay against Postgres.
It refuses to run twice, so it can never wipe real migration history.

**c. Set both connection strings** in `.env` and in your host's environment:

```bash
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"   # pooled
DIRECT_URL="postgresql://user:pass@host/db?sslmode=require"     # direct
```

`DATABASE_URL` is used by the running app and should be the **pooled** endpoint:
serverless functions open a connection per invocation and exhaust a direct
Postgres connection limit fast. `DIRECT_URL` is used only by migrations, which
cannot run through a transaction pooler. If your provider has no pooler, set
both to the same value.

**d. Create the migration and optionally seed:**

```bash
npx prisma migrate dev --name init
npm run db:seed          # optional — demo data
```

After this, **local development uses that same Postgres database** — SQLite is
no longer involved. On Neon, create a separate branch for development so local
work cannot touch pilot data.

### What the switch does and does not change

Nothing in `src/` changes. The schema was written provider-agnostically: no
SQLite-specific types, and enums are modelled as `String` columns validated by
Zod (`src/domain/enums.ts`) because SQLite has no enum type.

**Optional hardening once on Postgres**, each a small, self-contained change:

| Improvement | Why | Where |
|---|---|---|
| Promote status columns to native enums | Database-level integrity, not just application-level | `schema.prisma` |
| `SELECT … FOR UPDATE SKIP LOCKED` when claiming outbox rows | Lets several dispatchers run concurrently | `notifications/outbox.ts` |
| Connection pooling (PgBouncer / Neon pooler) | Serverless functions exhaust direct connections | `DATABASE_URL` |
| Nightly rollup table for dashboard metrics | `progress.service.ts` reads raw rows; fine to ~100k, not beyond | new service |

---

## 2. Environment

Every variable is validated at boot by `src/lib/env.ts`. A missing or malformed
value fails the deploy rather than failing at 9am on a Monday.

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres **pooled** connection string |
| `DIRECT_URL` | yes (Postgres) | **Direct** connection string, used by migrations only |
| `SESSION_SECRET` | yes | ≥32 chars. Rotating it signs everyone out. |
| `SESSION_TTL_HOURS` | no | Default 720 (30 days) |
| `APP_URL` | yes | Public origin; used to build parent deep links |
| `NODE_ENV` | yes | `production` |
| `NOTIFICATION_CHANNEL` | no | `CONSOLE` \| `WEBHOOK` \| `WHATSAPP` \| `EMAIL` |
| `NOTIFICATION_WEBHOOK_URL` | if `WEBHOOK` | |
| `WHATSAPP_PHONE_NUMBER_ID` | if `WHATSAPP` | |
| `WHATSAPP_ACCESS_TOKEN` | if `WHATSAPP` | |
| `WHATSAPP_TEMPLATE_NAME` | no | Default `edutrack_progress_update` |
| `CRON_SECRET` | yes | ≥16 chars. Guards the dispatch endpoint. |
| `GOOGLE_CLIENT_ID` | no | Enables Google Sign-In. No secret needed. |
| `EMAIL_CHANNEL` | no | `CONSOLE` (default) \| `RESEND` |
| `RESEND_API_KEY` | if `RESEND` | |
| `EMAIL_FROM` | if `RESEND` | e.g. `EduTrack <no-reply@your-domain.in>` |

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

---

## 3. Hosting

### Vercel

Import the GitHub repository and set the environment variables above. Next.js is
detected automatically; `npm run build` already runs `prisma generate` first, so
no build-command override is needed.

Run the first migration against production yourself:

```bash
npx prisma migrate deploy
```

**Notification scheduling — read this before relying on it.**

`vercel.json` is committed with a single **daily** cron. That is not a
preference: Vercel's Hobby plan permits cron only once per day, and a daily
flush is useless for telling a parent their child was absent this morning.

You need a second scheduler. Three options, in the order I would pick them:

**1. An external HTTP cron service — recommended for a pilot.** cron-job.org,
EasyCron or a Cloudflare Worker cron. Free, minute-level granularity, and it
costs you nothing on any platform. Point it at:

```
GET https://your-app.vercel.app/api/cron/notifications
Header: Authorization: Bearer <CRON_SECRET>
```

**2. Vercel Pro.** Change `vercel.json` to `"*/2 * * * *"`. One scheduler,
punctual, no third party.

**3. GitHub Actions.** `.github/workflows/notifications.yml` is committed and
does exactly this, but its schedule is **commented out on purpose**. GitHub
bills Actions on *private* repositories per minute, rounded up per job: a run
every ten minutes is ~4,300 minutes a month against a 2,000-minute free
allowance. It would silently exhaust the allowance and start costing money, with
CI competing for what is left. If you use it anyway, keep the interval at 30
minutes or more and watch **Settings → Billing**.

For any of these, set `APP_URL` and `CRON_SECRET` as repository secrets under
**Settings → Secrets and variables → Actions** if you use the workflow, or in
the cron service's own configuration otherwise. The workflow can always be run
by hand from the Actions tab, which is the quickest way to flush the queue while
debugging.

**Never run two schedulers at once.** The outbox claims rows with a
read-then-update, which is only safe for a single dispatcher.

### Any Node host (Render, Railway, Fly, a VPS)

```bash
npm ci
npx prisma migrate deploy
npm run build
npm start
```

Then schedule the dispatcher from system cron:

```
*/2 * * * * cd /srv/edutrack && npm run notifications:dispatch
```

`npm run notifications:dispatch` and the HTTP endpoint call the same
`dispatchPending`, so behaviour cannot diverge between deployment styles.

---

## 4. Enabling Google Sign-In

1. Open <https://console.cloud.google.com/apis/credentials>.
2. **Create credentials → OAuth client ID → Web application.**
3. Under **Authorized JavaScript origins**, add every origin the app is served
   from — `http://localhost:3000` for local use and `https://your-domain.in` in
   production. Google rejects the request from any origin not listed, which is
   the single most common reason the button "does nothing".
4. You do **not** need an authorized redirect URI. This is the Identity Services
   flow, not an authorization-code exchange.
5. Set `GOOGLE_CLIENT_ID` and redeploy.

There is no client secret to configure. The Client ID is public by design — it
ships in the page — and the server's audience check is what binds a token to
this application.

**Reusing a Client ID from another app** works, provided you add this app's
origins to it. A separate client per application is better practice: consent
screens, quotas and revocation are then independent, so turning one off cannot
break the other.

Leaving `GOOGLE_CLIENT_ID` unset is a supported state — the button is not
rendered and email/password sign-in is unaffected.

## 5. Enabling email (password reset)

`EMAIL_CHANNEL=CONSOLE` prints emails to the server log, reset link included.
That is genuinely usable for a solo pilot, but it means **nobody can reset their
own password without you reading the log**, so configure a provider before real
users depend on it.

For Resend:

1. Create an account and verify your sending domain (DNS records; allow time for
   propagation).
2. Create an API key.
3. Set `EMAIL_CHANNEL=RESEND`, `RESEND_API_KEY` and `EMAIL_FROM`.

`EMAIL_FROM` must use the verified domain. Sending from an unverified domain is
the usual cause of silent non-delivery, and `env.ts` cannot catch that for you —
watch for `email.failed` in the logs.

Adding SES or Postmark means one more class in
`src/server/email/adapters.ts` and one more case in `getEmailAdapter`.

## 6. Enabling WhatsApp

1. Create a Meta Business account and a WhatsApp Business app.
2. Register a phone number and note its `phone_number_id`.
3. Submit a message template with three body parameters:
   `{{1}}` parent name · `{{2}}` student name · `{{3}}` the update.
4. Set `NOTIFICATION_CHANNEL=WHATSAPP` plus the token variables.

Business-initiated messages must use an approved template, which is why the
adapter passes parameters rather than free text. Templates are approved per
language; add locales before serving non-English centres.

**Cost is the thing to model first.** Each conversation is billed. At roughly
two updates per student per school day, a 150-student centre generates
~6,000 messages a month. Check that against the ₹3,499 plan before enabling
WhatsApp for every centre — web push to an installed PWA costs nothing per
message and is the obvious first channel to add.

---

## 7. Production checklist

- [ ] `SESSION_SECRET` and `CRON_SECRET` are freshly generated, not copied from `.env.example`
- [ ] `NODE_ENV=production` (demo credentials are hidden from the login page only in production)
- [ ] `DATABASE_URL` points at the **pooled** Postgres endpoint, with TLS
- [ ] `DIRECT_URL` points at the **direct** endpoint (migrations need it)
- [ ] `npx prisma migrate deploy` has run
- [ ] Notification scheduling is actually wired — either the GitHub Actions
      secrets are set, or you are on Vercel Pro with a frequent cron. A daily
      flush alone means parents hear about today's absence tomorrow
- [ ] `APP_URL` is the real public origin
- [ ] `NOTIFICATION_CHANNEL` is deliberate — leaving it `CONSOLE` means parents get nothing
- [ ] `EMAIL_CHANNEL` is deliberate — leaving it `CONSOLE` means nobody can reset their own password
- [ ] If Google Sign-In is enabled, the production origin is listed on the OAuth client
- [ ] Cron is scheduled and `/api/cron/notifications` returns 200 with the secret and 401 without
- [ ] `/api/health` returns 200 and shows a queue that is draining
- [ ] Automated database backups are on
- [ ] `npm test` and `npm run build` pass in CI

---

## 8. Operating notes

**Health.** `GET /api/health` performs a real database round-trip and reports
outbox depth. A check that only proves the process is alive will report healthy
while every request 500s on a dead connection pool.

Watch `queue.dead`. A non-zero value means messages exhausted their retries and
no parent received them — that is a page-someone condition, not a warning.

**Logs** are structured JSON in production (`src/lib/logger.ts`), with
passwords, tokens and phone numbers redacted by key name. Useful events:
`auth.login.failed`, `notification.dead`, `notifications.dispatched`,
`prisma.error`.

**Login throttling** is per-process and in-memory. On several instances the
effective limit is `8 × instances` per 15 minutes. Move it to Redis when
scaling horizontally; the interface in `auth.service.ts` does not change.

**Data protection.** Children's records are covered by India's DPDP Act 2023.
Access is enforced per guardian link, every write is audited in `AuditLog`, no
photographs of minors are stored, and no behavioural or advertising profile is
built. Before onboarding a real centre, agree a retention period and add a
deletion routine — the audit log is append-only and will need an explicit
policy.
