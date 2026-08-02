/**
 * MODULE: Timeline message composition
 *
 * Purpose        Turn a logged event into the sentence a parent actually reads.
 * Responsibility Own the product's voice. Every parent-facing string that
 *                describes a child's day is written here and nowhere else.
 * Dependencies   `./enums`, `./metrics`. No I/O, no framework.
 * Inputs         Structured facts about one event for one student.
 * Outputs        `{ kind, body }` ready to persist as a TimelineEntry.
 *
 * WHY THIS IS CENTRALISED
 *  Tone is a product feature here. "Marked absent today." and "Your child
 *  skipped class" carry the same data and completely different relationships
 *  with the parent. Keeping every sentence in one file means tone can be
 *  reviewed, translated, and A/B tested without touching business logic.
 *
 * Future extension points
 *  - Localisation (Hindi, Marathi, Tamil): swap this module for a keyed
 *    catalogue; the call sites already pass structured data rather than text.
 */

import {
  TIMELINE_KIND,
  type AttendanceStatus,
  type HomeworkStatus,
  type TimelineKind,
} from "./enums";
import { scorePercent } from "./metrics";

export interface ComposedEntry {
  kind: TimelineKind;
  body: string;
}

const ATTENDANCE_MESSAGE: Record<AttendanceStatus, string> = {
  PRESENT: "Present in today's session.",
  ABSENT: "Marked absent today. Please let us know the reason.",
  LATE: "Arrived late to today's session.",
  EXCUSED: "Absent today — excused, thank you for informing us.",
};

export function composeAttendance(status: AttendanceStatus): ComposedEntry {
  return { kind: TIMELINE_KIND.ATTENDANCE, body: ATTENDANCE_MESSAGE[status] };
}

const HOMEWORK_MESSAGE: Record<HomeworkStatus, string> = {
  DONE: "Homework completed.",
  PARTIAL: "Homework partly done — a little left to finish.",
  MISSING: "Homework not submitted today.",
};

export function composeHomework(
  status: HomeworkStatus,
  assignmentTitle?: string | null,
): ComposedEntry {
  const base = HOMEWORK_MESSAGE[status];
  const body = assignmentTitle ? `${assignmentTitle} — ${lowerFirst(base)}` : base;
  return { kind: TIMELINE_KIND.HOMEWORK, body };
}

export interface AssignmentFacts {
  title: string;
  dueDate?: Date | null;
  attachmentName?: string | null;
  formatDate: (date: Date) => string;
}

export function composeAssignment(facts: AssignmentFacts): ComposedEntry {
  const parts = [`New assignment: ${facts.title}`];
  if (facts.dueDate) parts.push(`due ${facts.formatDate(facts.dueDate)}`);
  if (facts.attachmentName) parts.push(`attached: ${facts.attachmentName}`);
  return { kind: TIMELINE_KIND.ASSIGNMENT, body: parts.join(" · ") };
}

export interface AssessmentFacts {
  title: string;
  score: number;
  maxScore: number;
}

export function composeAssessment(facts: AssessmentFacts): ComposedEntry {
  const percent = scorePercent(facts);
  const suffix = percent === null ? "" : ` (${percent}%)`;
  return {
    kind: TIMELINE_KIND.ASSESSMENT,
    body: `${facts.title}: ${formatScore(facts.score)}/${formatScore(facts.maxScore)}${suffix}`,
  };
}

export function composeEngagement(delta: number, note?: string | null): ComposedEntry {
  if (note && note.trim()) {
    return { kind: TIMELINE_KIND.ENGAGEMENT, body: note.trim() };
  }
  const body =
    delta >= 0
      ? "Actively engaged in class today."
      : "Seemed distracted in class today — worth a gentle word at home.";
  return { kind: TIMELINE_KIND.ENGAGEMENT, body };
}

export function composeNote(text: string): ComposedEntry {
  return { kind: TIMELINE_KIND.NOTE, body: text.trim() };
}

// ----------------------------------------------------------------- helpers --

/** Trims trailing zeros so 18.0/25 reads as "18/25". */
function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
