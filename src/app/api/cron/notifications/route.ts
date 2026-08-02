/**
 * MODULE: Notification dispatch endpoint
 *
 * Purpose        Drain the notification outbox on a schedule.
 * Responsibility Authenticate the caller, run one dispatch pass, report counts.
 * Dependencies   outbox dispatcher, env.
 *
 * AUTHENTICATION
 *  Guarded by a shared secret compared in constant time. This endpoint can send
 *  real messages to real parents; leaving it open would let anyone on the
 *  internet drain the queue, and timing-unsafe comparison would leak the secret
 *  a byte at a time.
 *
 * SCHEDULING
 *  On Vercel, add to vercel.json:
 *    { "crons": [{ "path": "/api/cron/notifications", "schedule": "*\/2 * * * *" }] }
 *  Elsewhere, call `npm run notifications:dispatch` from a system cron.
 */

import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { dispatchPending } from "@/server/notifications/outbox";

export const dynamic = "force-dynamic";

/** How many messages one invocation will attempt. Keeps runtime bounded. */
const BATCH_SIZE = 100;

function isAuthorised(request: NextRequest): boolean {
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : header;

  const expectedBytes = Buffer.from(env.CRON_SECRET);
  const providedBytes = Buffer.from(provided);

  // timingSafeEqual throws on length mismatch, so compare lengths first.
  if (expectedBytes.length !== providedBytes.length) return false;
  return timingSafeEqual(expectedBytes, providedBytes);
}

export async function POST(request: NextRequest) {
  if (!isAuthorised(request)) {
    logger.warn("cron.notifications.unauthorised");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await dispatchPending(BATCH_SIZE);
  return NextResponse.json({ status: "ok", ...summary });
}

/** Vercel Cron issues GET requests; behaviour is identical. */
export async function GET(request: NextRequest) {
  return POST(request);
}
