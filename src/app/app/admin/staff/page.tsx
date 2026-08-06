/**
 * MODULE: Staff administration page
 *
 * Purpose        Load the centre's staff list for the management screen.
 * Responsibility Authorised read and composition.
 */

import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { loadPage } from "@/lib/page-guard";
import { listStaff } from "@/server/services/admin.service";
import { StaffManager } from "./StaffManager";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  const session = await requireSession();
  const staff = await loadPage(() => listStaff(session));

  return (
    <>
      <header className="mb-4">
        <h1 className="font-display text-xl font-bold text-ink">Staff</h1>
        <p className="text-[13px] text-gray-500">
          Teachers can log progress for the batches assigned to them. Owners can do
          everything, including this page.
        </p>
      </header>

      <StaffManager staff={staff} />
    </>
  );
}
