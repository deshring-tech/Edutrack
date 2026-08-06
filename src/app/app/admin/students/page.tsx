/**
 * MODULE: Student administration page
 *
 * Purpose        Load students, batch options and seat usage for the management
 *                screen.
 * Responsibility Authorised reads and composition.
 */

import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { loadPage } from "@/lib/page-guard";
import { getSeatUsage, listStudents } from "@/server/services/admin.service";
import { listBatches } from "@/server/services/batch.service";
import { StudentManager } from "./StudentManager";

export const metadata: Metadata = { title: "Students" };

export default async function StudentsPage() {
  const session = await requireSession();

  const { students, batches, seats } = await loadPage(async () => {
    const [studentList, batchList, seatUsage] = await Promise.all([
      listStudents(session),
      listBatches(session),
      getSeatUsage(session),
    ]);
    return { students: studentList, batches: batchList, seats: seatUsage };
  });

  return (
    <>
      <header className="mb-4">
        <h1 className="font-display text-xl font-bold text-ink">Students</h1>
        <p className="text-[13px] text-gray-500">
          {seats.used} of {seats.limit} seats used. Withdrawing a student frees a seat
          and keeps their history.
        </p>
      </header>

      <StudentManager
        students={students}
        batches={batches.map((batch) => ({ id: batch.id, name: batch.name }))}
        seatsRemaining={seats.remaining}
      />
    </>
  );
}
