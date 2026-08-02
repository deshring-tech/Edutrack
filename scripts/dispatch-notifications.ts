/**
 * MODULE: Notification dispatcher CLI
 *
 * Purpose        Drain the notification outbox from a system cron or a manual
 *                run, without going through HTTP.
 * Responsibility Invoke the dispatcher once and report the outcome.
 *
 * Usage
 *   npm run notifications:dispatch
 *
 * The HTTP equivalent is `/api/cron/notifications`, used on platforms with
 * managed cron (Vercel). Both call the same `dispatchPending`, so behaviour
 * cannot diverge between deployment styles.
 */

import { db } from "../src/lib/db";
import { dispatchPending } from "../src/server/notifications/outbox";

const BATCH_SIZE = 200;

async function main() {
  const summary = await dispatchPending(BATCH_SIZE);

  console.log(
    `claimed ${summary.claimed} · delivered ${summary.delivered} · retrying ${summary.failed} · dead ${summary.dead}`,
  );

  // A non-zero exit makes a cron wrapper surface the problem instead of
  // silently succeeding while messages pile up.
  if (summary.dead > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("Dispatch failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
