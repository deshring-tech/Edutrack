/**
 * MODULE: Roster editing page
 *
 * Purpose        Load one batch's roster picker.
 * Responsibility Authorised read and composition.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { loadPage } from "@/lib/page-guard";
import { getRosterEditor } from "@/server/services/admin.service";
import { RosterEditor } from "./RosterEditor";

export const metadata: Metadata = { title: "Batch roster" };

interface RosterPageProps {
  params: Promise<{ batchId: string }>;
}

export default async function RosterPage({ params }: RosterPageProps) {
  const { batchId } = await params;
  const session = await requireSession();
  const roster = await loadPage(() => getRosterEditor(session, batchId));

  return (
    <>
      <header className="mb-3 flex items-center gap-2">
        <Link
          href="/app/admin/batches"
          aria-label="Back to batches"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </Link>
        <div>
          <h1 className="font-display text-xl font-bold text-ink">{roster.batchName}</h1>
          <p className="text-[12.5px] text-gray-500">Taught by {roster.teacherName}</p>
        </div>
      </header>

      <RosterEditor roster={roster} />
    </>
  );
}
