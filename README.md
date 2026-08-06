# EduTrack

Student progress tracking for tuition centres and coaching classes.

A teacher marks a whole batch in one pass. That single save becomes a private
record for every child in it, their guardians are notified, and the centre owner
sees it roll up. Parents read updates in a format they already understand.

---

## Quick start

### Windows — one click

Double-click **`start-edutrack.bat`**.

It installs dependencies, generates `.env` with fresh secrets, migrates the
database, loads demo data on first run, builds, and opens your browser once the
server is actually responding. Safe to run again any time — it never overwrites
existing configuration or data.

Use **`dev-edutrack.bat`** instead if you are changing code and want hot reload.

### Any platform

```bash
npm install
npm run setup     # .env, migrations, and demo data if the database is empty
npm run dev
```

`npm run setup` is the same bootstrap the launcher uses, so both paths end up in
an identical state.

Open <http://localhost:3000>. Either create your own centre from the landing
page, or sign in with a seeded account (password `demo-password-123`):

| Role | Email | Sees |
|---|---|---|
| Centre owner | `priya@brightminds.in` | Whole-centre dashboard, every batch |
| Teacher | `rao@brightminds.in` | Only Grade 7 Math and Grade 6 Science |
| Parent | `anita.sharma@example.in` | Only Aarav Sharma |
| Parent | `harjit.singh@example.in` | Only Kabir Singh (an at-risk student) |

Generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## Commands

| Command | What it does |
|---|---|
| `npm run setup` | First-run bootstrap: `.env`, migrations, seed if empty |
| `npm run dev` | Development server |
| `npm run build` | Production build (runs `prisma generate` first) |
| `npm start` | Serve the production build |
| `npm test` | Unit and authorization tests |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Create and apply a migration |
| `npm run db:seed` | Populate a realistic demo centre |
| `npm run db:reset` | Drop, re-migrate and re-seed |
| `npm run db:studio` | Browse the database |
| `npm run notifications:dispatch` | Drain the notification outbox once |

---

## Setting up a real centre

Nothing needs seeding. From the landing page, **Create centre** registers a
tenant and its first owner, then drops you into administration:

1. **Staff** — add teachers. Each gets a generated temporary password, shown
   once, which they change under Settings.
2. **Batches** — create a batch and assign it to one teacher. Only that teacher
   (and owners) can log against it.
3. **Students** — add students, optionally with a guardian and a batch in the
   same step. A student with no guardian generates records nobody can see, so
   the form says so.
4. Teachers now see their batches and can start logging; guardians see their own
   children immediately.

Withdrawing a student frees a plan seat and keeps their history. Deactivating a
teacher is refused while they still own live batches, so no batch is ever left
unloggable.

## Architecture

Layers depend strictly downward. Nothing in `domain/` knows that a database or
a browser exists, which is what makes the rules testable in milliseconds.

```
src/app/          Next.js routes, pages, server actions   — HTTP and rendering
src/components/   Presentational React components         — no data access
src/server/       Application services (use cases)        — transactions, orchestration
src/lib/          Infrastructure: db, auth, env, errors   — cross-cutting
src/domain/       Pure business rules                     — no I/O, no framework
```

### The write path

Every teacher action — attendance, homework, a test, an assignment, a note —
converges on one function, `publishEntries` in
`src/server/services/timeline.service.ts`:

```
teacher saves a batch
  → service validates (Zod) and authorises (rbac)
  → ONE transaction:
      upsert the underlying records      (attendance / homework / scores)
      upsert one timeline entry per student
      queue one notification per guardian
      append an audit log row
  → dispatcher delivers the queue separately, with retries
```

Three properties fall out of that shape:

**Atomic.** Records, timeline and notifications commit together or not at all.
A parent can never be told about something that was rolled back.

**Idempotent.** Every log table has a natural unique key
(`batch + student + day`), and timeline entries are keyed by
`sourceType + sourceId + studentId`. Re-saving a form corrects it in place. A
notification is queued only when an entry is new or its wording actually
changed, so fixing one student's mark does not re-notify the other twenty-one.

