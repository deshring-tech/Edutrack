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
  ROLE,
  type AttendanceStatus,
  type HomeworkStatus,
} from "@/domain/enums";
import { ValidationError } from "@/lib/errors";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/domain/password-policy";

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

// ------------------------------------------------- registration & account --

const nameSchema = z.string().trim().min(2, "Enter a full name").max(120);

export const registerCentreSchema = z.object({
  centreName: z.string().trim().min(2, "Enter your centre's name").max(120),
  fullName: nameSchema,
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: passwordSchema,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    path: ["newPassword"],
    message: "Choose a password you have not used here before",
  });

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(20, "That reset link is not valid").max(200),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

/** The ID token the Google widget hands back to the browser. */
export const googleCredentialSchema = z.object({
  credential: z.string().min(20, "Google sign-in did not return a token"),
});

/**
 * Registering with Google still needs a centre name: Google can tell us who the
 * person is, but not what their business is called.
 */
export const registerCentreWithGoogleSchema = googleCredentialSchema.extend({
  centreName: z.string().trim().min(2, "Enter your centre's name").max(120),
});

// ------------------------------------------------------------ administration --

export const createStaffSchema = z.object({
  fullName: nameSchema,
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  phone: z.string().trim().max(20).optional(),
  role: z.enum([ROLE.TEACHER, ROLE.OWNER]),
});

export const createStudentSchema = z
  .object({
    fullName: nameSchema,
    gradeLabel: z.string().trim().max(40).optional(),
    batchId: idSchema.optional(),
    guardianName: z.string().trim().max(120).optional(),
    guardianEmail: z
      .string()
      .trim()
      .toLowerCase()
      .email("Enter a valid guardian email")
      .optional()
      .or(z.literal("")),
    guardianPhone: z.string().trim().max(20).optional(),
  })
  // A guardian email without a name would create an account nobody can identify
  // in the centre's own staff list.
  .refine(
    (value) => !value.guardianEmail || Boolean(value.guardianName),
    { path: ["guardianName"], message: "Add the guardian's name too" },
  );

export const createBatchSchema = z.object({
  name: z.string().trim().min(2, "Name the batch").max(80),
  subject: z.string().trim().min(2, "Enter the subject").max(60),
  gradeLabel: z.string().trim().min(1, "Add a short label").max(20),
  teacherId: idSchema,
  colorHex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #7E57C2")
    .optional(),
});

export const updateEnrollmentSchema = z.object({
  batchId: idSchema,
  studentId: idSchema,
  enrolled: z.union([z.literal("true"), z.literal("false")]).transform((v) => v === "true"),
});

export const deactivateUserSchema = z.object({ userId: idSchema });
export const deactivateStudentSchema = z.object({ studentId: idSchema });

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
