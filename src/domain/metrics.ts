/**
 * MODULE: Progress metrics
 *
 * Purpose        Turn raw logged events into the numbers a parent, teacher and
 *                centre owner see.
 * Responsibility Own every percentage in the product. If a number appears in
 *                the UI, the function that produced it lives here.
 * Dependencies   `./enums` only — no framework, no database, no I/O.
 * Inputs         Plain arrays of already-fetched records.
 * Outputs        Numbers and small value objects. Never throws on empty input.
 *
 * WHY THIS IS A SEPARATE LAYER
 *  These rules are the product's opinion about children's progress. They must
 *  be readable, unit-testable without a database, and identical everywhere
 *  they are displayed. Recomputing "attendance %" inline in three components is
 *  how two screens end up disagreeing about the same child.
 *
 * Future extension points
 *  - Weighted subject-level metrics.
 *  - Configurable per-centre thresholds (currently product-wide constants).
 */

import {
  ATTENDANCE_CREDIT,
  ATTENDANCE_EXCLUDED_FROM_RATE,
  HOMEWORK_CREDIT,
  type AttendanceStatus,
  type HomeworkStatus,
} from "./enums";

// ----------------------------------------------------------------- constants

/** Every student starts from a neutral engagement position, not from zero. */
export const ENGAGEMENT_BASELINE = 50;

/** Engagement is a recent-behaviour signal, so old observations fall out. */
export const ENGAGEMENT_WINDOW_DAYS = 30;

export const ENGAGEMENT_BANDS = [
  { min: 80, label: "Excellent" },
  { min: 60, label: "Good" },
  { min: 40, label: "Fair" },
  { min: 0, label: "Needs focus" },
] as const;

/** Difference from the batch average that counts as meaningfully different. */
export const PEER_COMPARISON_TOLERANCE = 6;

const MILLISECONDS_PER_DAY = 86_400_000;

// ----------------------------------------------------------------- utilities

/** Constrain a value to a range. Guards every score the UI renders. */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Percentage of `numerator` over `denominator`, rounded, clamped to 0–100.
 * Returns null for an empty denominator so callers must decide how to render
 * "no data yet" — rendering it as 0% would tell a parent their child attended
 * nothing, which is a different and much worse statement.
 */
export function ratePercent(
  numerator: number,
  denominator: number,
): number | null {
  if (denominator <= 0 || !Number.isFinite(denominator)) return null;
  if (!Number.isFinite(numerator)) return null;
  return clamp(Math.round((numerator / denominator) * 100), 0, 100);
}

// ---------------------------------------------------------------- attendance

export interface AttendanceTally {
  present: number;
  absent: number;
  late: number;
  excused: number;
  /** Sessions counted towards the rate (everything except EXCUSED). */
  assessable: number;
  /** 0–100, or null when the student has no assessable sessions yet. */
  ratePercent: number | null;
}

export function tallyAttendance(
  records: readonly { status: AttendanceStatus }[],
): AttendanceTally {
  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  let credit = 0;
  let assessable = 0;

  for (const record of records) {
    switch (record.status) {
      case "PRESENT":
        counts.present += 1;
        break;
      case "ABSENT":
        counts.absent += 1;
        break;
      case "LATE":
        counts.late += 1;
        break;
      case "EXCUSED":
        counts.excused += 1;
        break;
    }

    if (ATTENDANCE_EXCLUDED_FROM_RATE.includes(record.status)) continue;
    assessable += 1;
    credit += ATTENDANCE_CREDIT[record.status];
  }

  return { ...counts, assessable, ratePercent: ratePercent(credit, assessable) };
}

/**
 * Length of the student's current unbroken run of absences, most recent first.
 * Three missed sessions in a row is the single strongest early-warning signal a
 * centre has, and it is invisible in a monthly average.
 */
export function consecutiveAbsences(
  recordsNewestFirst: readonly { status: AttendanceStatus }[],
): number {
  let streak = 0;
  for (const record of recordsNewestFirst) {
    if (record.status === "ABSENT") streak += 1;
    else break;
  }
  return streak;
}

// ------------------------------------------------------------------ homework

export interface HomeworkTally {
  done: number;
  partial: number;
  missing: number;
  total: number;
  /** 0–100, or null when nothing has been logged yet. */
  ratePercent: number | null;
}

