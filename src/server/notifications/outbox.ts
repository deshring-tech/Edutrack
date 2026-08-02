/**
 * MODULE: Notification outbox
 *
 * Purpose        Guarantee that every update a teacher saves reaches the parent
 *                exactly once, even when the delivery vendor is down.
 * Responsibility Queue writes (inside the caller's transaction) and queue
 *                draining (outside it, with retries).
 * Dependencies   @/lib/db, @/lib/logger, ./adapters, ./types.
 *
 * THE TRANSACTIONAL OUTBOX PATTERN
 *  The naive approach — save the record, then call WhatsApp — has two failure
 *  modes that both hurt: the API call fails and the parent is never told, or
 *  the transaction rolls back after the message was already sent and the parent
 *  is told about something that did not happen.
 *
 *  Instead, `enqueue` writes the intent to send in the SAME transaction as the
 *  data. Either both land or neither does. A separate dispatcher then delivers
 *  them with retries and exponential backoff.
 *
 * SCALING NOTE
 *  `dispatchPending` claims rows with a read-then-update. That is safe for a
 *  single dispatcher, which is the deployment today (one cron trigger). Running
 *  several dispatchers concurrently on PostgreSQL requires claiming rows with
 *  `SELECT ... FOR UPDATE SKIP LOCKED`; the surrounding code does not change.
 */

import { db, type DbClient } from "@/lib/db";
import { logger } from "@/lib/logger";
import { NOTIFICATION_STATUS } from "@/domain/enums";
import { getNotificationAdapter } from "./adapters";
import type { NotificationMessage } from "./types";

/** Attempts before a message is parked as DEAD for a human to look at. */
export const MAX_DELIVERY_ATTEMPTS = 5;

/** Backoff per attempt number: 1m, 5m, 30m, 2h. Index = attempts already made. */
const BACKOFF_MINUTES = [1, 5, 30, 120] as const;

export interface OutboxEntry {
  centreId: string;
  recipientId: string;
  studentId: string;
  timelineEntryId: string;
  message: NotificationMessage;
}

/**
 * Queue notifications. MUST be called with the same transaction client that
 * wrote the underlying records — that is the entire point of the pattern.
 */
export async function enqueueNotifications(
  client: DbClient,
  entries: readonly OutboxEntry[],
): Promise<number> {
  if (entries.length === 0) return 0;

  const channel = getNotificationAdapter().channel;

  await client.notificationOutbox.createMany({
    data: entries.map((entry) => ({
      centreId: entry.centreId,
      recipientId: entry.recipientId,
      studentId: entry.studentId,
      timelineEntryId: entry.timelineEntryId,
      channel,
      payload: JSON.stringify(entry.message),
      status: NOTIFICATION_STATUS.PENDING,
    })),
  });

  return entries.length;
}

export interface DispatchSummary {
  claimed: number;
  delivered: number;
  failed: number;
  dead: number;
}

/**
 * Deliver queued notifications. Safe to call repeatedly; safe to call when the
 * queue is empty. Returns a summary suitable for logging or a health endpoint.
 */
export async function dispatchPending(limit = 50): Promise<DispatchSummary> {
  const adapter = getNotificationAdapter();
  const now = new Date();

  const due = await db.notificationOutbox.findMany({
    where: {
      status: { in: [NOTIFICATION_STATUS.PENDING, NOTIFICATION_STATUS.FAILED] },
      availableAt: { lte: now },
    },
    orderBy: { availableAt: "asc" },
    take: limit,
  });

  const summary: DispatchSummary = {
    claimed: due.length,
    delivered: 0,
    failed: 0,
    dead: 0,
  };

  for (const record of due) {
    const message = parsePayload(record.payload);

    if (!message) {
      // Unreadable payload can never succeed — park it rather than retry.
      await db.notificationOutbox.update({
        where: { id: record.id },
        data: {
          status: NOTIFICATION_STATUS.DEAD,
          lastError: "Malformed payload",
          attempts: record.attempts + 1,
        },
      });
      summary.dead += 1;
      continue;
    }

    const result = await adapter.send(message);
    const attempts = record.attempts + 1;

    if (result.delivered) {
      await db.notificationOutbox.update({
        where: { id: record.id },
        data: {
          status: NOTIFICATION_STATUS.SENT,
          sentAt: new Date(),
          attempts,
          lastError: null,
        },
      });
      summary.delivered += 1;
      continue;
    }

    const exhausted = !result.retryable || attempts >= MAX_DELIVERY_ATTEMPTS;

    await db.notificationOutbox.update({
      where: { id: record.id },
      data: {
        status: exhausted ? NOTIFICATION_STATUS.DEAD : NOTIFICATION_STATUS.FAILED,
        attempts,
        lastError: result.error ?? "Delivery failed",
        availableAt: exhausted ? record.availableAt : nextAttemptAt(attempts),
      },
    });

    if (exhausted) {
      summary.dead += 1;
      logger.error("notification.dead", {
        outboxId: record.id,
        attempts,
        error: result.error,
      });
    } else {
      summary.failed += 1;
    }
  }

  if (summary.claimed > 0) logger.info("notifications.dispatched", { ...summary });
  return summary;
}

function nextAttemptAt(attempts: number): Date {
  const minutes = BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)] ?? 120;
  return new Date(Date.now() + minutes * 60_000);
}

function parsePayload(raw: string): NotificationMessage | null {
  try {
    const parsed = JSON.parse(raw) as NotificationMessage;
    return typeof parsed?.body === "string" ? parsed : null;
  } catch {
    return null;
  }
}
