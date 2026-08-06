/**
 * MODULE: Settings page
 *
 * Purpose        Account details and self-service password change.
 * Responsibility Presentation for every role.
 */

import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { ROLE } from "@/domain/enums";
import { PasswordForm } from "./PasswordForm";

export const metadata: Metadata = { title: "Settings" };

const ROLE_LABEL: Record<string, string> = {
  [ROLE.OWNER]: "Centre owner",
  [ROLE.TEACHER]: "Teacher",
  [ROLE.PARENT]: "Parent",
};

export default async function SettingsPage() {
  const session = await requireSession();

  return (
    <>
      <header className="mb-4">
        <h1 className="font-display text-xl font-bold text-ink">Settings</h1>
        <p className="text-[13px] text-gray-500">
          Signed in as {session.fullName} ({session.email}) ·{" "}
          {ROLE_LABEL[session.role] ?? session.role}
        </p>
      </header>

      <PasswordForm />
    </>
  );
}
