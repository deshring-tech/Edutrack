/**
 * MODULE: Centre administration
 *
 * Purpose        Let a centre owner build and maintain their own centre —
 *                staff, students, guardians, batches and enrollment.
 * Responsibility Owner-only writes, seat enforcement, and the reads that back
 *                the admin screens.
 * Dependencies   db, rbac, credentials, schemas, audit service.
 *
 * WHY THIS MODULE EXISTS
 *  Without it the product is only usable with seeded data. Everything a centre
 *  needs to start from nothing lives here.
 *
 * EVERY FUNCTION IS OWNER-ONLY.
 *  Teachers log progress; they do not create accounts or move students between
 *  batches. Keeping the whole module behind `requireOwner` means there is one
 *  rule to verify rather than one per function.
 *
 * DEACTIVATION, NEVER DELETION
 *  A student's attendance history is the centre's record and a parent's
 *  evidence. Removing a student sets `isActive = false`, which frees a seat and
 *  hides them from rosters while leaving the history — and the audit trail —
 *  intact.
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { hashPassword } from "@/lib/auth/password";
import { avatarColorFor, generateTemporaryPassword } from "@/lib/auth/credentials";
import { requireOwner } from "@/lib/auth/rbac";
import type { SessionUser } from "@/lib/auth/session";
import { ROLE, type Role } from "@/domain/enums";
import {
  createBatchSchema,
  createStaffSchema,
  createStudentSchema,
  parseOrThrow,
  updateEnrollmentSchema,
} from "../schemas";
import { recordAudit } from "./audit.service";

// ------------------------------------------------------------------- staff --

export interface StaffMember {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  avatarColor: string;
  isActive: boolean;
  batchCount: number;
  lastLoginAt: Date | null;
}

export async function listStaff(session: SessionUser): Promise<StaffMember[]> {
  requireOwner(session);

  const users = await db.user.findMany({
    where: { centreId: session.centreId, role: { in: [ROLE.OWNER, ROLE.TEACHER] } },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      avatarColor: true,
      isActive: true,
      lastLoginAt: true,
      _count: { select: { batchesTaught: { where: { isActive: true } } } },
    },
    orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
  });

  return users.map((user) => ({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role as Role,
    avatarColor: user.avatarColor,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    batchCount: user._count.batchesTaught,
  }));
}

export interface CreatedAccount {
  fullName: string;
  email: string;
  /** Shown to the owner once, to hand over. Never stored in plain text. */
  temporaryPassword: string;
}

export async function createStaff(
  session: SessionUser,
  rawInput: unknown,
): Promise<CreatedAccount> {
  requireOwner(session);
  const input = parseOrThrow(createStaffSchema, rawInput);

  await assertEmailAvailable(input.email, "email");

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        centreId: session.centreId,
        email: input.email,
        passwordHash,
        fullName: input.fullName,
        role: input.role,
        phone: input.phone || null,
        avatarColor: avatarColorFor(input.fullName),
      },
      select: { id: true },
    });

    await recordAudit(tx, {
      centreId: session.centreId,
      actorId: session.userId,
      action: "staff.created",
      targetType: "User",
      targetId: user.id,
      metadata: { role: input.role },
    });
  });

  logger.info("staff.created", { centreId: session.centreId, role: input.role });
  return { fullName: input.fullName, email: input.email, temporaryPassword };
}

