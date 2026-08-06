/**
 * Tests: centre administration
 *
 * Covers the rules that protect the business and the tenant boundary — seat
 * limits, email uniqueness, role gates and password changes.
 *
 * ISOLATION
 *  Each run creates its own throwaway centre with a unique id and deletes it
 *  afterwards. `Centre` cascades to everything beneath it, so the development
 *  database is left exactly as it was found. Emails are suffixed per run so
 *  concurrent or repeated runs cannot collide on the global unique index.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { ConflictError, ForbiddenError, ValidationError } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { ROLE } from "@/domain/enums";
import type { SessionUser } from "@/lib/auth/session";
import {
  createBatch,
  createStaff,
  createStudent,
  getSeatUsage,
  listStaff,
  setEnrollment,
  setStaffActive,
  setStudentActive,
} from "@/server/services/admin.service";
import { changeOwnPassword } from "@/server/services/account.service";

const RUN_ID = Math.random().toString(36).slice(2, 8);
const CENTRE_ID = `centre_test_${RUN_ID}`;
const OWNER_ID = `user_test_owner_${RUN_ID}`;
const TEACHER_ID = `user_test_teacher_${RUN_ID}`;

const OWNER_PASSWORD = "owner-password-1";

/** Two seats, so the limit can be reached without creating a hundred students. */
const SEAT_LIMIT = 2;

const owner: SessionUser = {
  userId: OWNER_ID,
  centreId: CENTRE_ID,
  role: ROLE.OWNER,
  fullName: "Test Owner",
  email: `owner-${RUN_ID}@test.local`,
  isStaff: true,
};

const teacher: SessionUser = {
  userId: TEACHER_ID,
  centreId: CENTRE_ID,
  role: ROLE.TEACHER,
  fullName: "Test Teacher",
  email: `teacher-${RUN_ID}@test.local`,
  isStaff: true,
};

beforeAll(async () => {
  const passwordHash = await hashPassword(OWNER_PASSWORD);

  await db.centre.create({
    data: {
      id: CENTRE_ID,
      name: `Test Centre ${RUN_ID}`,
      slug: `test-centre-${RUN_ID}`,
      seatLimit: SEAT_LIMIT,
      users: {
        create: [
          {
            id: OWNER_ID,
            email: owner.email,
            passwordHash,
            fullName: owner.fullName,
            role: ROLE.OWNER,
          },
          {
            id: TEACHER_ID,
            email: teacher.email,
            passwordHash,
            fullName: teacher.fullName,
            role: ROLE.TEACHER,
          },
        ],
      },
    },
  });
});

afterAll(async () => {
  await db.centre.delete({ where: { id: CENTRE_ID } }).catch(() => undefined);
});

describe("role gate", () => {
  it("refuses every administration action to a teacher", async () => {
    await expect(listStaff(teacher)).rejects.toThrow(ForbiddenError);
    await expect(
      createStaff(teacher, {
        fullName: "Someone New",
        email: `nope-${RUN_ID}@test.local`,
        role: ROLE.TEACHER,
      }),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      createStudent(teacher, { fullName: "Someone New" }),
    ).rejects.toThrow(ForbiddenError);
  });
});

