/**
 * MODULE: PostgreSQL switch
 *
 * Purpose        Convert the project from its local SQLite setup to PostgreSQL
 *                for deployment, in one command.
 * Responsibility Rewrite the datasource block and clear the SQLite migration
 *                history. It touches nothing else.
 * Dependencies   node:fs only.
 *
 * Usage
 *   npm run db:use-postgres
 *
 * WHY THE MIGRATIONS ARE DELETED
 *  `prisma/migrations` holds SQLite DDL. Postgres cannot replay it — the types
 *  and constraint syntax differ — so a fresh initial migration has to be
 *  generated against the new provider. Nothing is lost: the schema is the
 *  source of truth and no production data exists yet.
 *
 *  Run this ONCE, before the first deploy. Afterwards the repo is a PostgreSQL
 *  project and migrations accumulate normally. Running it again on an already
 *  converted project is refused rather than silently wiping real migration
 *  history.
 *
 * WHY directUrl IS ADDED
 *  Serverless platforms open a connection per invocation and exhaust a direct
 *  Postgres connection limit quickly, so the app should talk to a pooler
 *  (PgBouncer, Neon's pooled endpoint). Migrations cannot run through a
 *  transaction pooler, so Prisma needs the direct endpoint separately. That is
 *  what `directUrl` is for.
 */

import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = join(projectRoot, "prisma", "schema.prisma");
const migrationsPath = join(projectRoot, "prisma", "migrations");

const POSTGRES_DATASOURCE = `datasource db {
  // PostgreSQL. \`url\` should be the POOLED connection string; \`directUrl\` the
  // direct one, which migrations need because they cannot run through a
  // transaction pooler. See docs/DEPLOYMENT.md.
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}`;

function main() {
  if (!existsSync(schemaPath)) {
    throw new Error(`Cannot find ${schemaPath}`);
  }

  const schema = readFileSync(schemaPath, "utf8");

  if (schema.includes('provider  = "postgresql"') || schema.includes('provider = "postgresql"')) {
    console.log("Already using PostgreSQL — nothing to do.");
    console.log("(Refusing to re-run: that would delete real migration history.)");
    return;
  }

  const datasourcePattern = /datasource\s+db\s*\{[\s\S]*?\n\}/;

  if (!datasourcePattern.test(schema)) {
    throw new Error("Could not locate the datasource block in prisma/schema.prisma");
  }

  writeFileSync(schemaPath, schema.replace(datasourcePattern, POSTGRES_DATASOURCE), "utf8");
  console.log("✔ prisma/schema.prisma now targets PostgreSQL");

  if (existsSync(migrationsPath)) {
    rmSync(migrationsPath, { recursive: true, force: true });
    console.log("✔ removed the SQLite migration history (it cannot replay on Postgres)");
  }

  console.log(`
Next steps
----------
1. Put your connection strings in .env (and in your host's environment):

     DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"   # pooled
     DIRECT_URL="postgresql://user:pass@host/db?sslmode=require"     # direct

   On Neon these are the "Pooled connection" and "Direct connection" strings.
   If your provider has no pooler, set both to the same value.

2. Create the initial migration:

     npx prisma migrate dev --name init

3. Optionally load demo data:

     npm run db:seed

4. Deploy. Your host should run:  npx prisma migrate deploy

Local development now needs that database too — SQLite is no longer used.
`);
}

try {
  main();
} catch (error) {
  console.error("Switch failed:", error.message ?? error);
  process.exit(1);
}