export async function setStaffActive(
  session: SessionUser,
  userId: string,
  isActive: boolean,
): Promise<{ fullName: string }> {
  requireOwner(session);

  // An owner who deactivates their own account locks the centre out of its own
  // administration, with nobody able to undo it.
  if (userId === session.userId && !isActive) {
    throw new ConflictError("You cannot deactivate your own account.");
  }

  const user = await db.user.findFirst({
    where: {
      id: userId,
      centreId: session.centreId,
      role: { in: [ROLE.OWNER, ROLE.TEACHER] },
    },
    select: { id: true, fullName: true },
  });

  if (!user) throw new NotFoundError("That staff member is not in your centre.");

  // A deactivated teacher must not be left owning live batches, or those
  // batches become unloggable with no obvious cause.
  if (!isActive) {
    const owned = await db.batch.count({
      where: { teacherId: userId, isActive: true },
    });
    if (owned > 0) {
      throw new ConflictError(
        `Reassign ${owned} batch${owned === 1 ? "" : "es"} to another teacher first.`,
      );
    }
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { isActive } });

    await recordAudit(tx, {
      centreId: session.centreId,
      actorId: session.userId,
      action: isActive ? "staff.reactivated" : "staff.deactivated",
      targetType: "User",
      targetId: userId,
    });
  });

  return { fullName: user.fullName };
}

// ---------------------------------------------------------------- students --

export interface AdminStudent {
  id: string;
  fullName: string;
  avatarColor: string;
  gradeLabel: string | null;
  isActive: boolean;
  batchNames: string[];
  guardians: { fullName: string; email: string }[];
}

export async function listStudents(session: SessionUser): Promise<AdminStudent[]> {
  requireOwner(session);

  const students = await db.student.findMany({
    where: { centreId: session.centreId },
    select: {
      id: true,
      fullName: true,
      avatarColor: true,
      gradeLabel: true,
      isActive: true,
      enrollments: {
        where: { isActive: true },
        select: { batch: { select: { name: true } } },
      },
      guardians: {
        select: { parent: { select: { fullName: true, email: true } } },
      },
    },
    orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
  });

  return students.map((student) => ({
    id: student.id,
    fullName: student.fullName,
    avatarColor: student.avatarColor,
    gradeLabel: student.gradeLabel,
    isActive: student.isActive,
    batchNames: student.enrollments.map((enrollment) => enrollment.batch.name),
    guardians: student.guardians.map((link) => link.parent),
  }));
}

export interface CreateStudentResult {
  studentId: string;
  fullName: string;
  /** Present only when a new guardian account was created alongside. */
  guardianAccount: CreatedAccount | null;
}

export async function createStudent(
  session: SessionUser,
  rawInput: unknown,
): Promise<CreateStudentResult> {
  requireOwner(session);
  const input = parseOrThrow(createStudentSchema, rawInput);

  await assertSeatAvailable(session.centreId);

  const guardianEmail = input.guardianEmail || null;
  if (guardianEmail) await assertEmailAvailable(guardianEmail, "guardianEmail");

  // The batch must belong to this centre, or a student could be enrolled into
  // another tenant's class.
  if (input.batchId) {
    const batch = await db.batch.findFirst({
      where: { id: input.batchId, centreId: session.centreId },
      select: { id: true },
    });
    if (!batch) throw new NotFoundError("That batch is not in your centre.");
  }

  const temporaryPassword = guardianEmail ? generateTemporaryPassword() : null;
  const guardianHash = temporaryPassword ? await hashPassword(temporaryPassword) : null;

  const studentId = await db.$transaction(async (tx) => {
    const student = await tx.student.create({
      data: {
        centreId: session.centreId,
        fullName: input.fullName,
        gradeLabel: input.gradeLabel || null,
        avatarColor: avatarColorFor(input.fullName),
      },
      select: { id: true },
    });

    if (input.batchId) {
      await tx.enrollment.create({
        data: { batchId: input.batchId, studentId: student.id },
      });
    }

    if (guardianEmail && guardianHash && input.guardianName) {
      const parent = await tx.user.create({
        data: {
          centreId: session.centreId,
          email: guardianEmail,
          passwordHash: guardianHash,
          fullName: input.guardianName,
          role: ROLE.PARENT,
          phone: input.guardianPhone || null,
          avatarColor: avatarColorFor(input.guardianName),
        },
        select: { id: true },
      });

      await tx.parentLink.create({
        data: { parentId: parent.id, studentId: student.id, isPrimary: true },
      });
    }

    await recordAudit(tx, {
      centreId: session.centreId,
      actorId: session.userId,
      action: "student.created",
      targetType: "Student",
      targetId: student.id,
      metadata: { batchId: input.batchId ?? null, guardianLinked: Boolean(guardianEmail) },
    });

    return student.id;
  });

  logger.info("student.created", { centreId: session.centreId });

  return {
    studentId,
    fullName: input.fullName,
    guardianAccount:
      guardianEmail && temporaryPassword && input.guardianName
        ? {
            fullName: input.guardianName,
            email: guardianEmail,
            temporaryPassword,
          }
        : null,
  };
}

