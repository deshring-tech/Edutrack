/**
 * MODULE: Domain enumerations
 *
 * Purpose        Define every closed set of values the product understands.
 * Responsibility Be the single place a value like "PRESENT" is declared, so the
 *                database (which stores plain strings), the Zod validators and
 *                the UI can never drift apart.
 * Dependencies   None. This file must stay free of framework and I/O imports.
 * Inputs/Outputs Constants and derived TypeScript union types.
 *
 * Future extension points
 *  - When the production database moves to PostgreSQL these become native
 *    enums; the TypeScript unions below stay exactly as they are.
 */

// --------------------------------------------------------------------- roles

export const ROLE = {
  OWNER: "OWNER",
  TEACHER: "TEACHER",
  PARENT: "PARENT",
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export const ROLES = Object.values(ROLE);

/** Staff can see centre-wide data; parents only ever see their own children. */
export const STAFF_ROLES: readonly Role[] = [ROLE.OWNER, ROLE.TEACHER];

// ---------------------------------------------------------------- attendance

export const ATTENDANCE_STATUS = {
  PRESENT: "PRESENT",
  ABSENT: "ABSENT",
  LATE: "LATE",
  EXCUSED: "EXCUSED",
} as const;

export type AttendanceStatus =
  (typeof ATTENDANCE_STATUS)[keyof typeof ATTENDANCE_STATUS];

export const ATTENDANCE_STATUSES = Object.values(ATTENDANCE_STATUS);

/**
 * How much each status contributes to an attendance percentage.
 * LATE still counts as attending, but not fully — a centre that scores a
 * habitually late student at 100% is lying to the parent.
 * EXCUSED is handled separately: it is excluded from the denominator entirely.
 */
export const ATTENDANCE_CREDIT: Record<AttendanceStatus, number> = {
  PRESENT: 1,
  LATE: 0.5,
  ABSENT: 0,
  EXCUSED: 0,
};

/** Statuses that do not count against a student (removed from the denominator). */
export const ATTENDANCE_EXCLUDED_FROM_RATE: readonly AttendanceStatus[] = [
  ATTENDANCE_STATUS.EXCUSED,
];

// ------------------------------------------------------------------ homework

export const HOMEWORK_STATUS = {
  DONE: "DONE",
  PARTIAL: "PARTIAL",
  MISSING: "MISSING",
} as const;

export type HomeworkStatus =
  (typeof HOMEWORK_STATUS)[keyof typeof HOMEWORK_STATUS];

export const HOMEWORK_STATUSES = Object.values(HOMEWORK_STATUS);

export const HOMEWORK_CREDIT: Record<HomeworkStatus, number> = {
  DONE: 1,
  PARTIAL: 0.5,
  MISSING: 0,
};

// ------------------------------------------------------------------ timeline

export const TIMELINE_KIND = {
  ATTENDANCE: "ATTENDANCE",
  HOMEWORK: "HOMEWORK",
  ASSIGNMENT: "ASSIGNMENT",
  ASSESSMENT: "ASSESSMENT",
  ENGAGEMENT: "ENGAGEMENT",
  NOTE: "NOTE",
} as const;

export type TimelineKind = (typeof TIMELINE_KIND)[keyof typeof TIMELINE_KIND];

export const TIMELINE_KINDS = Object.values(TIMELINE_KIND);

/**
 * What produced a timeline entry. Combined with the source row id this forms
 * the idempotency key, so replaying a save updates instead of duplicating.
 */
export const TIMELINE_SOURCE = {
  ATTENDANCE_RECORD: "ATTENDANCE_RECORD",
  HOMEWORK_RECORD: "HOMEWORK_RECORD",
  ASSIGNMENT: "ASSIGNMENT",
  ASSESSMENT: "ASSESSMENT",
  ENGAGEMENT_LOG: "ENGAGEMENT_LOG",
  MANUAL_NOTE: "MANUAL_NOTE",
} as const;

export type TimelineSource = (typeof TIMELINE_SOURCE)[keyof typeof TIMELINE_SOURCE];

// ------------------------------------------------------------- notifications

export const NOTIFICATION_CHANNEL = {
  CONSOLE: "CONSOLE",
  WEBHOOK: "WEBHOOK",
  WHATSAPP: "WHATSAPP",
  EMAIL: "EMAIL",
} as const;

export type NotificationChannel =
  (typeof NOTIFICATION_CHANNEL)[keyof typeof NOTIFICATION_CHANNEL];

export const NOTIFICATION_STATUS = {
  PENDING: "PENDING",
  SENT: "SENT",
  FAILED: "FAILED",
  /** Permanently abandoned after exhausting retries; needs human attention. */
  DEAD: "DEAD",
} as const;

export type NotificationStatus =
  (typeof NOTIFICATION_STATUS)[keyof typeof NOTIFICATION_STATUS];

// -------------------------------------------------------------------- plans

export const PLAN = {
  SOLO: "SOLO",
  CENTRE: "CENTRE",
  INSTITUTE: "INSTITUTE",
} as const;

export type Plan = (typeof PLAN)[keyof typeof PLAN];
