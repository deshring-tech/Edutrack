/**
 * MODULE: Post-login router
 *
 * Purpose        Send each role to the screen that is useful to them.
 * Responsibility A single redirect. No UI.
 */

import { redirect } from "next/navigation";
import { homePathFor, requireSession } from "@/lib/auth/session";

export default async function AppIndexPage() {
  const session = await requireSession();
  redirect(homePathFor(session.role));
}
