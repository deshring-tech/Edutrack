"use server";

/**
 * MODULE: Student actions
 *
 * Purpose        The one-to-one writes a teacher makes about a single child.
 * Responsibility Adapt form data to the notes service and revalidate views.
 * Dependencies   notes service, session, action-result.
 */

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { runAction, type ActionState } from "@/server/action-result";
import { logEngagement, postNote } from "@/server/services/notes.service";

export async function postNoteAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  const studentId = formData.get("studentId");

  return runAction("note.post", async () => {
    const result = await postNote(session, {
      studentId,
      body: formData.get("body"),
    });

    if (typeof studentId === "string") revalidatePath(`/app/students/${studentId}`);

    return result.notificationsQueued === 0
      ? "Note saved — no guardian is linked to this student yet"
      : `Note sent to ${result.notificationsQueued} guardian${result.notificationsQueued === 1 ? "" : "s"}`;
  });
}

export async function logEngagementAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  const studentId = formData.get("studentId");

  return runAction("engagement.log", async () => {
    await logEngagement(session, {
      studentId,
      delta: formData.get("delta"),
      note: formData.get("note") || undefined,
    });

    if (typeof studentId === "string") revalidatePath(`/app/students/${studentId}`);

    return "Engagement recorded";
  });
}
