/**
 * MODULE: Health check
 *
 * Purpose        Tell a load balancer or uptime monitor whether this instance
 *                can actually serve traffic.
 * Responsibility One trivial database round-trip, plus queue depth.
 *
 * WHY IT TOUCHES THE DATABASE
 *  A health check that only proves the Node process is alive will happily
 *  report "healthy" while every request 500s on a dead connection pool. The
 *  query is deliberately the cheapest one possible.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { NOTIFICATION_STATUS } from "@/domain/enums";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [, pendingNotifications, deadNotifications] = await Promise.all([
      db.$queryRaw`SELECT 1`,
      db.notificationOutbox.count({
        where: { status: { in: [NOTIFICATION_STATUS.PENDING, NOTIFICATION_STATUS.FAILED] } },
      }),
      db.notificationOutbox.count({ where: { status: NOTIFICATION_STATUS.DEAD } }),
    ]);

    return NextResponse.json({
      status: "ok",
      time: new Date().toISOString(),
      queue: { pending: pendingNotifications, dead: deadNotifications },
    });
  } catch (error) {
    logger.error("health.failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ status: "degraded" }, { status: 503 });
  }
}