export function tallyHomework(
  records: readonly { status: HomeworkStatus }[],
): HomeworkTally {
  const counts = { done: 0, partial: 0, missing: 0 };
  let credit = 0;

  for (const record of records) {
    switch (record.status) {
      case "DONE":
        counts.done += 1;
        break;
      case "PARTIAL":
        counts.partial += 1;
        break;
      case "MISSING":
        counts.missing += 1;
        break;
    }
    credit += HOMEWORK_CREDIT[record.status];
  }

  const total = records.length;
  return { ...counts, total, ratePercent: ratePercent(credit, total) };
}

// ---------------------------------------------------------------- assessment

export interface ScoredAssessment {
  score: number;
  maxScore: number;
}

/**
 * Percentage for a single result. Clamped to 0–100 because a teacher awarding
 * bonus marks (26/25) must not produce a 104% average, and a zero max must not
 * produce Infinity — both were live defects in the original prototype.
 */
export function scorePercent(result: ScoredAssessment): number | null {
  if (result.maxScore <= 0 || !Number.isFinite(result.maxScore)) return null;
  if (!Number.isFinite(result.score) || result.score < 0) return null;
  return clamp(Math.round((result.score / result.maxScore) * 100), 0, 100);
}

/** Unweighted mean of valid result percentages; null when there are none. */
export function assessmentAverage(
  results: readonly ScoredAssessment[],
): number | null {
  const percentages = results
    .map(scorePercent)
    .filter((value): value is number => value !== null);

  if (percentages.length === 0) return null;
  const total = percentages.reduce((sum, value) => sum + value, 0);
  return Math.round(total / percentages.length);
}

// ---------------------------------------------------------------- engagement

export interface EngagementObservation {
  delta: number;
  occurredAt: Date;
}

/**
 * Engagement score derived from recent observations, never stored.
 * Deriving it means we can always answer a parent asking "why is this 62?" by
 * listing the exact observations inside the window.
 */
export function engagementScore(
  observations: readonly EngagementObservation[],
  now: Date = new Date(),
  windowDays: number = ENGAGEMENT_WINDOW_DAYS,
): number {
  const cutoff = now.getTime() - windowDays * MILLISECONDS_PER_DAY;

  const total = observations.reduce((sum, observation) => {
    if (observation.occurredAt.getTime() < cutoff) return sum;
    if (!Number.isFinite(observation.delta)) return sum;
    return sum + observation.delta;
  }, 0);

  return clamp(Math.round(ENGAGEMENT_BASELINE + total), 0, 100);
}

export function engagementLabel(score: number): string {
  const band = ENGAGEMENT_BANDS.find((candidate) => score >= candidate.min);
  return band?.label ?? "Needs focus";
}

// ------------------------------------------------------- peer comparison ---

export type PeerStanding = "AHEAD" | "ON_PACE" | "BEHIND";

export interface PeerComparison {
  standing: PeerStanding;
  studentPercent: number;
  batchPercent: number;
  difference: number;
}

/**
 * Compare one child against their batch. Deliberately returns a coarse band
 * rather than a rank: telling a parent their child is "17th of 22" damages the
 * child without helping them, which is exactly the behaviour schools ask us to
 * avoid.
 */
export function comparePeer(
  studentPercent: number | null,
  batchPercent: number | null,
  tolerance: number = PEER_COMPARISON_TOLERANCE,
): PeerComparison | null {
  if (studentPercent === null || batchPercent === null) return null;

  const difference = studentPercent - batchPercent;
  const standing: PeerStanding =
    difference >= tolerance ? "AHEAD" : difference <= -tolerance ? "BEHIND" : "ON_PACE";

  return { standing, studentPercent, batchPercent, difference };
}

// ---------------------------------------------------------------- aggregates

/**
 * Seat-weighted mean of per-batch percentages.
 * A plain average across batches lets a 4-student batch swing the centre-wide
 * number as hard as a 40-student one.
 */
export function weightedAverage(
  entries: readonly { value: number | null; weight: number }[],
): number | null {
  let weightedTotal = 0;
  let totalWeight = 0;

  for (const entry of entries) {
    if (entry.value === null || entry.weight <= 0) continue;
    weightedTotal += entry.value * entry.weight;
    totalWeight += entry.weight;
  }

  if (totalWeight === 0) return null;
  return Math.round(weightedTotal / totalWeight);
}

/** Renders a nullable percentage for display without lying about missing data. */
export function formatPercent(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}
