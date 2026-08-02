/**
 * MODULE: At-risk detection
 *
 * Purpose        Decide which students need a human to intervene, and say why.
 * Responsibility Encode the centre's early-warning rules in one auditable place.
 * Dependencies   `./metrics` for the tallies it reasons over. No I/O.
 * Inputs         A student's computed tallies.
 * Outputs        A risk level plus the specific reasons that produced it.
 *
 * WHY REASONS, NOT JUST A SCORE
 *  A dashboard that says "Kabir: risk 0.71" is useless to a centre manager.
 *  "Attendance 60% · 3 sessions missed in a row" is a phone call they can make.
 *  Every rule therefore emits human-readable evidence alongside its weight.
 *
 * Future extension points
 *  - Per-centre configurable thresholds (currently product defaults below).
 *  - Trend-based rules (declining over N weeks) once enough history exists.
 */

import type { AttendanceTally, HomeworkTally } from "./metrics";

export const RISK_THRESHOLDS = {
  attendanceWatch: 85,
  attendanceRisk: 75,
  homeworkWatch: 70,
  homeworkRisk: 55,
  engagementWatch: 50,
  engagementRisk: 35,
  consecutiveAbsences: 3,
} as const;

export type RiskLevel = "ON_TRACK" | "WATCH" | "AT_RISK";

export interface RiskReason {
  code:
    | "LOW_ATTENDANCE"
    | "CONSECUTIVE_ABSENCES"
    | "LOW_HOMEWORK"
    | "LOW_ENGAGEMENT";
  message: string;
  severity: "WATCH" | "AT_RISK";
}

export interface RiskAssessment {
  level: RiskLevel;
  reasons: RiskReason[];
}

export interface RiskInput {
  attendance: AttendanceTally;
  homework: HomeworkTally;
  engagement: number;
  consecutiveAbsences: number;
}

/**
 * Minimum evidence before a student can be flagged. Flagging a child who has
 * attended two sessions produces noise, and a dashboard full of noise gets
 * ignored — which costs more than missing one real case for a week.
 */
const MIN_SESSIONS_FOR_ATTENDANCE_RULE = 4;
const MIN_RECORDS_FOR_HOMEWORK_RULE = 3;

export function assessRisk(input: RiskInput): RiskAssessment {
  const reasons: RiskReason[] = [];
  const { attendance, homework, engagement } = input;

  if (
    attendance.ratePercent !== null &&
    attendance.assessable >= MIN_SESSIONS_FOR_ATTENDANCE_RULE
  ) {
    if (attendance.ratePercent < RISK_THRESHOLDS.attendanceRisk) {
      reasons.push({
        code: "LOW_ATTENDANCE",
        message: `Attendance ${attendance.ratePercent}%`,
        severity: "AT_RISK",
      });
    } else if (attendance.ratePercent < RISK_THRESHOLDS.attendanceWatch) {
      reasons.push({
        code: "LOW_ATTENDANCE",
        message: `Attendance ${attendance.ratePercent}%`,
        severity: "WATCH",
      });
    }
  }

  if (input.consecutiveAbsences >= RISK_THRESHOLDS.consecutiveAbsences) {
    reasons.push({
      code: "CONSECUTIVE_ABSENCES",
      message: `${input.consecutiveAbsences} sessions missed in a row`,
      severity: "AT_RISK",
    });
  }

  if (
    homework.ratePercent !== null &&
    homework.total >= MIN_RECORDS_FOR_HOMEWORK_RULE
  ) {
    if (homework.ratePercent < RISK_THRESHOLDS.homeworkRisk) {
      reasons.push({
        code: "LOW_HOMEWORK",
        message: `Homework ${homework.ratePercent}%`,
        severity: "AT_RISK",
      });
    } else if (homework.ratePercent < RISK_THRESHOLDS.homeworkWatch) {
      reasons.push({
        code: "LOW_HOMEWORK",
        message: `Homework ${homework.ratePercent}%`,
        severity: "WATCH",
      });
    }
  }

  if (engagement < RISK_THRESHOLDS.engagementRisk) {
    reasons.push({
      code: "LOW_ENGAGEMENT",
      message: "Engagement low",
      severity: "AT_RISK",
    });
  } else if (engagement < RISK_THRESHOLDS.engagementWatch) {
    reasons.push({
      code: "LOW_ENGAGEMENT",
      message: "Engagement slipping",
      severity: "WATCH",
    });
  }

  return { level: levelFromReasons(reasons), reasons };
}

function levelFromReasons(reasons: readonly RiskReason[]): RiskLevel {
  if (reasons.some((reason) => reason.severity === "AT_RISK")) return "AT_RISK";
  if (reasons.length > 0) return "WATCH";
  return "ON_TRACK";
}

/** Batch-level health, derived from the same thresholds students are judged by. */
export function assessBatchHealth(
  attendancePercent: number | null,
  homeworkPercent: number | null,
): RiskLevel {
  const attendanceRisk =
    attendancePercent !== null && attendancePercent < RISK_THRESHOLDS.attendanceRisk;
  const homeworkRisk =
    homeworkPercent !== null && homeworkPercent < RISK_THRESHOLDS.homeworkRisk;

  if (attendanceRisk || homeworkRisk) return "AT_RISK";

  const attendanceWatch =
    attendancePercent !== null && attendancePercent < RISK_THRESHOLDS.attendanceWatch;
  const homeworkWatch =
    homeworkPercent !== null && homeworkPercent < RISK_THRESHOLDS.homeworkWatch;

  return attendanceWatch || homeworkWatch ? "WATCH" : "ON_TRACK";
}

export const RISK_LABEL: Record<RiskLevel, string> = {
  ON_TRACK: "On track",
  WATCH: "Watch",
  AT_RISK: "At risk",
};

/** Ordering for dashboards: the students needing action come first. */
export const RISK_PRIORITY: Record<RiskLevel, number> = {
  AT_RISK: 0,
  WATCH: 1,
  ON_TRACK: 2,
};