**Deliverable.** The transactional outbox means a messaging outage delays
notifications rather than losing them.

### Authorization

`src/lib/auth/rbac.ts` is the only module that decides access. Every service and
page asks it; none re-implement a check.

- **Tenancy** — every query is scoped to the caller's `centreId`.
- **Parents** — may read only students joined to them by a `ParentLink` row, and
  may write nothing except an acknowledgement.
- **Teachers** — may read and write only for batches they teach.
- **Owners** — full access within their own centre.

Cross-tenant access returns **not found**, never "forbidden": replying
"forbidden" for a record that exists elsewhere confirms that the id is real.

Middleware (`src/middleware.ts`) only keeps signed-out visitors out of `/app`.
It cannot query the database, so it is a user-experience guard, not the security
boundary. Treating middleware as the boundary is how apps ship IDOR bugs.

### Metrics

All arithmetic lives in `src/domain/metrics.ts` and returns `number | null`.
`null` means "nothing recorded yet" and renders as `—`. A child with no
attendance recorded must never be shown as 0%, which reads to a parent as "my
child attended nothing".

Engagement is event-sourced (`EngagementLog`) rather than stored as a mutable
score, so the number is always explainable: it is the sum of dated observations
inside a 30-day window, on a neutral baseline of 50.

### Notifications

`NOTIFICATION_CHANNEL` selects an adapter in
`src/server/notifications/adapters.ts`:

| Channel | Behaviour |
|---|---|
| `CONSOLE` | Logs instead of sending. The default, so no real parent is messaged from a dev machine. |
| `WEBHOOK` | POSTs the message to `NOTIFICATION_WEBHOOK_URL`. |
| `WHATSAPP` | Meta WhatsApp Cloud API, using an approved template. |
| `EMAIL` | Declared but not implemented; fails loudly rather than silently. |

Delivery retries with backoff (1m, 5m, 30m, 2h) and parks a message as `DEAD`
after five attempts. Drain the queue with `npm run notifications:dispatch`, or
schedule `GET /api/cron/notifications` with a `Bearer $CRON_SECRET` header.

---

## Testing

```bash
npm test
```

104 tests covering the domain layer and the security-critical primitives —
metrics, risk rules, message composition, date keys, password hashing, the
authorization boundaries, and the administration rules (seat limits, email
uniqueness, role gates, password change). The last two groups run against a real
database; the administration suite creates its own throwaway centre and deletes
it afterwards, so it leaves no trace.

The suite deliberately targets the places where a regression is silent. A wrong
percentage looks plausible; a broken authorization rule looks like nothing at
all. Several metric tests are labelled `REGRESSION` because they lock in
defects found in the original prototype — a 30/25 score rendering as 120%, a
blank total producing "avg 1800%", and an empty record set reading as 0%.

## Conventions

- Server actions used by one route live beside that route; actions called from a
  shared component live in `src/server/actions/`.
- Every mutation input is parsed with Zod at the service boundary. Server
  Actions are public HTTP endpoints — the calling form guarantees nothing.
- Every module opens with a header stating its purpose, responsibility and
  dependencies.
- Comments explain *why*, not *what*.

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the SQLite → PostgreSQL switch,
hosting, cron and the production checklist.

## Scope of v1

Deliberately **not** built yet, and why:

- **Billing.** Seat usage is tracked and shown; payment integration waits until
  a pilot proves centres keep logging past week three.
- **File uploads.** Assignments record an attachment *name*. Storing files for
  minors needs a retention policy, scanning and signed URLs — worth building,
  not worth faking.
- **Email.** There is no transactional email, so staff and guardian accounts are
  created with a generated temporary password the owner hands over. Invite links
  and password reset both need email first.
- **Session revocation.** Sessions are stateless JWTs and cannot be revoked
  before expiry. Adding a `sessionVersion` column to `User` and asserting it in
  `getSession` is the fix; no call site changes.
- **Editing after creation.** Students, staff and batches can be created and
  deactivated, but not renamed. Straightforward to add; not yet needed to run a
  centre end to end.

`docs/legacy/EduTrackMVP.jsx` is the original single-file clickable prototype,
kept for reference.
