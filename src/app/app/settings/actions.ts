"use server";

/**
 * MODULE: Settings actions
 *
 * Purpose        Bridge the settings form to the account service.
 * Responsibility Adapt form data and report the outcome.
 */

import { requireSession } from "@/lib/auth/session";
import { runAction, type ActionState } from "@/server/action-result";
import { changeOwnPassword } from "@/server/services/account.service";

export async function changePasswordAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();

  return runAction("account.change_password", async () => {
    await changeOwnPassword(session, {
      currentPassword: formData.get("currentPassword"),
      newPassword: formData.get("newPassword"),
      confirmPassword: formData.get("confirmPassword"),
    });

    return "Your password has been changed.";
  });
}
