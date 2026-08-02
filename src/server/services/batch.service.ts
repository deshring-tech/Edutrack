/**
 * MODULE: Batch queries
 *
 * Purpose        Everything the teacher-facing screens need to read about
 *                batches.
 * Responsibility Authorised reads and batch-level aggregates.
 * Dependencies   @/lib/db, rbac, progress service, domain.
 *
 * All queries here are scoped through `rbac`: an owner sees the centre's
 * batches, a teacher sees only their own.
 */

import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";
import { accessibleBatchIds, requireBatchAccess, requireStaff } from "@/lib/auth/rbac";
import { daysAgo } from "@/domain/dates";
import type { AttendanceStatus, HomeworkStatus } from "@/domain/enums";
import { tallyAttendance, tallyHomework } from "@/domain/metrics";
import { assessBatchHealth, type RiskLevel } from "@/domain/risk";
import { PROGRESS_WINDOW_DAYS } from "./progress.service";
import { getActiveRoster, type RosterMember } from "./roster.service";

export interface BatchSummary {
  id: string;
  name: string;
  subject: string;
  gradeLabel: string;
  colorHex: string;
  teacherName: string;
  studentCount: number;
  attendancePercent: number | null;
  homeworkPercent: number | null;
  health: RiskLevel;
}

/** Batch list with headline stats — the teacher's home screen. */
export async function listBatches(
  session: SessionUser,
  windowDays: number = PROGRESS_WINDOW_DAYS,
): Promise<BatchSummary[]> {
  requireStaff(session);

  const batches = await db.batch.findMany({
    where: {
      centreId: session.centreId,
      isActive: true,
      ...(session.role === "TEACHER" ? { teacherId: session.userId } : {}),
    },
    select: {
      id: true,
      name: true,
      subject: true,
      gradeLabel: true,
      colorHex: true,
      teacher: { select: { fullName: true } },
      _count: { select: { enrollments: { where: { isActive: true } } } },
    },
    orderBy: { name: "asc" },
  });

  const stats = await getBatchStats(
    batches.map((batch) => batch.id),
    windowDays,
  );

  return batches.map((batch) => {
    const stat = stats.get(batch.id);
    const attendancePercent = stat?.attendancePercent ?? null;
    const homeworkPercent = stat?.homeworkPercent ?? null;

    return {
      id: batch.id,
      name: batch.name,
      subject: batch.subject,
      gradeLabel: batch.gradeLabel,
      colorHex: batch.colorHex,
      teacherName: batch.teacher.fullName,
      studentCount: batch._count.enrollments,
      attendancePercent,
      homeworkPercent,
      health: assessBatchHealth(attendancePercent, homeworkPercent),
    };
  });
}

export interface BatchStat {
  attendancePercent: number | null;
  homeworkPercent: number | null;
}

/**
 * Class-level attendance and homework rates.
 * Two queries for any number of batches.
 */
export async function getBatchStats(
  batchIds: readonly string[],
  windowDays: number = PROGRESS_WINDOW_DAYS,
): Promise<Map<string, BatchStat>> {
  const stats = new Map<string, BatchStat>();
  if (batchIds.length === 0) return stats;

  const since = daysAgo(windowDays);
  const ids = [...batchIds];

  const [attendanceRows, homeworkRows] = await Promise.all([
    db.attendanceRecord.findMany({
      where: { session: { batchId: { in: ids }, sessionDate: { gte: since } } },
      select: { status: true, session: { select: { batchId: true } } },
    }),
    db.homeworkRecord.findMany({
      where: { batchId: { in: ids }, recordedOn: { gte: since } },
      select: { status: true, batchId: true },
    }),
  ]);

  const attendanceByBatch = new Map<string, { status: AttendanceStatus }[]>();
  for (const row of attendanceRows) {
    const list = attendanceByBatch.get(row.session.batchId) ?? [];
    list.push({ status: row.status as AttendanceStatus });
    attendanceByBatch.set(row.session.batchId, list);
  }

  const homeworkByBatch = new Map<string, { status: HomeworkStatus }[]>();
  for (const row of homeworkRows) {
    const list = homeworkByBatch.get(row.batchId) ?? [];
    list.push({ status: row.status as HomeworkStatus });
    homeworkByBatch.set(row.batchId, list);
  }

  for (const batchId of ids) {
    stats.set(batchId, {
      attendancePercent: tallyAttendance(attendanceByBatch.get(batchId) ?? []).ratePercent,
      homeworkPercent: tallyHomework(homeworkByBatch.get(batchId) ?? []).ratePercent,
    });
  }

  return stats;
}

export interface BatchDetail {
  id: string;
  name: string;
  subject: string;
  gradeLabel: string;
  colorHex: string;
  roster: RosterMember[];
}

/** A batch plus its current roster — the logging screen's data. */
export async function getBatchDetail(
  session: SessionUser,
  batchId: string,
): Promise<BatchDetail> {
  const batch = await requireBatchAccess(session, batchId);
  const roster = await getActiveRoster(db, batch.id);

  return {
    id: batch.id,
    name: batch.name,
    subject: batch.subject,
    gradeLabel: batch.gradeLabel,
    colorHex: batch.colorHex,
    roster,
  };
}

/** Ids of every batch the caller may open. Used by dashboards. */
export async function listAccessibleBatchIds(session: SessionUser): Promise<string[]> {
  return accessibleBatchIds(session);
}
