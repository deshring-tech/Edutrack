# Deploying EduTrack

## 1. Switch SQLite → PostgreSQL

Local development uses SQLite so the project runs with zero infrastructure.
Production should use PostgreSQL: concurrent writes from several teachers
marking registers at 6pm is exactly the workload SQLite handles worst.

The switch is two edits and a fresh migration.

**a. Change the provider** in `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**b. Point `DATABASE_URL` at Postgres:**

```bash
DATABASE_URL="postgresql://user:password@host:5432/edutrack?sslmode=require"
```

Managed options that need no server administration: Neon, Supabase, Railway,
Render. All have a usable free tier for a pilot.

**c. Create the migration.** The existing SQLite migration cannot be replayed
against Postgres, so generate a fresh initial migration:

```bash
rm -rf prisma/migrations
npx prisma migrate dev --name init
npm run db:seed          # optional — demo data
```

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
| `DATABASE_URL` | yes | Postgres connection string |
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

Connect the repository and set the environment variables above. Build and start
commands are picked up from `package.json`.

Add `vercel.json` for the notification dispatcher:

```json
{
  "crons": [
    { "path": "/api/cron/notifications", "schedule": "*/2 * * * *" }
  ]
}
```

Vercel sends the cron request with the project's `CRON_SECRET` as a bearer
token. Run migrations against production explicitly:

```bash
npx prisma migrate deploy
```

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
- [ ] `DATABASE_URL` points at Postgres, with TLS
- [ ] `npx prisma migrate deploy` has run
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
