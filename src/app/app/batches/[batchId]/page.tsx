/**
 * MODULE: Batch detail page
 *
 * Purpose        Load one batch and hand its roster to the logging screen.
 * Responsibility Authorised reads and composition. No mutation logic.
 *
 * The form is pre-filled with whatever is already saved for today, so a teacher
 * re-opening the screen sees the current state and corrects it, rather than
 * unknowingly submitting a second set of records.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { loadPage } from "@/lib/page-guard";
import { getBatchDetail } from "@/server/services/batch.service";
import { getAttendanceForDay } from "@/server/services/attendance.service";
import { getHomeworkForDay } from "@/server/services/homework.service";
import { startOfDayUtc, toDateInputValue } from "@/domain/dates";
import type { AttendanceStatus, HomeworkStatus } from "@/domain/enums";
import { Avatar } from "@/components/ui/Avatar";
import { BatchLogger } from "./BatchLogger";
import { AssignmentForm } from "./AssignmentForm";

export const metadata: Metadata = { title: "Log a batch" };

interface BatchPageProps {
  params: Promise<{ batchId: string }>;
}

export default async function BatchPage({ params }: BatchPageProps) {
  const { batchId } = await params;
  const session = await requireSession();

  const today = startOfDayUtc();

  const { batch, attendanceToday, homeworkToday } = await loadPage(async () => {
    const detail = await getBatchDetail(session, batchId);
    const [attendance, homework] = await Promise.all([
      getAttendanceForDay(session, detail.id, today),
      getHomeworkForDay(session, detail.id, today),
    ]);
    return { batch: detail, attendanceToday: attendance, homeworkToday: homework };
  });

  return (
    <>
      <header className="mb-3 flex items-center gap-2">
        <Link
          href="/app/batches"
          aria-label="Back to batches"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </Link>
        <div>
          <h1 className="font-display text-xl font-bold text-ink">{batch.name}</h1>
          <p className="text-[12.5px] text-gray-500">
            {batch.roster.length} {batch.roster.length === 1 ? "student" : "students"} ·{" "}
            {batch.subject}
          </p>
        </div>
      </header>

      {batch.roster.length === 0 ? (
        <div className="card p-8 text-center text-[13.5px] text-gray-500">
          No students are enrolled in this batch yet.
        </div>
      ) : (
        <div className="space-y-3">
          <BatchLogger
            batchId={batch.id}
            today={toDateInputValue(today)}
            roster={batch.roster}
            initialAttendance={
              Object.fromEntries(attendanceToday) as Record<string, AttendanceStatus>
            }
            initialHomework={
              Object.fromEntries(homeworkToday) as Record<string, HomeworkStatus>
            }
          />

          <AssignmentForm batchId={batch.id} />

          <section className="card p-4">
            <h2 className="mb-2 font-semibold text-ink">Open a student</h2>
            <p className="mb-3 text-[12.5px] text-gray-500">
              To send a private note, record engagement, or see one child&apos;s full
              history.
            </p>
            <ul className="flex flex-wrap gap-2">
              {batch.roster.map((member) => (
                <li key={member.studentId}>
                  <Link
                    href={`/app/students/${member.studentId}`}
                    className="flex items-center gap-2 rounded-full border border-hairline bg-white py-1 pl-1 pr-3 text-[12.5px] font-medium text-ink hover:shadow-sm"
                  >
                    <Avatar name={member.fullName} color={member.avatarColor} size={24} />
                    {member.fullName}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </>
  );
}
