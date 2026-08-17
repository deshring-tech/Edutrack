"use server";

/**
 * MODULE: Login actions
 *
 * Purpose        Handle the sign-in and sign-out form submissions.
 * Responsibility Adapt form data to the auth service and redirect on success.
 * Dependencies   auth service, session, action-result.
 */

import { redirect } from "next/navigation";
import { getSession, homePathFor } from "@/lib/auth/session";
import { login, logout, signInWithGoogle } from "@/server/services/auth.service";
import { runAction, type ActionState } from "@/server/action-result";

/** Only same-origin paths are accepted, so `?next=` cannot become an open redirect. */
function safeRedirectPath(candidate: FormDataEntryValue | null): string | null {
  if (typeof candidate !== "string") return null;
  if (!candidate.startsWith("/app")) return null;
  if (candidate.startsWith("//")) return null;
  return candidate;
}

export async function loginAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const next = safeRedirectPath(formData.get("next"));

  const result = await runAction("auth.login", async () => {
    const user = await login({
      email: formData.get("email"),
      password: formData.get("password"),
    });
    return homePathFor(user.role);
  });

  if (result.status !== "success" || !result.message) return result;

  // `redirect` throws internally, so it must run outside the try/catch above.
  redirect(next ?? result.message);
}

/**
 * Sign in with a Google ID token.
 *
 * Never creates an account: an unrecognised Google address is told to ask their
 * centre. Registering a new centre with Google is a separate, deliberate flow.
 */
export async function googleSignInAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const next = safeRedirectPath(formData.get("next"));

  const result = await runAction("auth.google", async () => {
    const user = await signInWithGoogle(formData.get("credential"));
    return homePathFor(user.role);
  });

  if (result.status !== "success" || !result.message) return result;

  redirect(next ?? result.message);
}

export async function logoutAction(): Promise<void> {
  const session = await getSession();
  await logout(session);
  redirect("/login");
}
