/**
 * MODULE: Centre dashboard
 *
 * Purpose        The owner's daily view of centre health.
 * Responsibility Authorised read and presentation.
 *
 * Every figure on this page is derived from logged records. If a number looks
 * wrong, it is because the underlying data says so — which is the only way a
 * dashboard earns the trust needed for anyone to act on it.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CalendarCheck,
  Layers,
  Users,
} from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { loadPage } from "@/lib/page-guard";
import { getCentreOverview } from "@/server/services/dashboard.service";
import { formatPercent } from "@/domain/metrics";
import { Avatar } from "@/components/ui/Avatar";
import { Kpi } from "@/components/ui/Metrics";
import { StatusPill } from "@/components/ui/Status";
import { AttendanceChart } from "./AttendanceChart";

export const metadata: Metadata = { title: "Centre dashboard" };

/** Regular-plural helper. Every count on this page is data-driven, so "1 updates" is reachable. */
function pluralise(count: number, noun: string): string {
  return count === 1 ? noun : `${noun}s`;
}

export default async function DashboardPage() {
  const session = await requireSession();
  const overview = await loadPage(() => getCentreOverview(session));

  const chartData = overview.batches.map((batch) => ({
    name: batch.gradeLabel,
    attendance: batch.attendancePercent ?? 0,
    health: batch.health,
  }));

  return (
    <>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">
            {overview.centreName}
          </h1>
          <p className="text-[13px] text-gray-500">Centre overview · today</p>
        </div>
        <span className="rounded-full bg-brand-100 px-3 py-1.5 text-xs font-semibold text-brand-900">
          {overview.plan} plan · {overview.activeStudents}/{overview.seatLimit} seats
        </span>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          icon={Users}
          label="Active students"
          value={String(overview.activeStudents)}
          detail={`across ${overview.batches.length} ${overview.batches.length === 1 ? "batch" : "batches"}`}
          tint="var(--color-kind-attendance)"
        />
        <Kpi
          icon={CalendarCheck}
          label="Avg attendance"
          value={formatPercent(overview.attendancePercent)}
          detail="last 90 days"
          tint="var(--color-kind-homework)"
        />
        <Kpi
          icon={BookOpen}
          label="Homework done"
          value={formatPercent(overview.homeworkPercent)}
          detail="completion rate"
          tint="var(--color-kind-engagement)"
        />
        <Kpi
          icon={AlertTriangle}
          label="Need attention"
          value={String(overview.needsAttentionCount)}
          detail="flagged students"
          tint="var(--color-status-risk)"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <section className="card p-4 md:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <Layers size={16} className="text-brand-700" aria-hidden="true" />
            <h2 className="font-semibold text-ink">Batches</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Attendance and homework completion by batch
              </caption>
              <thead>
                <tr className="text-left text-[11px] uppercase text-gray-400">
                  <th scope="col" className="py-2">Batch</th>
                  <th scope="col">Teacher</th>
                  <th scope="col">Students</th>
                  <th scope="col">Attendance</th>
                  <th scope="col">Homework</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {overview.batches.map((batch) => (
                  <tr key={batch.id} className="border-t border-[#f2f2f2]">
                    <td className="py-2.5 font-medium text-ink">
                      <Link href={`/app/batches/${batch.id}`} className="hover:underline">
                        {batch.name}
                      </Link>
                    </td>
                    <td className="text-gray-500">{batch.teacherName}</td>
                    <td className="text-gray-600">{batch.studentCount}</td>
                    <td className="text-gray-600">
                      {formatPercent(batch.attendancePercent)}
                    </td>
                    <td className="text-gray-600">
                      {formatPercent(batch.homeworkPercent)}
                    </td>
                    <td>
                      <StatusPill level={batch.health} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {overview.batches.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-1 text-[12px] font-semibold text-gray-600">
                Attendance by batch
              </h3>
              <AttendanceChart data={chartData} />
            </div>
          )}
        </section>

        <div className="space-y-4">
          <section className="card p-4">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle
                size={16}
                className="text-[color:var(--color-status-risk)]"
                aria-hidden="true"
              />
              <h2 className="font-semibold text-ink">Needs attention</h2>
            </div>

            {overview.flaggedPreview.length === 0 ? (
              <p className="text-[13px] text-gray-500">
                Every student is on track. Nothing to chase today.
              </p>
            ) : (
              <ul>
                {overview.flaggedPreview.map((student) => (
                  <li
                    key={student.id}
                    className="flex items-center gap-2.5 border-t border-[#f2f2f2] py-2 first:border-0"
                  >
                    <Avatar name={student.fullName} color={student.avatarColor} size={34} />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/app/students/${student.id}`}
                        className="block truncate text-[13px] font-medium text-ink hover:underline"
                      >
                        {student.fullName}
                        <span className="font-normal text-gray-400">
                          {" "}
                          · {student.batchName ?? "no batch"}
                        </span>
                      </Link>
                      <div className="truncate text-[11px] text-gray-500">
                        {student.reasons.map((reason) => reason.message).join(" · ")}
                      </div>
                    </div>
                    <StatusPill level={student.level} />
                  </li>
                ))}
              </ul>
            )}

            {overview.needsAttentionCount > overview.flaggedPreview.length && (
              <p className="mt-2 text-[12px] text-gray-500">
                and {overview.needsAttentionCount - overview.flaggedPreview.length} more
              </p>
            )}
          </section>

          <section className="card p-4">
            <div className="mb-2 flex items-center gap-2">
              <Activity size={16} className="text-brand-700" aria-hidden="true" />
              <h2 className="font-semibold text-ink">Teacher activity today</h2>
            </div>

            <p className="text-[13px] leading-relaxed text-gray-600">
              <b className="text-ink">{overview.activity.updatesToday}</b>{" "}
              {pluralise(overview.activity.updatesToday, "progress update")} posted ·{" "}
              <b className="text-ink">{overview.activity.activeTeachersToday}</b> of{" "}
              {overview.activity.totalTeachers} staff active · parents acknowledged{" "}
              <b className="text-ink">{overview.activity.acknowledgedToday}</b>{" "}
              {pluralise(overview.activity.acknowledgedToday, "update")}.
            </p>

            {overview.activity.acknowledgementRatePercent !== null && (
              <>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eee]">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${overview.activity.acknowledgementRatePercent}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-gray-400">
                  {overview.activity.acknowledgementRatePercent}% of this week&apos;s updates
                  have been read by a parent
                </p>
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
