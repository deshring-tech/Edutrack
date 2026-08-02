/**
 * MODULE: Input validation schemas
 *
 * Purpose        Validate every value that crosses into the server, once.
 * Responsibility Define the shape and limits of all mutation inputs, and turn
 *                validation failures into the app's own ValidationError.
 * Dependencies   zod, @/domain/enums, @/lib/errors.
 *
 * WHY EVERY ACTION VALIDATES
 *  Server Actions are public HTTP endpoints. The form that called them is not a
 *  guarantee of anything: an attacker posts whatever they like. Type
 *  annotations vanish at runtime, so Zod is the actual boundary.
 *
 *  Upper bounds matter as much as types. `marks: z.array(...)` without `.max()`
 *  lets one request queue a million notification rows.
 */

import { z } from "zod";
import {
  ATTENDANCE_STATUSES,
  HOMEWORK_STATUSES,
  type AttendanceStatus,
  type HomeworkStatus,
} from "@/domain/enums";
import { ValidationError } from "@/lib/errors";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/password";

/** Largest batch we accept in a single save. Comfortably above any real class. */
export const MAX_ROSTER_SIZE = 300;

const NOTE_MAX_LENGTH = 1_000;
const TITLE_MAX_LENGTH = 120;

export const idSchema = z.string().trim().min(1).max(64);

/** `YYYY-MM-DD`, the canonical day key. */
export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date in YYYY-MM-DD format");

const attendanceStatusSchema = z.enum(
  ATTENDANCE_STATUSES as [AttendanceStatus, ...AttendanceStatus[]],
);

const homeworkStatusSchema = z.enum(
  HOMEWORK_STATUSES as [HomeworkStatus, ...HomeworkStatus[]],
);

// --------------------------------------------------------------------- auth

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z
    .string()
    .min(1, "Enter your password")
    .max(PASSWORD_MAX_LENGTH, "Password is too long"),
});

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH);

// --------------------------------------------------------------- attendance

export const saveAttendanceSchema = z.object({
  batchId: idSchema,
  sessionDate: dateStringSchema,
  marks: z
    .array(z.object({ studentId: idSchema, status: attendanceStatusSchema }))
    .min(1, "Mark at least one student")
    .max(MAX_ROSTER_SIZE),
});

export type SaveAttendanceInput = z.infer<typeof saveAttendanceSchema>;

// ----------------------------------------------------------------- homework

export const saveHomeworkSchema = z.object({
  batchId: idSchema,
  recordedOn: dateStringSchema,
  assignmentId: idSchema.optional(),
  marks: z
    .array(z.object({ studentId: idSchema, status: homeworkStatusSchema }))
    .min(1, "Record at least one student")
    .max(MAX_ROSTER_SIZE),
});

export type SaveHomeworkInput = z.infer<typeof saveHomeworkSchema>;

// --------------------------------------------------------------- assessment

/**
 * Scores are validated against `maxScore` in the service, not here: Zod cannot
 * express "score <= maxScore" per element cleanly, and the check belongs with
 * the rule that a teacher may not record 30/25 by accident.
 */
export const saveAssessmentSchema = z.object({
  batchId: idSchema,
  title: z.string().trim().min(1, "Give the test a name").max(TITLE_MAX_LENGTH),
  maxScore: z.coerce
    .number()
    .positive("Total marks must be greater than zero")
    .max(1000),
  assessedOn: dateStringSchema,
  scores: z
    .array(
      z.object({
        studentId: idSchema,
        score: z.coerce.number().min(0, "Scores cannot be negative").max(1000),
      }),
    )
    .min(1, "Enter at least one score")
    .max(MAX_ROSTER_SIZE),
});

export type SaveAssessmentInput = z.infer<typeof saveAssessmentSchema>;

// --------------------------------------------------------- notes & assignments

export const postNoteSchema = z.object({
  studentId: idSchema,
  body: z
    .string()
    .trim()
    .min(1, "Write a message first")
    .max(NOTE_MAX_LENGTH, `Keep notes under ${NOTE_MAX_LENGTH} characters`),
});

export const postAssignmentSchema = z.object({
  batchId: idSchema,
  title: z.string().trim().min(1, "Give the assignment a title").max(TITLE_MAX_LENGTH),
  description: z.string().trim().max(NOTE_MAX_LENGTH).optional(),
  dueDate: dateStringSchema.optional(),
  attachmentName: z.string().trim().max(TITLE_MAX_LENGTH).optional(),
});

export const logEngagementSchema = z.object({
  studentId: idSchema,
  batchId: idSchema.optional(),
  /**
   * Bounded deliberately: engagement is a nudge, not a score a teacher can
   * drive to 100 by tapping a button twenty times.
   */
  delta: z.coerce.number().int().min(-10).max(10),
  note: z.string().trim().max(NOTE_MAX_LENGTH).optional(),
});

export const acknowledgeSchema = z.object({
  timelineEntryId: idSchema,
});

// ------------------------------------------------------------------ helpers

/**
 * Parse or throw a ValidationError carrying per-field messages.
 * Every server action starts with this, so forms get inline errors for free.
 */
export function parseOrThrow<Schema extends z.ZodTypeAny>(
  schema: Schema,
  input: unknown,
): z.infer<Schema> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const flattened = result.error.flatten();
  const firstFieldMessage = Object.values(flattened.fieldErrors)
    .flat()
    .find((message): message is string => Boolean(message));

  throw new ValidationError(
    firstFieldMessage ?? flattened.formErrors[0] ?? "Please check the form and try again.",
    flattened.fieldErrors as Record<string, string[]>,
  );
}
