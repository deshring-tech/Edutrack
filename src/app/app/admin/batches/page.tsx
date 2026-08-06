/**
 * MODULE: Batch administration page
 *
 * Purpose        Load batches and teacher options for the management screen.
 * Responsibility Authorised reads and composition.
 */

import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { loadPage } from "@/lib/page-guard";
import { listTeacherOptions } from "@/server/services/admin.service";
import { listBatches } from "@/server/services/batch.service";
import { BatchManager } from "./BatchManager";

export const metadata: Metadata = { title: "Batches" };

export default async function AdminBatchesPage() {
  const session = await requireSession();

  const { batches, teachers } = await loadPage(async () => {
    const [batchList, teacherList] = await Promise.all([
      listBatches(session),
      listTeacherOptions(session),
    ]);
    return { batches: batchList, teachers: teacherList };
  });

  return (
    <>
      <header className="mb-4">
        <h1 className="font-display text-xl font-bold text-ink">Batches</h1>
        <p className="text-[13px] text-gray-500">
          A batch is what a teacher logs against. Assign it to one teacher, then choose
          who is in it.
        </p>
      </header>

      <BatchManager batches={batches} teachers={teachers} />
    </>
  );
}
