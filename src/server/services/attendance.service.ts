/**
 * MODULE: Attendance logging
 *
 * Purpose        Record who attended a batch session and tell their parents.
 * Responsibility Validate, authorise, persist and publish — atomically.
 * Dependencies   db, rbac, schemas, roster/timeline/audit services, domain.
 * Inputs         A SessionUser and one day's marks for one batch.
 * Outputs        A summary of what was saved and how many parents were queued.
 *
 * TRANSACTION BOUNDARY
 *  The class session, every attendance row, every timeline entry and every
 *  queued notification commit together or not at all. A teacher on a patchy
 *  connection can therefore retry safely: the unique keys make the second
 *  attempt an update, not a duplicate.
 */

import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth/session";
import { requireBatchAccess } from "@/lib/auth/rbac";
import { parseDateInputValue } from "@/domain/dates";
import { TIMELINE_SOURCE } from "@/domain/enums";
import { composeAttendance } from "@/domain/timeline";
import { parseOrThrow, saveAttendanceSchema } from "../schemas";
import { getActiveRoster, retainEnrolled } from "./roster.service";
import { publishEntries, type PublishableEntry } from "./timeline.service";
import { recordAudit } from "./audit.service";

/** SQLite is fast, but a 300-student batch is ~900 statements; give it room. */
const TRANSACTION_TIMEOUT_MS = 30_000;

export interface SaveAttendanceResult {
  sessionId: string;
  studentsMarked: number;
  entriesCreated: number;
  entriesUpdated: number;
  notificationsQueued: number;
}

export async function saveBatchAttendance(
  session: SessionUser,
  rawInput: unknown,
): Promise<SaveAttendanceResult> {
  const input = parseOrThrow(saveAttendanceSchema, rawInput);
  const batch = await requireBatchAccess(session, input.batchId);

  const sessionDate = parseDateInputValue(input.sessionDate);
  if (!sessionDate) throw new ValidationError("That date is not valid.", {
    sessionDate: ["Enter a valid date"],
  });

  if (sessionDate.getTime() > Date.now()) {
    throw new ValidationError("You cannot record attendance for a future date.", {
      sessionDate: ["Pick today or an earlier date"],
    });
  }

  return db.$transaction(
    async (tx) => {
      const roster = await getActiveRoster(tx, batch.id);
      const marks = retainEnrolled(input.marks, roster);

      if (marks.length === 0) {
        throw new ValidationError("None of those students are in this batch.");
      }

      const classSession = await tx.classSession.upsert({
        where: { batchId_sessionDate: { batchId: batch.id, sessionDate } },
        create: {
          batchId: batch.id,
          sessionDate,
          recordedById: session.userId,
        },
        update: { recordedById: session.userId },
        select: { id: true },
      });

      const entries: PublishableEntry[] = [];

      for (const mark of marks) {
        const record = await tx.attendanceRecord.upsert({
          where: {
            sessionId_studentId: {
              sessionId: classSession.id,
              studentId: mark.studentId,
            },
          },
          create: {
            sessionId: classSession.id,
            studentId: mark.studentId,
            status: mark.status,
          },
          update: { status: mark.status },
          select: { id: true },
        });

        const composed = composeAttendance(mark.status);
        entries.push({
          studentId: mark.studentId,
          kind: composed.kind,
          body: composed.body,
          sourceType: TIMELINE_SOURCE.ATTENDANCE_RECORD,
          sourceId: record.id,
        });
      }

      const published = await publishEntries(tx, {
        centreId: session.centreId,
        authorId: session.userId,
        batchId: batch.id,
        occurredAt: sessionDate,
        title: `Attendance · ${batch.name}`,
        entries,
      });

      await recordAudit(tx, {
        centreId: session.centreId,
        actorId: session.userId,
        action: "attendance.saved",
        targetType: "ClassSession",
        targetId: classSession.id,
        metadata: { batchId: batch.id, studentsMarked: marks.length },
      });

      return {
        sessionId: classSession.id,
        studentsMarked: marks.length,
        entriesCreated: published.created,
        entriesUpdated: published.updated,
        notificationsQueued: published.notificationsQueued,
      };
    },
    { timeout: TRANSACTION_TIMEOUT_MS },
  );
}

/** Existing marks for a batch on a day, so the form opens pre-filled. */
export async function getAttendanceForDay(
  session: SessionUser,
  batchId: string,
  sessionDate: Date,
): Promise<Map<string, string>> {
  await requireBatchAccess(session, batchId);

  const classSession = await db.classSession.findUnique({
    where: { batchId_sessionDate: { batchId, sessionDate } },
    select: { attendance: { select: { studentId: true, status: true } } },
  });

  return new Map(
    (classSession?.attendance ?? []).map((record) => [record.studentId, record.status]),
  );
}
