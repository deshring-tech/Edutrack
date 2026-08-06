"use server";

/**
 * MODULE: Administration actions
 *
 * Purpose        Bridge the admin forms to the administration service.
 * Responsibility Parse form data, call the service, revalidate affected pages,
 *                and report the outcome.
 * Dependencies   admin service, session, action-result.
 *
 * Temporary passwords are returned in the success message so the owner can hand
 * them over immediately. They are never persisted in plain text and never
 * logged — `logger.ts` redacts by key name, and these are only ever in a
 * response body.
 */

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { runAction, type ActionState } from "@/server/action-result";
import {
  createBatch,
  createStaff,
  createStudent,
  setEnrollment,
  setStaffActive,
  setStudentActive,
  type CreatedAccount,
} from "@/server/services/admin.service";

function handoverMessage(account: CreatedAccount): string {
  return `${account.fullName} can sign in with ${account.email} and the temporary password ${account.temporaryPassword} — share it now, it is not shown again.`;
}

export async function createStaffAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();

  return runAction("admin.staff.create", async () => {
    const account = await createStaff(session, {
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      phone: formData.get("phone") || undefined,
      role: formData.get("role"),
    });

    revalidatePath("/app/admin/staff");
    revalidatePath("/app/admin/batches");

    return handoverMessage(account);
  });
}

export async function setStaffActiveAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();

  return runAction("admin.staff.set_active", async () => {
    const isActive = formData.get("isActive") === "true";
    const result = await setStaffActive(
      session,
      String(formData.get("userId")),
      isActive,
    );

    revalidatePath("/app/admin/staff");

    return isActive
      ? `${result.fullName} can sign in again`
      : `${result.fullName} has been deactivated`;
  });
}

export async function createStudentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();

  return runAction("admin.student.create", async () => {
    const result = await createStudent(session, {
      fullName: formData.get("fullName"),
      gradeLabel: formData.get("gradeLabel") || undefined,
      batchId: formData.get("batchId") || undefined,
      guardianName: formData.get("guardianName") || undefined,
      guardianEmail: formData.get("guardianEmail") || undefined,
      guardianPhone: formData.get("guardianPhone") || undefined,
    });

    revalidatePath("/app/admin/students");
    revalidatePath("/app/admin/batches");
    revalidatePath("/app/dashboard");

    return result.guardianAccount
      ? `${result.fullName} added. ${handoverMessage(result.guardianAccount)}`
      : `${result.fullName} added. Add a guardian so their parent can see updates.`;
  });
}

export async function setStudentActiveAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();

  return runAction("admin.student.set_active", async () => {
    const isActive = formData.get("isActive") === "true";
    const result = await setStudentActive(
      session,
      String(formData.get("studentId")),
      isActive,
    );

    revalidatePath("/app/admin/students");
    revalidatePath("/app/dashboard");

    return isActive
      ? `${result.fullName} has been re-admitted`
      : `${result.fullName} has been withdrawn — their history is kept`;
  });
}

export async function createBatchAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();

  return runAction("admin.batch.create", async () => {
    const result = await createBatch(session, {
      name: formData.get("name"),
      subject: formData.get("subject"),
      gradeLabel: formData.get("gradeLabel"),
      teacherId: formData.get("teacherId"),
    });

    revalidatePath("/app/admin/batches");
    revalidatePath("/app/batches");
    revalidatePath("/app/dashboard");

    return `${result.name} created — add students to it next`;
  });
}

export async function setEnrollmentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  const batchId = String(formData.get("batchId"));

  return runAction("admin.enrollment.set", async () => {
    const result = await setEnrollment(session, {
      batchId,
      studentId: formData.get("studentId"),
      enrolled: formData.get("enrolled"),
    });

    revalidatePath(`/app/admin/batches/${batchId}`);
    revalidatePath("/app/batches");
    revalidatePath("/app/dashboard");

    return result.enrolled
      ? `${result.fullName} added to the batch`
      : `${result.fullName} removed from the batch`;
  });
}
