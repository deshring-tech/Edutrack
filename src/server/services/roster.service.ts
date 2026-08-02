/**
 * MODULE: Roster access
 *
 * Purpose        Answer "who is actually in this batch right now?".
 * Responsibility A single enrollment lookup, shared by every logging service.
 * Dependencies   @/lib/db.
 *
 * WHY IT IS SHARED
 *  Every save must reject student ids that are not enrolled in the batch being
 *  logged. Without one place to ask, that check gets written three times and
 *  forgotten in the fourth service — which is a cross-batch write primitive
 *  handed to anyone who can edit a form field.
 */

import type { DbClient } from "@/lib/db";

export interface RosterMember {
  studentId: string;
  fullName: string;
  avatarColor: string;
}

export async function getActiveRoster(
  client: DbClient,
  batchId: string,
): Promise<RosterMember[]> {
  const enrollments = await client.enrollment.findMany({
    where: { batchId, isActive: true, student: { isActive: true } },
    select: {
      studentId: true,
      student: { select: { fullName: true, avatarColor: true } },
    },
    orderBy: { student: { fullName: "asc" } },
  });

  return enrollments.map((enrollment) => ({
    studentId: enrollment.studentId,
    fullName: enrollment.student.fullName,
    avatarColor: enrollment.student.avatarColor,
  }));
}

/**
 * Drop any submitted mark for a student who is not enrolled.
 * Filtering rather than throwing is deliberate: a student removed from the
 * batch while a teacher had the screen open must not block attendance for the
 * other twenty-one children.
 */
export function retainEnrolled<T extends { studentId: string }>(
  marks: readonly T[],
  roster: readonly RosterMember[],
): T[] {
  const enrolled = new Set(roster.map((member) => member.studentId));
  return marks.filter((mark) => enrolled.has(mark.studentId));
}
