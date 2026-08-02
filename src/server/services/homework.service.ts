/**
 * MODULE: Homework logging
 *
 * Purpose        Record each student's homework outcome for a day and tell
 *                their parents.
 * Responsibility Validate, authorise, persist and publish — atomically.
 * Dependencies   db, rbac, schemas, roster/timeline/audit services, domain.
 *
 * DESIGN NOTE
 *  One verdict per student, per batch, per day — see the note on
 *  `HomeworkRecord` in the schema. Linking to an Assignment is optional
 *  metadata, which lets a tutor log "today's work" without first creating a
 *  formal assignment, while still supporting assignment-linked tracking.
 */

import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth/session";
import { requireBatchAccess } from "@/lib/auth/rbac";
import { parseDateInputValue } from "@/domain/dates";
import { TIMELINE_SOURCE } from "@/domain/enums";
import { composeHomework } from "@/domain/timeline";
import { parseOrThrow, saveHomeworkSchema } from "../schemas";
import { getActiveRoster, retainEnrolled } from "./roster.service";
import { publishEntries, type PublishableEntry } from "./timeline.service";
import { recordAudit } from "./audit.service";

const TRANSACTION_TIMEOUT_MS = 30_000;

export interface SaveHomeworkResult {
  studentsRecorded: number;
  entriesCreated: number;
  entriesUpdated: number;
  notificationsQueued: number;
}

export async function saveBatchHomework(
  session: SessionUser,
  rawInput: unknown,
): Promise<SaveHomeworkResult> {
  const input = parseOrThrow(saveHomeworkSchema, rawInput);
  const batch = await requireBatchAccess(session, input.batchId);

  const recordedOn = parseDateInputValue(input.recordedOn);
  if (!recordedOn) {
    throw new ValidationError("That date is not valid.", {
      recordedOn: ["Enter a valid date"],
    });
  }

  return db.$transaction(
    async (tx) => {
      const roster = await getActiveRoster(tx, batch.id);
      const marks = retainEnrolled(input.marks, roster);

      if (marks.length === 0) {
        throw new ValidationError("None of those students are in this batch.");
      }

      // An assignment reference must belong to this batch, or a teacher could
      // attach another class's assignment to their students' records.
      let assignmentTitle: string | null = null;
      if (input.assignmentId) {
        const assignment = await tx.assignment.findFirst({
          where: { id: input.assignmentId, batchId: batch.id },
          select: { title: true },
        });
        if (!assignment) throw new NotFoundError("That assignment is not in this batch.");
        assignmentTitle = assignment.title;
      }

      const entries: PublishableEntry[] = [];

      for (const mark of marks) {
        const record = await tx.homeworkRecord.upsert({
          where: {
            batchId_studentId_recordedOn: {
              batchId: batch.id,
              studentId: mark.studentId,
              recordedOn,
            },
          },
          create: {
            batchId: batch.id,
            studentId: mark.studentId,
            assignmentId: input.assignmentId ?? null,
            recordedOn,
            status: mark.status,
            recordedById: session.userId,
          },
          update: {
            status: mark.status,
            assignmentId: input.assignmentId ?? null,
            recordedById: session.userId,
          },
          select: { id: true },
        });

        const composed = composeHomework(mark.status, assignmentTitle);
        entries.push({
          studentId: mark.studentId,
          kind: composed.kind,
          body: composed.body,
          sourceType: TIMELINE_SOURCE.HOMEWORK_RECORD,
          sourceId: record.id,
        });
      }

      const published = await publishEntries(tx, {
        centreId: session.centreId,
        authorId: session.userId,
        batchId: batch.id,
        occurredAt: recordedOn,
        title: `Homework · ${batch.name}`,
        entries,
      });

      await recordAudit(tx, {
        centreId: session.centreId,
        actorId: session.userId,
        action: "homework.saved",
        targetType: "Batch",
        targetId: batch.id,
        metadata: { recordedOn: input.recordedOn, studentsRecorded: marks.length },
      });

      return {
        studentsRecorded: marks.length,
        entriesCreated: published.created,
        entriesUpdated: published.updated,
        notificationsQueued: published.notificationsQueued,
      };
    },
    { timeout: TRANSACTION_TIMEOUT_MS },
  );
}

/** Existing homework marks for a batch on a day, so the form opens pre-filled. */
export async function getHomeworkForDay(
  session: SessionUser,
  batchId: string,
  recordedOn: Date,
): Promise<Map<string, string>> {
  await requireBatchAccess(session, batchId);

  const records = await db.homeworkRecord.findMany({
    where: { batchId, recordedOn },
    select: { studentId: true, status: true },
  });

  return new Map(records.map((record) => [record.studentId, record.status]));
}
