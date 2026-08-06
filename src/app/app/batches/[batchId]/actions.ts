"use server";

/**
 * MODULE: Batch logging actions
 *
 * Purpose        Bridge the batch logging form to the services.
 * Responsibility Parse form data, call the service, report the outcome in the
 *                teacher's language, and revalidate affected pages.
 * Dependencies   attendance/homework/assessment/notes services.
 *
 * The success message names the real number of parents queued, taken from the
 * service result. The prototype showed "22 parents notified" from a hardcoded
 * string while sending nothing; here the number is whatever actually happened.
 */

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { runAction, type ActionState } from "@/server/action-result";
import { saveBatchAttendance } from "@/server/services/attendance.service";
import { saveBatchHomework } from "@/server/services/homework.service";
import { saveAssessment } from "@/server/services/assessment.service";
import { postAssignment } from "@/server/services/notes.service";

/**
 * The per-student marks travel as a JSON string in one hidden field.
 * A form with 30 rows would otherwise need 30 named inputs kept in sync by
 * index, which is fragile; the server re-validates the JSON with Zod either way.
 */
function readJsonField<T>(formData: FormData, field: string): T {
  const raw = formData.get(field);
  if (typeof raw !== "string" || raw.length === 0) return [] as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return [] as T;
  }
}

/** Regular plural. Every count here is data-driven, so "1 students" is reachable. */
function pluralise(count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

function pluraliseParents(count: number): string {
  if (count === 0) return "no new notifications";
  return `${pluralise(count, "parent")} notified`;
}

export async function saveAttendanceAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();

  return runAction("attendance.save", async () => {
    const result = await saveBatchAttendance(session, {
      batchId: formData.get("batchId"),
      sessionDate: formData.get("sessionDate"),
      marks: readJsonField(formData, "marks"),
    });

    revalidatePath(`/app/batches/${String(formData.get("batchId"))}`);
    revalidatePath("/app/dashboard");

    return `Attendance saved for ${pluralise(result.studentsMarked, "student")} · ${pluraliseParents(result.notificationsQueued)}`;
  });
}

export async function saveHomeworkAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();

  return runAction("homework.save", async () => {
    const result = await saveBatchHomework(session, {
      batchId: formData.get("batchId"),
      recordedOn: formData.get("recordedOn"),
      marks: readJsonField(formData, "marks"),
    });

    revalidatePath(`/app/batches/${String(formData.get("batchId"))}`);
    revalidatePath("/app/dashboard");

    return `Homework saved for ${pluralise(result.studentsRecorded, "student")} · ${pluraliseParents(result.notificationsQueued)}`;
  });
}

export async function saveAssessmentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();

  return runAction("assessment.save", async () => {
    const result = await saveAssessment(session, {
      batchId: formData.get("batchId"),
      title: formData.get("title"),
      maxScore: formData.get("maxScore"),
      assessedOn: formData.get("assessedOn"),
      scores: readJsonField(formData, "scores"),
    });

    revalidatePath(`/app/batches/${String(formData.get("batchId"))}`);
    revalidatePath("/app/dashboard");

    const average =
      result.classAveragePercent === null ? "" : ` · class average ${result.classAveragePercent}%`;

    return `Results saved for ${pluralise(result.scoresRecorded, "student")}${average} · ${pluraliseParents(result.notificationsQueued)}`;
  });
}

export async function postAssignmentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();

  return runAction("assignment.post", async () => {
    const dueDate = formData.get("dueDate");
    const attachmentName = formData.get("attachmentName");

    const result = await postAssignment(session, {
      batchId: formData.get("batchId"),
      title: formData.get("title"),
      // Empty strings must become undefined or the optional schema rejects them.
      dueDate: typeof dueDate === "string" && dueDate ? dueDate : undefined,
      attachmentName:
        typeof attachmentName === "string" && attachmentName ? attachmentName : undefined,
    });

    revalidatePath(`/app/batches/${String(formData.get("batchId"))}`);

    return `Assignment posted to ${pluralise(result.studentsNotified, "student")} · ${pluraliseParents(result.notificationsQueued)}`;
  });
}