describe("staff", () => {
  it("creates an account with a generated temporary password", async () => {
    const account = await createStaff(owner, {
      fullName: "New Teacher",
      email: `new-teacher-${RUN_ID}@test.local`,
      role: ROLE.TEACHER,
    });

    expect(account.temporaryPassword.length).toBeGreaterThanOrEqual(10);

    // The generated password must actually work, and must be stored hashed.
    const created = await db.user.findUniqueOrThrow({
      where: { email: account.email },
      select: { passwordHash: true },
    });
    expect(created.passwordHash).not.toContain(account.temporaryPassword);
    await expect(
      verifyPassword(account.temporaryPassword, created.passwordHash),
    ).resolves.toBe(true);
  });

  it("rejects an email that is already registered", async () => {
    await expect(
      createStaff(owner, {
        fullName: "Duplicate",
        email: owner.email,
        role: ROLE.TEACHER,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("refuses to let an owner deactivate themselves", async () => {
    // Otherwise the centre is locked out of its own administration for good.
    await expect(setStaffActive(owner, OWNER_ID, false)).rejects.toThrow(ConflictError);
  });

  it("refuses to deactivate a teacher who still owns live batches", async () => {
    await createBatch(owner, {
      name: "Test Batch",
      subject: "Testing",
      gradeLabel: "T1",
      teacherId: TEACHER_ID,
    });

    await expect(setStaffActive(owner, TEACHER_ID, false)).rejects.toThrow(ConflictError);
  });
});

describe("seat limits", () => {
  it("counts active students against the plan", async () => {
    const before = await getSeatUsage(owner);
    expect(before.limit).toBe(SEAT_LIMIT);

    await createStudent(owner, { fullName: "Student One" });

    const after = await getSeatUsage(owner);
    expect(after.used).toBe(before.used + 1);
    expect(after.remaining).toBe(SEAT_LIMIT - after.used);
  });

  it("refuses to exceed the plan", async () => {
    // One seat was taken above; fill the second, then expect the third to fail.
    await createStudent(owner, { fullName: "Student Two" });

    await expect(createStudent(owner, { fullName: "Student Three" })).rejects.toThrow(
      ConflictError,
    );
  });

  it("frees a seat when a student is withdrawn, and keeps their history", async () => {
    const student = await db.student.findFirstOrThrow({
      where: { centreId: CENTRE_ID, fullName: "Student Two" },
      select: { id: true },
    });

    await setStudentActive(owner, student.id, false);

    const usage = await getSeatUsage(owner);
    expect(usage.remaining).toBe(1);

    // Withdrawn, not deleted — the record must survive.
    const stillThere = await db.student.findUnique({
      where: { id: student.id },
      select: { isActive: true },
    });
    expect(stillThere?.isActive).toBe(false);

    // The freed seat is now usable again.
    await expect(createStudent(owner, { fullName: "Student Four" })).resolves.toBeTruthy();
  });
});

describe("enrollment", () => {
  it("adds and removes a student without losing the enrollment row", async () => {
    const batch = await db.batch.findFirstOrThrow({
      where: { centreId: CENTRE_ID },
      select: { id: true },
    });
    const student = await db.student.findFirstOrThrow({
      where: { centreId: CENTRE_ID, isActive: true },
      select: { id: true },
    });

    await setEnrollment(owner, {
      batchId: batch.id,
      studentId: student.id,
      enrolled: "true",
    });

    const enrolled = await db.enrollment.findUniqueOrThrow({
      where: { batchId_studentId: { batchId: batch.id, studentId: student.id } },
      select: { id: true, isActive: true },
    });
    expect(enrolled.isActive).toBe(true);

    await setEnrollment(owner, {
      batchId: batch.id,
      studentId: student.id,
      enrolled: "false",
    });

    // Same row, deactivated — so earlier attendance stays attached to it.
    const removed = await db.enrollment.findUniqueOrThrow({
      where: { batchId_studentId: { batchId: batch.id, studentId: student.id } },
      select: { id: true, isActive: true },
    });
    expect(removed.id).toBe(enrolled.id);
    expect(removed.isActive).toBe(false);
  });
});

describe("changeOwnPassword", () => {
  it("rejects a wrong current password", async () => {
    await expect(
      changeOwnPassword(owner, {
        currentPassword: "not-my-password",
        newPassword: "brand-new-password",
        confirmPassword: "brand-new-password",
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects a mismatched confirmation", async () => {
    await expect(
      changeOwnPassword(owner, {
        currentPassword: OWNER_PASSWORD,
        newPassword: "brand-new-password",
        confirmPassword: "different-password",
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects reusing the current password", async () => {
    await expect(
      changeOwnPassword(owner, {
        currentPassword: OWNER_PASSWORD,
        newPassword: OWNER_PASSWORD,
        confirmPassword: OWNER_PASSWORD,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("changes the password when the current one is correct", async () => {
    const nextPassword = "a-much-better-password";

    await changeOwnPassword(owner, {
      currentPassword: OWNER_PASSWORD,
      newPassword: nextPassword,
      confirmPassword: nextPassword,
    });

    const updated = await db.user.findUniqueOrThrow({
      where: { id: OWNER_ID },
      select: { passwordHash: true },
    });

    await expect(verifyPassword(nextPassword, updated.passwordHash)).resolves.toBe(true);
    await expect(verifyPassword(OWNER_PASSWORD, updated.passwordHash)).resolves.toBe(false);
  });
});
