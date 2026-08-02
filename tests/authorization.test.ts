/**
 * Tests: authorization boundaries
 *
 * This is the highest-value file in the suite. The original prototype decided
 * access with a React prop, so switching tabs could show a parent another
 * family's child. These tests assert, against a real database, that the rules
 * in `rbac.ts` actually hold.
 *
 * REQUIRES SEEDED DATA:  npm run db:seed
 * Runs against the development SQLite database and performs reads only.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { NotFoundError, ForbiddenError } from "@/lib/errors";
import { ROLE } from "@/domain/enums";
import type { SessionUser } from "@/lib/auth/session";
import {
  accessibleBatchIds,
  accessibleStudentIds,
  requireBatchAccess,
  requireOwner,
  requireParent,
  requireStaff,
  requireStudentAccess,
  requireStudentWriteAccess,
} from "@/lib/auth/rbac";

const CENTRE_ID = "centre_brightminds";

/** Aarav Sharma's parent — Aarav is in Grade 7 Math, taught by Ms Rao. */
const aaravsParent: SessionUser = {
  userId: "par_aarav",
  centreId: CENTRE_ID,
  role: ROLE.PARENT,
  fullName: "Anita Sharma",
  email: "anita.sharma@example.in",
  isStaff: false,
};

/** Teaches Grade 7 Math and Grade 6 Science — not Grade 9 Physics. */
const teacherRao: SessionUser = {
  userId: "user_rao",
  centreId: CENTRE_ID,
  role: ROLE.TEACHER,
  fullName: "Sunita Rao",
  email: "rao@brightminds.in",
  isStaff: true,
};

const owner: SessionUser = {
  userId: "user_owner",
  centreId: CENTRE_ID,
  role: ROLE.OWNER,
  fullName: "Priya Nair",
  email: "priya@brightminds.in",
  isStaff: true,
};

/** A user from a different centre, used to prove tenancy isolation. */
const otherCentreStaff: SessionUser = {
  userId: "user_outsider",
  centreId: "centre_somewhere_else",
  role: ROLE.OWNER,
  fullName: "Outside Owner",
  email: "outsider@example.com",
  isStaff: true,
};

beforeAll(async () => {
  const seeded = await db.student.count({ where: { centreId: CENTRE_ID } });
  if (seeded === 0) {
    throw new Error("Authorization tests need seeded data. Run: npm run db:seed");
  }
});

describe("role guards", () => {
  it("keeps parents out of staff areas", () => {
    expect(() => requireStaff(aaravsParent)).toThrow(ForbiddenError);
    expect(() => requireStaff(teacherRao)).not.toThrow();
  });

  it("keeps teachers out of owner-only actions", () => {
    expect(() => requireOwner(teacherRao)).toThrow(ForbiddenError);
    expect(() => requireOwner(owner)).not.toThrow();
  });

  it("keeps staff out of parent areas", () => {
    expect(() => requireParent(teacherRao)).toThrow(ForbiddenError);
    expect(() => requireParent(aaravsParent)).not.toThrow();
  });
});

describe("parent access to students", () => {
  it("allows a parent to read their own child", async () => {
    const student = await requireStudentAccess(aaravsParent, "stu_aarav");
    expect(student.fullName).toBe("Aarav Sharma");
  });

  // THE REGRESSION. In the prototype, opening a student as a teacher and
  // switching to the parent tab left that student selected — another family's
  // child, rendered in full.
  it("refuses a parent access to a child who is not theirs", async () => {
    await expect(requireStudentAccess(aaravsParent, "stu_kabirs")).rejects.toThrow(
      NotFoundError,
    );
  });

  it("returns only linked children when listing", async () => {
    const ids = await accessibleStudentIds(aaravsParent);
    expect(ids).toEqual(["stu_aarav"]);
  });

  it("never lets a parent write to a student record", async () => {
    await expect(requireStudentWriteAccess(aaravsParent, "stu_aarav")).rejects.toThrow(
      ForbiddenError,
    );
  });
});

describe("teacher access to batches", () => {
  it("allows a teacher into a batch they teach", async () => {
    const batch = await requireBatchAccess(teacherRao, "batch_g7m");
    expect(batch.name).toBe("Grade 7 Math");
  });

  it("refuses a teacher a batch they do not teach", async () => {
    await expect(requireBatchAccess(teacherRao, "batch_g9p")).rejects.toThrow(NotFoundError);
  });

  it("allows the owner into every batch in their centre", async () => {
    await expect(requireBatchAccess(owner, "batch_g9p")).resolves.toBeTruthy();
  });

  it("lists only a teacher's own batches", async () => {
    const teacherBatches = await accessibleBatchIds(teacherRao);
    expect(teacherBatches).toContain("batch_g7m");
    expect(teacherBatches).toContain("batch_g6s");
    expect(teacherBatches).not.toContain("batch_g9p");

    const ownerBatches = await accessibleBatchIds(owner);
    expect(ownerBatches).toContain("batch_g9p");
  });
});

describe("teacher write access to students", () => {
  it("allows a teacher to post about a student in their own batch", async () => {
    await expect(requireStudentWriteAccess(teacherRao, "stu_aarav")).resolves.toBeTruthy();
  });

  it("refuses a teacher a student who is only in someone else's batch", async () => {
    await expect(requireStudentWriteAccess(teacherRao, "stu_kabirs")).rejects.toThrow(
      NotFoundError,
    );
  });

  it("allows the owner to post about any student in the centre", async () => {
    await expect(requireStudentWriteAccess(owner, "stu_kabirs")).resolves.toBeTruthy();
  });
});

describe("centre isolation", () => {
  it("hides students belonging to another centre", async () => {
    // Reported as "not found" rather than "forbidden", so probing ids cannot
    // confirm that a given student exists somewhere in the system.
    await expect(requireStudentAccess(otherCentreStaff, "stu_aarav")).rejects.toThrow(
      NotFoundError,
    );
  });

  it("hides batches belonging to another centre", async () => {
    await expect(requireBatchAccess(otherCentreStaff, "batch_g7m")).rejects.toThrow(
      NotFoundError,
    );
  });

  it("returns nothing when listing another centre's students", async () => {
    await expect(accessibleStudentIds(otherCentreStaff)).resolves.toEqual([]);
  });
});