export async function setStudentActive(
  session: SessionUser,
  studentId: string,
  isActive: boolean,
): Promise<{ fullName: string }> {
  requireOwner(session);

  const student = await db.student.findFirst({
    where: { id: studentId, centreId: session.centreId },
    select: { id: true, fullName: true, isActive: true },
  });

  if (!student) throw new NotFoundError("That student is not in your centre.");

  // Re-admitting a student consumes a seat again.
  if (isActive && !student.isActive) await assertSeatAvailable(session.centreId);

  await db.$transaction(async (tx) => {
    await tx.student.update({ where: { id: studentId }, data: { isActive } });

    // Enrollments follow the student: a withdrawn student must disappear from
    // the rosters teachers log against.
    await tx.enrollment.updateMany({ where: { studentId }, data: { isActive } });

    await recordAudit(tx, {
      centreId: session.centreId,
      actorId: session.userId,
      action: isActive ? "student.readmitted" : "student.withdrawn",
      targetType: "Student",
      targetId: studentId,
    });
  });

  return { fullName: student.fullName };
}

// ----------------------------------------------------------------- batches --

export interface TeacherOption {
  id: string;
  fullName: string;
}

export async function listTeacherOptions(
  session: SessionUser,
): Promise<TeacherOption[]> {
  requireOwner(session);

  return db.user.findMany({
    where: {
      centreId: session.centreId,
      isActive: true,
      role: { in: [ROLE.OWNER, ROLE.TEACHER] },
    },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });
}

export async function createBatch(
  session: SessionUser,
  rawInput: unknown,
): Promise<{ batchId: string; name: string }> {
  requireOwner(session);
  const input = parseOrThrow(createBatchSchema, rawInput);

  const teacher = await db.user.findFirst({
    where: {
      id: input.teacherId,
      centreId: session.centreId,
      isActive: true,
      role: { in: [ROLE.OWNER, ROLE.TEACHER] },
    },
    select: { id: true },
  });

  if (!teacher) {
    throw new ValidationError("Choose a teacher from your centre.", {
      teacherId: ["That teacher is not available"],
    });
  }

  const batchId = await db.$transaction(async (tx) => {
    const batch = await tx.batch.create({
      data: {
        centreId: session.centreId,
        name: input.name,
        subject: input.subject,
        gradeLabel: input.gradeLabel,
        teacherId: input.teacherId,
        colorHex: input.colorHex ?? avatarColorFor(input.name),
      },
      select: { id: true },
    });

    await recordAudit(tx, {
      centreId: session.centreId,
      actorId: session.userId,
      action: "batch.created",
      targetType: "Batch",
      targetId: batch.id,
      metadata: { teacherId: input.teacherId },
    });

    return batch.id;
  });

  logger.info("batch.created", { centreId: session.centreId });
  return { batchId, name: input.name };
}

export interface RosterEditorStudent {
  id: string;
  fullName: string;
  avatarColor: string;
  enrolled: boolean;
}

export interface RosterEditor {
  batchId: string;
  batchName: string;
  teacherName: string;
  students: RosterEditorStudent[];
  enrolledCount: number;
}

