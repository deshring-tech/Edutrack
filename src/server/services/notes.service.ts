/**
 * MODULE: Notes, assignments and engagement
 *
 * Purpose        The one-to-one and batch-wide messages a teacher sends outside
 *                the daily attendance/homework rhythm.
 * Responsibility Validate, authorise, persist and publish — atomically.
 * Dependencies   db, rbac, schemas, roster/timeline/audit services, domain.
 *
 * DESIGN NOTE
 *  Engagement is stored as a bounded, signed observation rather than a mutable
 *  score. The prototype let a teacher add +6 per tap with no ceiling and no
 *  way to record the opposite, so the number could only ever go up — which
 *  makes it worthless as a signal to a parent.
 */

import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";
import { requireBatchAccess, requireStudentWriteAccess } from "@/lib/auth/rbac";
import { formatDay, parseDateInputValue } from "@/domain/dates";
import { TIMELINE_SOURCE } from "@/domain/enums";
import { composeAssignment, composeEngagement, composeNote } from "@/domain/timeline";
import {
  logEngagementSchema,
  parseOrThrow,
  postAssignmentSchema,
  postNoteSchema,
} from "../schemas";
import { getActiveRoster } from "./roster.service";
import { publishEntries, type PublishableEntry } from "./timeline.service";
import { recordAudit } from "./audit.service";

const TRANSACTION_TIMEOUT_MS = 30_000;

/** A private note from a teacher to one child's guardians. */
export async function postNote(
  session: SessionUser,
  rawInput: unknown,
): Promise<{ notificationsQueued: number }> {
  const input = parseOrThrow(postNoteSchema, rawInput);
  const student = await requireStudentWriteAccess(session, input.studentId);
  const composed = composeNote(input.body);

  return db.$transaction(async (tx) => {
    // A note has no underlying record, so it is its own source: a fresh id per
    // note, which keeps every note distinct while still fitting the idempotency
    // key used by every other entry type.
    const sourceId = `${session.userId}:${Date.now()}`;

    const published = await publishEntries(tx, {
      centreId: session.centreId,
      authorId: session.userId,
      batchId: null,
      occurredAt: new Date(),
      title: `Message about ${student.fullName}`,
      entries: [
        {
          studentId: student.id,
          kind: composed.kind,
          body: composed.body,
          sourceType: TIMELINE_SOURCE.MANUAL_NOTE,
          sourceId,
        },
      ],
    });

    await recordAudit(tx, {
      centreId: session.centreId,
      actorId: session.userId,
      action: "note.posted",
      targetType: "Student",
      targetId: student.id,
    });

    return { notificationsQueued: published.notificationsQueued };
  });
}

export interface PostAssignmentResult {
  assignmentId: string;
  studentsNotified: number;
  notificationsQueued: number;
}

/** Publish one assignment to every enrolled student's timeline. */
export async function postAssignment(
  session: SessionUser,
  rawInput: unknown,
): Promise<PostAssignmentResult> {
  const input = parseOrThrow(postAssignmentSchema, rawInput);
  const batch = await requireBatchAccess(session, input.batchId);
  const dueDate = input.dueDate ? parseDateInputValue(input.dueDate) : null;

  return db.$transaction(
    async (tx) => {
      const roster = await getActiveRoster(tx, batch.id);

      const assignment = await tx.assignment.create({
        data: {
          batchId: batch.id,
          title: input.title,
          description: input.description ?? null,
          dueDate,
          attachmentName: input.attachmentName ?? null,
          createdById: session.userId,
        },
        select: { id: true },
      });

      const composed = composeAssignment({
        title: input.title,
        dueDate,
        attachmentName: input.attachmentName ?? null,
        formatDate: (date) => formatDay(date),
      });

      const entries: PublishableEntry[] = roster.map((member) => ({
        studentId: member.studentId,
        kind: composed.kind,
        body: composed.body,
        sourceType: TIMELINE_SOURCE.ASSIGNMENT,
        sourceId: assignment.id,
      }));

      const published = await publishEntries(tx, {
        centreId: session.centreId,
        authorId: session.userId,
        batchId: batch.id,
        occurredAt: new Date(),
        title: `Assignment · ${batch.name}`,
        entries,
      });

      await recordAudit(tx, {
        centreId: session.centreId,
        actorId: session.userId,
        action: "assignment.posted",
        targetType: "Assignment",
        targetId: assignment.id,
        metadata: { batchId: batch.id, studentsNotified: roster.length },
      });

      return {
        assignmentId: assignment.id,
        studentsNotified: roster.length,
        notificationsQueued: published.notificationsQueued,
      };
    },
    { timeout: TRANSACTION_TIMEOUT_MS },
  );
}

/** Record a positive or negative engagement observation for one student. */
export async function logEngagement(
  session: SessionUser,
  rawInput: unknown,
): Promise<{ notificationsQueued: number }> {
  const input = parseOrThrow(logEngagementSchema, rawInput);
  const student = await requireStudentWriteAccess(session, input.studentId);

  if (input.batchId) await requireBatchAccess(session, input.batchId);

  const composed = composeEngagement(input.delta, input.note);

  return db.$transaction(async (tx) => {
    const log = await tx.engagementLog.create({
      data: {
        studentId: student.id,
        batchId: input.batchId ?? null,
        delta: input.delta,
        note: input.note ?? null,
        authorId: session.userId,
      },
      select: { id: true },
    });

    const published = await publishEntries(tx, {
      centreId: session.centreId,
      authorId: session.userId,
      batchId: input.batchId ?? null,
      occurredAt: new Date(),
      title: `Class engagement · ${student.fullName}`,
      entries: [
        {
          studentId: student.id,
          kind: composed.kind,
          body: composed.body,
          sourceType: TIMELINE_SOURCE.ENGAGEMENT_LOG,
          sourceId: log.id,
        },
      ],
    });

    await recordAudit(tx, {
      centreId: session.centreId,
      actorId: session.userId,
      action: "engagement.logged",
      targetType: "Student",
      targetId: student.id,
      metadata: { delta: input.delta },
    });

    return { notificationsQueued: published.notificationsQueued };
  });
}
