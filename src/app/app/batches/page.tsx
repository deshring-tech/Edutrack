/**
 * MODULE: Batch list
 *
 * Purpose        A teacher's home screen: which classes do I teach, and how are
 *                they doing?
 * Responsibility Authorised read and presentation.
 *
 * Owners see every batch in the centre; teachers see only their own. That
 * filtering happens inside `listBatches` via `rbac`, not here.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, UserCheck } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { loadPage } from "@/lib/page-guard";
import { listBatches } from "@/server/services/batch.service";
import { formatPercent } from "@/domain/metrics";
import { StatusPill } from "@/components/ui/Status";

export const metadata: Metadata = { title: "My batches" };

export default async function BatchesPage() {
  const session = await requireSession();
  const batches = await loadPage(() => listBatches(session));

  return (
    <>
      <header className="mb-4">
        <h1 className="font-display text-xl font-bold text-ink">My batches</h1>
        <p className="text-[13px] text-gray-500">
          Mark the whole class in seconds — each entry becomes that child&apos;s record,
          and their parent is notified.
        </p>
      </header>

      {batches.length === 0 ? (
        <div className="card p-8 text-center">
          <UserCheck size={26} className="mx-auto mb-2 text-gray-300" aria-hidden="true" />
          <p className="text-[13.5px] text-gray-500">
            No batches are assigned to you yet. Ask your centre admin to add one.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {batches.map((batch) => (
            <li key={batch.id}>
              <Link
                href={`/app/batches/${batch.id}`}
                className="card flex items-center gap-3 p-4 transition-shadow hover:shadow-md"
              >
                <div
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: `color-mix(in srgb, ${batch.colorHex} 16%, transparent)`,
                  }}
                >
                  <UserCheck size={21} style={{ color: batch.colorHex }} aria-hidden="true" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[15px] text-ink">{batch.name}</span>
                    <StatusPill level={batch.health} />
                  </div>
                  <div className="text-[12px] text-gray-500">
                    {batch.teacherName} · {batch.studentCount}{" "}
                    {batch.studentCount === 1 ? "student" : "students"}
                  </div>
                  <div className="mt-1.5 flex gap-3 text-[11.5px]">
                    <span style={{ color: "var(--color-kind-attendance)" }}>
                      Attendance {formatPercent(batch.attendancePercent)}
                    </span>
                    <span style={{ color: "var(--color-kind-homework)" }}>
                      Homework {formatPercent(batch.homeworkPercent)}
                    </span>
                  </div>
                </div>

                <ChevronRight size={20} className="text-gray-300" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
