"use server";

/**
 * MODULE: Forgot-password action
 *
 * Purpose        Request a password reset link.
 * Responsibility Adapt form data to the service and return one fixed message.
 *
 * The response is identical whether or not the address has an account. Anything
 * else turns this form into a way to discover which parents are registered at a
 * centre.
 */

import { requestPasswordReset } from "@/server/services/password-reset.service";
import { runAction, type ActionState } from "@/server/action-result";

const NEUTRAL_RESPONSE =
  "If that address has an EduTrack account, a reset link is on its way. It expires in one hour.";

export async function forgotPasswordAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction("password_reset.request", async () => {
    await requestPasswordReset({ email: formData.get("email") });
    return NEUTRAL_RESPONSE;
  });
}
