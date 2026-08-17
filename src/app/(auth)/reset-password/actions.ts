"use server";

/**
 * MODULE: Reset-password action
 *
 * Purpose        Redeem a reset link and set the new password.
 * Responsibility Adapt form data to the service and report the outcome.
 */

import { resetPassword } from "@/server/services/password-reset.service";
import { runAction, type ActionState } from "@/server/action-result";

export async function resetPasswordAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction("password_reset.complete", async () => {
    await resetPassword({
      token: formData.get("token"),
      newPassword: formData.get("newPassword"),
      confirmPassword: formData.get("confirmPassword"),
    });

    // Deliberately not signed in automatically: proving control of the mailbox
    // is enough to set a password, but making them use it confirms it works.
    return "Your password has been set. You can sign in with it now.";
  });
}
