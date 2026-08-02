/**
 * MODULE: Parent-facing queries and actions
 *
 * Purpose        The parent app: my children, and acknowledging what I've read.
 * Responsibility Reads scoped strictly to linked children, plus the one write a
 *                parent is permitted to make.
 * Dependencies   @/lib/db, rbac, progress service, domain.
 *
 * ACKNOWLEDGEMENT IS THE PRODUCT'S FEEDBACK LOOP
 *  It is the only signal that tells a centre whether the updates they send are
 *  actually being read. `81% parent engagement` on the owner's dashboard is
 *  computed from these rows — in the prototype it was a hardcoded string.
 */

import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth/session";
import { accessibleStudentIds, requireParent } from "@/lib/auth/rbac";
import type { TimelineKind } from "@/domain/enums";
import { acknowledgeSchema, parseOrThrow } from "../schemas";
import { getProgressFor, type StudentProgress } from "./progress.service";
import { recordAudit } from "./audit.service";

export interface ChildSummary {
  id: string;
  fullName: string;
  avatarColor: string;
  batchName: string | null;
  progress: StudentProgress;
  lastEntryBody: string | null;
  lastEntryKind: TimelineKind | null;
  lastEntryAt: Date | null;
  unreadCount: number;
}

/** Every child linked to the signed-in parent, with a one-line status. */
export async function listChildren(session: SessionUser): Promise<ChildSummary[]> {
  requireParent(session);

  const studentIds = await accessibleStudentIds(session);
  if (studentIds.length === 0) return [];

  const [students, progressByStudent, latestEntries, unreadCounts] = await Promise.all([
    db.student.findMany({
      where: { id: { in: studentIds } },
      select: {
        id: true,
        fullName: true,
        avatarColor: true,
        enrollments: {
          where: { isActive: true },
          select: { batch: { select: { name: true } } },
          orderBy: { joinedAt: "asc" },
          take: 1,
        },
      },
      orderBy: { fullName: "asc" },
    }),
    getProgressFor(studentIds),
    db.timelineEntry.findMany({
      where: { studentId: { in: studentIds } },
      select: { studentId: true, body: true, kind: true, occurredAt: true },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      // Enough rows to guarantee the newest entry for each child is present.
      take: studentIds.length * 20,
    }),
    db.timelineEntry.groupBy({
      by: ["studentId"],
      where: { studentId: { in: studentIds }, acknowledgedAt: null },
      _count: { _all: true },
    }),
  ]);

  const latestByStudent = new Map<string, (typeof latestEntries)[number]>();
  for (const entry of latestEntries) {
    if (!latestByStudent.has(entry.studentId)) latestByStudent.set(entry.studentId, entry);
  }

  const unreadByStudent = new Map(
    unreadCounts.map((row) => [row.studentId, row._count._all]),
  );

  return students.map((student) => {
    const latest = latestByStudent.get(student.id);

    return {
      id: student.id,
      fullName: student.fullName,
      avatarColor: student.avatarColor,
      batchName: student.enrollments[0]?.batch.name ?? null,
      progress: progressByStudent.get(student.id)!,
      lastEntryBody: latest?.body ?? null,
      lastEntryKind: (latest?.kind as TimelineKind | undefined) ?? null,
      lastEntryAt: latest?.occurredAt ?? null,
      unreadCount: unreadByStudent.get(student.id) ?? 0,
    };
  });
}

/**
 * Mark one timeline entry as read by this parent.
 * Idempotent: acknowledging twice keeps the first timestamp, which is the one
 * that matters for "when did they see it?".
 */
export async function acknowledgeEntry(
  session: SessionUser,
  rawInput: unknown,
): Promise<{ acknowledgedAt: Date }> {
  requireParent(session);
  const input = parseOrThrow(acknowledgeSchema, rawInput);

  // The join through ParentLink is the authorization check: an entry belonging
  // to another family simply does not match, and reads as not found.
  const entry = await db.timelineEntry.findFirst({
    where: {
      id: input.timelineEntryId,
      centreId: session.centreId,
      student: { guardians: { some: { parentId: session.userId } } },
    },
    select: { id: true, studentId: true, acknowledgedAt: true },
  });

  if (!entry) throw new NotFoundError("That update is not available to you.");
  if (entry.acknowledgedAt) return { acknowledgedAt: entry.acknowledgedAt };

  const acknowledgedAt = new Date();

  await db.$transaction(async (tx) => {
    await tx.timelineEntry.update({
      where: { id: entry.id },
      data: { acknowledgedAt, acknowledgedById: session.userId },
    });

    await recordAudit(tx, {
      centreId: session.centreId,
      actorId: session.userId,
      action: "timeline.acknowledged",
      targetType: "TimelineEntry",
      targetId: entry.id,
      metadata: { studentId: entry.studentId },
    });
  });

  return { acknowledgedAt };
}

/** Acknowledge every outstanding entry for one child in a single tap. */
export async function acknowledgeAllForStudent(
  session: SessionUser,
  studentId: string,
): Promise<{ acknowledged: number }> {
  requireParent(session);

  const result = await db.timelineEntry.updateMany({
    where: {
      studentId,
      centreId: session.centreId,
      acknowledgedAt: null,
      student: { guardians: { some: { parentId: session.userId } } },
    },
    data: { acknowledgedAt: new Date(), acknowledgedById: session.userId },
  });

  return { acknowledged: result.count };
}
