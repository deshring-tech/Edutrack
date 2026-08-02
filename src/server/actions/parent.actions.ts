"use server";

/**
 * MODULE: Parent actions
 *
 * Purpose        The writes a parent is allowed to make.
 * Responsibility Adapt calls from shared components to the parent service.
 * Dependencies   parent service, session, action-result.
 *
 * CONVENTION
 *  Actions used by a single route live beside that route. Actions called from a
 *  shared component live here, because a component under `src/components` must
 *  not import from a specific page's folder.
 */

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { runAction, type ActionState } from "@/server/action-result";
import {
  acknowledgeAllForStudent,
  acknowledgeEntry,
} from "@/server/services/parent.service";

export async function acknowledgeEntryAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();

  return runAction("timeline.acknowledge", async () => {
    await acknowledgeEntry(session, {
      timelineEntryId: formData.get("timelineEntryId"),
    });

    revalidatePath("/app/children");
    const studentId = formData.get("studentId");
    if (typeof studentId === "string") revalidatePath(`/app/children/${studentId}`);

    return "Marked as read";
  });
}

export async function acknowledgeAllAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  const studentId = formData.get("studentId");

  return runAction("timeline.acknowledge_all", async () => {
    if (typeof studentId !== "string") {
      throw new Error("Missing student reference");
    }

    const result = await acknowledgeAllForStudent(session, studentId);

    revalidatePath("/app/children");
    revalidatePath(`/app/children/${studentId}`);

    return result.acknowledged === 0
      ? "Everything was already read"
      : `${result.acknowledged} update${result.acknowledged === 1 ? "" : "s"} marked as read`;
  });
}
