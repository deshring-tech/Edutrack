"use server";

/**
 * MODULE: Registration action
 *
 * Purpose        Handle the create-a-centre form submission.
 * Responsibility Adapt form data to the account service, then send the new
 *                owner somewhere useful.
 *
 * A brand-new centre has no batches and no students, so the owner lands on the
 * staff page rather than an empty dashboard — the first useful thing to do is
 * add people.
 */

import { redirect } from "next/navigation";
import { registerCentre } from "@/server/services/account.service";
import { runAction, type ActionState } from "@/server/action-result";

export async function registerAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await runAction("centre.register", async () => {
    await registerCentre({
      centreName: formData.get("centreName"),
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      password: formData.get("password"),
    });
    return "registered";
  });

  if (result.status !== "success") return result;

  // `redirect` throws internally, so it must run outside the wrapper above.
  redirect("/app/admin/staff");
}
