/**
 * MODULE: Progress aggregation
 *
 * Purpose        Compute the progress picture for one student or many, from
 *                the raw logged records.
 * Responsibility Fetch efficiently, then delegate every calculation to the pure
 *                domain layer. This module contains no arithmetic of its own.
 * Dependencies   @/lib/db, @/domain/metrics, @/domain/risk, @/domain/dates.
 * Inputs         Student ids and a lookback window.
 * Outputs        `StudentProgress` records, ready to render.
 *
 * QUERY SHAPE
 *  Four queries total regardless of how many students are requested — not four
 *  per student. A centre dashboard renders 150 students; the N+1 version of
 *  this module would issue 600 queries per page load.
 *
 * SCALING NOTE
 *  At roughly 100k attendance rows per centre this should become a nightly
 *  rollup table read by the dashboard, with this path kept for a single
 *  student's live view. The domain functions do not change when that happens.
 */

import { db } from "@/lib/db";
import { daysAgo } from "@/domain/dates";
import type { AttendanceStatus, HomeworkStatus } from "@/domain/enums";
import {
  assessmentAverage,
  consecutiveAbsences,
  engagementLabel,
  engagementScore,
  tallyAttendance,
  tallyHomework,
  type AttendanceTally,
  type HomeworkTally,
} from "@/domain/metrics";
import { assessRisk, type RiskAssessment } from "@/domain/risk";

/** How far back the displayed metrics look. One term, roughly. */
export const PROGRESS_WINDOW_DAYS = 90;

export interface StudentProgress {
  studentId: string;
  attendance: AttendanceTally;
  homework: HomeworkTally;
  consecutiveAbsences: number;
  engagement: number;
  engagementLabel: string;
  assessmentAveragePercent: number | null;
  assessmentCount: number;
  risk: RiskAssessment;
}

/**
 * Progress for a set of students. Returns a map keyed by student id; students
 * with no records yet appear with empty tallies rather than being omitted, so
 * callers never have to handle a missing key.
 */
export async function getProgressFor(
  studentIds: readonly string[],
  windowDays: number = PROGRESS_WINDOW_DAYS,
): Promise<Map<string, StudentProgress>> {
  const result = new Map<string, StudentProgress>();
  if (studentIds.length === 0) return result;

  const since = daysAgo(windowDays);
  const ids = [...studentIds];

  const [attendanceRows, homeworkRows, engagementRows, scoreRows] = await Promise.all([
    db.attendanceRecord.findMany({
      where: { studentId: { in: ids }, session: { sessionDate: { gte: since } } },
      select: {
        studentId: true,
        status: true,
        session: { select: { sessionDate: true } },
      },
      orderBy: { session: { sessionDate: "desc" } },
    }),
    db.homeworkRecord.findMany({
      where: { studentId: { in: ids }, recordedOn: { gte: since } },
      select: { studentId: true, status: true },
    }),
    db.engagementLog.findMany({
      where: { studentId: { in: ids }, occurredAt: { gte: since } },
      select: { studentId: true, delta: true, occurredAt: true },
    }),
    db.assessmentScore.findMany({
      where: { studentId: { in: ids }, assessment: { assessedOn: { gte: since } } },
      select: {
        studentId: true,
        score: true,
        assessment: { select: { maxScore: true } },
      },
    }),
  ]);

  const attendanceByStudent = groupBy(attendanceRows, (row) => row.studentId);
  const homeworkByStudent = groupBy(homeworkRows, (row) => row.studentId);
  const engagementByStudent = groupBy(engagementRows, (row) => row.studentId);
  const scoresByStudent = groupBy(scoreRows, (row) => row.studentId);

  const now = new Date();

  for (const studentId of ids) {
    // `attendanceRows` is ordered newest-first, so each group already is too —
    // which is what the consecutive-absence streak requires.
    const attendanceRecords = (attendanceByStudent.get(studentId) ?? []).map((row) => ({
      status: row.status as AttendanceStatus,
    }));

    const homeworkRecords = (homeworkByStudent.get(studentId) ?? []).map((row) => ({
      status: row.status as HomeworkStatus,
    }));

    const observations = (engagementByStudent.get(studentId) ?? []).map((row) => ({
      delta: row.delta,
      occurredAt: row.occurredAt,
    }));

    const results = (scoresByStudent.get(studentId) ?? []).map((row) => ({
      score: row.score,
      maxScore: row.assessment.maxScore,
    }));

    const attendance = tallyAttendance(attendanceRecords);
    const homework = tallyHomework(homeworkRecords);
    const engagement = engagementScore(observations, now);
    const streak = consecutiveAbsences(attendanceRecords);

    result.set(studentId, {
      studentId,
      attendance,
      homework,
      consecutiveAbsences: streak,
      engagement,
      engagementLabel: engagementLabel(engagement),
      assessmentAveragePercent: assessmentAverage(results),
      assessmentCount: results.length,
      risk: assessRisk({
        attendance,
        homework,
        engagement,
        consecutiveAbsences: streak,
      }),
    });
  }

  return result;
}

/** Convenience wrapper for the single-student case. */
export async function getProgress(
  studentId: string,
  windowDays: number = PROGRESS_WINDOW_DAYS,
): Promise<StudentProgress> {
  const progress = await getProgressFor([studentId], windowDays);
  const found = progress.get(studentId);
  if (found) return found;

  // Unreachable in practice — getProgressFor always populates every id — but
  // returning a valid empty shape is safer than a non-null assertion.
  return emptyProgress(studentId);
}

function emptyProgress(studentId: string): StudentProgress {
  const attendance = tallyAttendance([]);
  const homework = tallyHomework([]);
  const engagement = engagementScore([]);

  return {
    studentId,
    attendance,
    homework,
    consecutiveAbsences: 0,
    engagement,
    engagementLabel: engagementLabel(engagement),
    assessmentAveragePercent: null,
    assessmentCount: 0,
    risk: assessRisk({ attendance, homework, engagement, consecutiveAbsences: 0 }),
  };
}

function groupBy<T, K>(items: readonly T[], keyOf: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const existing = groups.get(key);
    if (existing) existing.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}
