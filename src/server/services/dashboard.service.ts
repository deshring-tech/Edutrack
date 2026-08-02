/**
 * MODULE: Centre dashboard
 *
 * Purpose        The owner's view: is the centre healthy, and who needs a call
 *                today?
 * Responsibility Compose the KPIs, class table, at-risk list and staff activity
 *                from live data.
 * Dependencies   @/lib/db, rbac, batch/progress services, domain.
 *
 * EVERY NUMBER HERE IS DERIVED.
 *  The prototype hardcoded "9 flagged students" and "81% parent engagement".
 *  A dashboard whose numbers cannot move is worse than no dashboard: staff
 *  learn to ignore it, and the one week it should have raised an alarm, nobody
 *  is looking.
 */

import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";
import { requireStaff } from "@/lib/auth/rbac";
import { daysAgo, startOfDayUtc } from "@/domain/dates";
import { ROLE } from "@/domain/enums";
import { weightedAverage } from "@/domain/metrics";
import { RISK_PRIORITY, type RiskLevel, type RiskReason } from "@/domain/risk";
import { listBatches, type BatchSummary } from "./batch.service";
import { getProgressFor } from "./progress.service";

/** How far back "are parents reading this?" is measured. */
const ENGAGEMENT_WINDOW_DAYS = 7;

/** At-risk students shown before the "view all" link. */
const AT_RISK_PREVIEW_SIZE = 6;

export interface FlaggedStudent {
  id: string;
  fullName: string;
  avatarColor: string;
  batchName: string | null;
  level: RiskLevel;
  reasons: RiskReason[];
}

export interface CentreActivity {
  updatesToday: number;
  acknowledgedToday: number;
  activeTeachersToday: number;
  totalTeachers: number;
  /** Share of the last week's updates that a parent has acknowledged. */
  acknowledgementRatePercent: number | null;
}

export interface CentreOverview {
  centreName: string;
  plan: string;
  seatLimit: number;
  activeStudents: number;
  attendancePercent: number | null;
  homeworkPercent: number | null;
  needsAttentionCount: number;
  batches: BatchSummary[];
  flagged: FlaggedStudent[];
  flaggedPreview: FlaggedStudent[];
  activity: CentreActivity;
}

export async function getCentreOverview(session: SessionUser): Promise<CentreOverview> {
  requireStaff(session);

  const [centre, batches, students] = await Promise.all([
    db.centre.findUniqueOrThrow({
      where: { id: session.centreId },
      select: { name: true, plan: true, seatLimit: true },
    }),
    listBatches(session),
    db.student.findMany({
      where: { centreId: session.centreId, isActive: true },
      select: {
        id: true,
        fullName: true,
        avatarColor: true,
        enrollments: {
          where: { isActive: true },
          select: { batch: { select: { name: true } } },
          orderBy: { joinedAt: "asc" },
          take: 1,
        },
      },
    }),
  ]);

  const progressByStudent = await getProgressFor(students.map((student) => student.id));

  const flagged: FlaggedStudent[] = students
    .map((student) => {
      const progress = progressByStudent.get(student.id);
      return {
        id: student.id,
        fullName: student.fullName,
        avatarColor: student.avatarColor,
        batchName: student.enrollments[0]?.batch.name ?? null,
        level: progress?.risk.level ?? "ON_TRACK",
        reasons: progress?.risk.reasons ?? [],
      };
    })
    .filter((student) => student.level !== "ON_TRACK")
    .sort(
      (a, b) =>
        RISK_PRIORITY[a.level] - RISK_PRIORITY[b.level] ||
        a.fullName.localeCompare(b.fullName),
    );

  return {
    centreName: centre.name,
    plan: centre.plan,
    seatLimit: centre.seatLimit,
    activeStudents: students.length,
    // Weighted by class size: a 4-student batch must not swing the centre
    // average as hard as a 40-student one.
    attendancePercent: weightedAverage(
      batches.map((batch) => ({
        value: batch.attendancePercent,
        weight: batch.studentCount,
      })),
    ),
    homeworkPercent: weightedAverage(
      batches.map((batch) => ({
        value: batch.homeworkPercent,
        weight: batch.studentCount,
      })),
    ),
    needsAttentionCount: flagged.length,
    batches,
    flagged,
    flaggedPreview: flagged.slice(0, AT_RISK_PREVIEW_SIZE),
    activity: await getCentreActivity(session.centreId),
  };
}

async function getCentreActivity(centreId: string): Promise<CentreActivity> {
  const today = startOfDayUtc();
  const weekAgo = daysAgo(ENGAGEMENT_WINDOW_DAYS);

  const [updatesToday, acknowledgedToday, authorsToday, totalTeachers, weekTotals] =
    await Promise.all([
      db.timelineEntry.count({
        where: { centreId, createdAt: { gte: today } },
      }),
      db.timelineEntry.count({
        where: { centreId, acknowledgedAt: { gte: today } },
      }),
      db.timelineEntry.groupBy({
        by: ["authorId"],
        where: { centreId, createdAt: { gte: today } },
      }),
      db.user.count({
        where: { centreId, role: { in: [ROLE.TEACHER, ROLE.OWNER] }, isActive: true },
      }),
      db.timelineEntry.findMany({
        where: { centreId, createdAt: { gte: weekAgo } },
        select: { acknowledgedAt: true },
      }),
    ]);

  const acknowledgedThisWeek = weekTotals.filter((entry) => entry.acknowledgedAt).length;

  return {
    updatesToday,
    acknowledgedToday,
    activeTeachersToday: authorsToday.length,
    totalTeachers,
    acknowledgementRatePercent:
      weekTotals.length === 0
        ? null
        : Math.round((acknowledgedThisWeek / weekTotals.length) * 100),
  };
}
