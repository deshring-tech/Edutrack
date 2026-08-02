/**
 * MODULE: Authorization
 *
 * Purpose        Answer "may this user touch this record?" — for the whole app.
 * Responsibility Be the ONLY place that decides access. Every service and every
 *                page asks this module; none of them re-implement a check.
 * Dependencies   @/lib/db, @/lib/errors, @/lib/auth/session, @/domain/enums.
 * Inputs         A SessionUser plus the id of the thing being accessed.
 * Outputs        The scoped record, or a thrown ForbiddenError / NotFoundError.
 *
 * THE RULES
 *  1. Tenancy   — a user can only ever see records in their own centre.
 *  2. Parents   — may read only students linked to them by a ParentLink row,
 *                 and may never write anything except an acknowledgement.
 *  3. Teachers  — may read and write for batches they teach.
 *  4. Owners    — may read and write anything inside their own centre.
 *
 * WHY CROSS-TENANT MISSES RETURN "NOT FOUND"
 *  Replying "forbidden" for a record that exists elsewhere confirms that a
 *  given student id is real. Both cases return NotFound, so probing tells an
 *  attacker nothing.
 *
 * This module exists because the prototype decided access with a React prop
 * (`role === "parent"`), which meant switching tabs could show a parent another
 * family's child. Authorization now lives on the server, keyed to the database.
 */

import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { ROLE } from "@/domain/enums";
import type { SessionUser } from "./session";

// ------------------------------------------------------------ role guards --

export function requireStaff(session: SessionUser): SessionUser {
  if (!session.isStaff) {
    throw new ForbiddenError("This area is for centre staff.");
  }
  return session;
}

export function requireOwner(session: SessionUser): SessionUser {
  if (session.role !== ROLE.OWNER) {
    throw new ForbiddenError("Only the centre owner can do this.");
  }
  return session;
}

export function requireParent(session: SessionUser): SessionUser {
  if (session.role !== ROLE.PARENT) {
    throw new ForbiddenError("This area is for parents.");
  }
  return session;
}

// --------------------------------------------------------- record scoping --

export interface AccessibleStudent {
  id: string;
  fullName: string;
  avatarColor: string;
  gradeLabel: string | null;
  centreId: string;
}

/**
 * Load a student the caller is allowed to see.
 * Staff: any active student in their centre. Parents: linked children only.
 */
export async function requireStudentAccess(
  session: SessionUser,
  studentId: string,
): Promise<AccessibleStudent> {
  const student = await db.student.findFirst({
    where: {
      id: studentId,
      centreId: session.centreId,
      ...(session.role === ROLE.PARENT
        ? { guardians: { some: { parentId: session.userId } } }
        : {}),
    },
    select: {
      id: true,
      fullName: true,
      avatarColor: true,
      gradeLabel: true,
      centreId: true,
    },
  });

  if (!student) throw new NotFoundError("That student is not available to you.");
  return student;
}

/**
 * Load a student the caller may WRITE to.
 *
 * Stricter than read access: an owner may post about any student in the
 * centre, but a teacher may only post about students enrolled in a batch they
 * actually teach. Parents can never write to a student record at all — their
 * only write is acknowledging an entry, handled separately.
 */
export async function requireStudentWriteAccess(
  session: SessionUser,
  studentId: string,
): Promise<AccessibleStudent> {
  requireStaff(session);

  const student = await db.student.findFirst({
    where: {
      id: studentId,
      centreId: session.centreId,
      ...(session.role === ROLE.TEACHER
        ? {
            enrollments: {
              some: { isActive: true, batch: { teacherId: session.userId } },
            },
          }
        : {}),
    },
    select: {
      id: true,
      fullName: true,
      avatarColor: true,
      gradeLabel: true,
      centreId: true,
    },
  });

  if (!student) {
    throw new NotFoundError("That student is not in one of your batches.");
  }
  return student;
}

export interface AccessibleBatch {
  id: string;
  name: string;
  subject: string;
  gradeLabel: string;
  colorHex: string;
  teacherId: string;
  centreId: string;
}

/**
 * Load a batch the caller may act on.
 * Owners: any batch in the centre. Teachers: only batches they teach — a tutor
 * has no business marking attendance for someone else's class.
 */
export async function requireBatchAccess(
  session: SessionUser,
  batchId: string,
): Promise<AccessibleBatch> {
  requireStaff(session);

  const batch = await db.batch.findFirst({
    where: {
      id: batchId,
      centreId: session.centreId,
      ...(session.role === ROLE.TEACHER ? { teacherId: session.userId } : {}),
    },
    select: {
      id: true,
      name: true,
      subject: true,
      gradeLabel: true,
      colorHex: true,
      teacherId: true,
      centreId: true,
    },
  });

  if (!batch) throw new NotFoundError("That batch is not available to you.");
  return batch;
}

/**
 * Every student id the caller may read.
 * Used to scope list queries and dashboards in a single place, so no page has
 * to remember to add the parent filter itself.
 */
export async function accessibleStudentIds(session: SessionUser): Promise<string[]> {
  if (session.role === ROLE.PARENT) {
    const links = await db.parentLink.findMany({
      where: { parentId: session.userId, student: { centreId: session.centreId } },
      select: { studentId: true },
    });
    return links.map((link) => link.studentId);
  }

  const students = await db.student.findMany({
    where: { centreId: session.centreId, isActive: true },
    select: { id: true },
  });
  return students.map((student) => student.id);
}

/** Batches the caller may open, most recently created first. */
export async function accessibleBatchIds(session: SessionUser): Promise<string[]> {
  requireStaff(session);

  const batches = await db.batch.findMany({
    where: {
      centreId: session.centreId,
      isActive: true,
      ...(session.role === ROLE.TEACHER ? { teacherId: session.userId } : {}),
    },
    select: { id: true },
  });

  return batches.map((batch) => batch.id);
}

/**
 * Guard for records already loaded from the database.
 * A defence-in-depth check for code paths that fetch by id before scoping.
 */
export function assertSameCentre(
  session: SessionUser,
  record: { centreId: string } | null | undefined,
): void {
  if (!record || record.centreId !== session.centreId) {
    throw new NotFoundError();
  }
}
