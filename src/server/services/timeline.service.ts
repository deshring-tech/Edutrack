/**
 * MODULE: Timeline publishing
 *
 * Purpose        The single write path from "a teacher logged something" to
 *                "the right parents were told".
 * Responsibility Fan one teacher action out into per-student timeline entries
 *                and per-guardian notifications, idempotently and atomically.
 * Dependencies   @/lib/db, @/lib/env, @/domain/*, ../notifications/outbox.
 * Inputs         A batch of composed entries, plus the open transaction.
 * Outputs        Counts of what was created, updated and queued.
 *
 * THIS IS THE MODULE THE PROTOTYPE WAS MISSING.
 *  The demo's batch screen showed "22 parents notified" and did nothing. Every
 *  logging service now funnels through `publishEntries`, so there is exactly
 *  one implementation of fan-out to get right, test, and reason about.
 *
 * IDEMPOTENCY
 *  Entries are keyed by (sourceType, sourceId, studentId). Re-saving a batch
 *  form therefore updates in place instead of duplicating. A notification is
 *  queued only when the entry is new or its wording actually changed — so
 *  correcting one student's mark does not re-notify the other twenty-one.
 */

import type { TransactionClient } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { TimelineKind, TimelineSource } from "@/domain/enums";
import { enqueueNotifications, type OutboxEntry } from "../notifications/outbox";

export interface PublishableEntry {
  studentId: string;
  kind: TimelineKind;
  body: string;
  sourceType: TimelineSource;
  /** Id of the row that caused this entry — completes the idempotency key. */
  sourceId: string;
}

export interface PublishInput {
  centreId: string;
  authorId: string;
  batchId: string | null;
  occurredAt: Date;
  /** Heading shown in the notification, e.g. "Homework · Grade 7 Math". */
  title: string;
  entries: readonly PublishableEntry[];
}

export interface PublishResult {
  created: number;
  updated: number;
  unchanged: number;
  notificationsQueued: number;
}

export async function publishEntries(
  tx: TransactionClient,
  input: PublishInput,
): Promise<PublishResult> {
  const result: PublishResult = {
    created: 0,
    updated: 0,
    unchanged: 0,
    notificationsQueued: 0,
  };

  if (input.entries.length === 0) return result;

  const studentIds = [...new Set(input.entries.map((entry) => entry.studentId))];

  // One query for every student and guardian involved, rather than N per row.
  const students = await tx.student.findMany({
    where: { id: { in: studentIds }, centreId: input.centreId },
    select: {
      id: true,
      fullName: true,
      guardians: {
        select: {
          parent: {
            select: { id: true, fullName: true, email: true, phone: true, isActive: true },
          },
        },
      },
    },
  });

  const studentsById = new Map(students.map((student) => [student.id, student]));
  const outbox: OutboxEntry[] = [];

  for (const entry of input.entries) {
    const student = studentsById.get(entry.studentId);

    // Skip silently rather than throw: one student removed mid-save must not
    // roll back attendance for the whole class.
    if (!student) {
      logger.warn("timeline.publish.unknown_student", { studentId: entry.studentId });
      continue;
    }

    const existing = await tx.timelineEntry.findUnique({
      where: {
        sourceType_sourceId_studentId: {
          sourceType: entry.sourceType,
          sourceId: entry.sourceId,
          studentId: entry.studentId,
        },
      },
      select: { id: true, body: true },
    });

    if (existing && existing.body === entry.body) {
      result.unchanged += 1;
      continue;
    }

    const persisted = existing
      ? await tx.timelineEntry.update({
          where: { id: existing.id },
          data: {
            body: entry.body,
            kind: entry.kind,
            occurredAt: input.occurredAt,
            authorId: input.authorId,
            // A corrected update is new information; the parent must see it again.
            acknowledgedAt: null,
            acknowledgedById: null,
          },
          select: { id: true },
        })
      : await tx.timelineEntry.create({
          data: {
            centreId: input.centreId,
            studentId: entry.studentId,
            batchId: input.batchId,
            kind: entry.kind,
            body: entry.body,
            authorId: input.authorId,
            occurredAt: input.occurredAt,
            sourceType: entry.sourceType,
            sourceId: entry.sourceId,
          },
          select: { id: true },
        });

    if (existing) result.updated += 1;
    else result.created += 1;

    for (const guardian of student.guardians) {
      if (!guardian.parent.isActive) continue;

      outbox.push({
        centreId: input.centreId,
        recipientId: guardian.parent.id,
        studentId: student.id,
        timelineEntryId: persisted.id,
        message: {
          recipientName: guardian.parent.fullName,
          recipientEmail: guardian.parent.email,
          recipientPhone: guardian.parent.phone,
          studentName: student.fullName,
          title: input.title,
          body: entry.body,
          url: `${env.APP_URL}/app/children/${student.id}`,
        },
      });
    }
  }

  result.notificationsQueued = await enqueueNotifications(tx, outbox);
  return result;
}