/** Every active student in the centre, flagged with whether they are enrolled. */
export async function getRosterEditor(
  session: SessionUser,
  batchId: string,
): Promise<RosterEditor> {
  requireOwner(session);

  const batch = await db.batch.findFirst({
    where: { id: batchId, centreId: session.centreId },
    select: {
      id: true,
      name: true,
      teacher: { select: { fullName: true } },
      enrollments: { where: { isActive: true }, select: { studentId: true } },
    },
  });

  if (!batch) throw new NotFoundError("That batch is not in your centre.");

  const enrolledIds = new Set(batch.enrollments.map((entry) => entry.studentId));

  const students = await db.student.findMany({
    where: { centreId: session.centreId, isActive: true },
    select: { id: true, fullName: true, avatarColor: true },
    orderBy: { fullName: "asc" },
  });

  return {
    batchId: batch.id,
    batchName: batch.name,
    teacherName: batch.teacher.fullName,
    enrolledCount: enrolledIds.size,
    students: students.map((student) => ({
      ...student,
      enrolled: enrolledIds.has(student.id),
    })),
  };
}

export async function setEnrollment(
  session: SessionUser,
  rawInput: unknown,
): Promise<{ enrolled: boolean; fullName: string }> {
  requireOwner(session);
  const input = parseOrThrow(updateEnrollmentSchema, rawInput);

  const [batch, student] = await Promise.all([
    db.batch.findFirst({
      where: { id: input.batchId, centreId: session.centreId },
      select: { id: true },
    }),
    db.student.findFirst({
      where: { id: input.studentId, centreId: session.centreId },
      select: { id: true, fullName: true },
    }),
  ]);

  if (!batch || !student) {
    throw new NotFoundError("That batch or student is not in your centre.");
  }

  await db.$transaction(async (tx) => {
    // Upsert rather than create/delete: re-enrolling a student who left keeps
    // the original row, so their earlier attendance stays attached to it.
    await tx.enrollment.upsert({
      where: {
        batchId_studentId: { batchId: input.batchId, studentId: input.studentId },
      },
      create: {
        batchId: input.batchId,
        studentId: input.studentId,
        isActive: input.enrolled,
      },
      update: {
        isActive: input.enrolled,
        leftAt: input.enrolled ? null : new Date(),
      },
    });

    await recordAudit(tx, {
      centreId: session.centreId,
      actorId: session.userId,
      action: input.enrolled ? "enrollment.added" : "enrollment.removed",
      targetType: "Student",
      targetId: input.studentId,
      metadata: { batchId: input.batchId },
    });
  });

  return { enrolled: input.enrolled, fullName: student.fullName };
}

// ----------------------------------------------------------------- helpers --

export interface SeatUsage {
  used: number;
  limit: number;
  remaining: number;
}

export async function getSeatUsage(session: SessionUser): Promise<SeatUsage> {
  const [used, centre] = await Promise.all([
    db.student.count({ where: { centreId: session.centreId, isActive: true } }),
    db.centre.findUniqueOrThrow({
      where: { id: session.centreId },
      select: { seatLimit: true },
    }),
  ]);

  return {
    used,
    limit: centre.seatLimit,
    remaining: Math.max(0, centre.seatLimit - used),
  };
}

/**
 * Seat limits are enforced here rather than at the UI, because the UI is not
 * the boundary — the plan a centre pays for has to mean something on the
 * server.
 */
async function assertSeatAvailable(centreId: string): Promise<void> {
  const [used, centre] = await Promise.all([
    db.student.count({ where: { centreId, isActive: true } }),
    db.centre.findUniqueOrThrow({
      where: { id: centreId },
      select: { seatLimit: true },
    }),
  ]);

  if (used >= centre.seatLimit) {
    throw new ConflictError(
      `Your plan covers ${centre.seatLimit} active students. Withdraw a student or upgrade to add more.`,
    );
  }
}

/**
 * Email is globally unique, so a clash may be with another centre entirely.
 * The message says only that the address is taken — confirming which centre
 * holds it would leak one customer's roster to another.
 */
async function assertEmailAvailable(email: string, field: string): Promise<void> {
  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    throw new ValidationError("That email address is already in use.", {
      [field]: ["Already registered"],
    });
  }
}
