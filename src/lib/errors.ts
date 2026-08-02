/**
 * MODULE: Application errors
 *
 * Purpose        Give every failure a type, an HTTP status and a message that
 *                is safe to show a user.
 * Responsibility Separate "what went wrong" from "what we tell the browser".
 * Dependencies   ./logger.
 *
 * WHY A SAFE-MESSAGE DISTINCTION
 *  `error.message` frequently contains a SQL fragment, a file path or a
 *  constraint name. Returning it to the browser is an information leak and
 *  looks amateurish. Errors defined here are explicitly marked as safe to
 *  display; everything else is logged in full and reported generically.
 */

import { logger } from "./logger";

export abstract class AppError extends Error {
  abstract readonly status: number;
  abstract readonly code: string;
  /** True when `message` may be rendered verbatim in the UI. */
  readonly isSafeToDisplay = true;

  constructor(
    message: string,
    readonly context: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** The caller is not signed in, or the session has expired. */
export class UnauthenticatedError extends AppError {
  readonly status = 401;
  readonly code = "UNAUTHENTICATED";

  constructor(message = "Please sign in to continue.") {
    super(message);
  }
}

/** The caller is signed in but may not touch this resource. */
export class ForbiddenError extends AppError {
  readonly status = 403;
  readonly code = "FORBIDDEN";

  constructor(message = "You do not have access to this.") {
    super(message);
  }
}

export class NotFoundError extends AppError {
  readonly status = 404;
  readonly code = "NOT_FOUND";

  constructor(message = "That record no longer exists.") {
    super(message);
  }
}

/** Input failed validation. `fieldErrors` drives inline form messages. */
export class ValidationError extends AppError {
  readonly status = 422;
  readonly code = "VALIDATION_FAILED";

  constructor(
    message = "Please check the highlighted fields.",
    readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message, { fieldErrors });
  }
}

/** The action conflicts with the current state (duplicate, seat limit, …). */
export class ConflictError extends AppError {
  readonly status = 409;
  readonly code = "CONFLICT";
}

/** Too many attempts — used by the login throttle. */
export class RateLimitError extends AppError {
  readonly status = 429;
  readonly code = "RATE_LIMITED";

  constructor(message = "Too many attempts. Please wait a moment and try again.") {
    super(message);
  }
}

export interface ErrorPresentation {
  status: number;
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

const GENERIC_FAILURE: ErrorPresentation = {
  status: 500,
  code: "INTERNAL_ERROR",
  message: "Something went wrong on our side. Please try again.",
};

/**
 * Convert any thrown value into a response-safe shape, logging whatever the
 * user is not allowed to see. This is the only place errors become output.
 */
export function presentError(error: unknown, event = "request.failed"): ErrorPresentation {
  if (error instanceof ValidationError) {
    return {
      status: error.status,
      code: error.code,
      message: error.message,
      fieldErrors: error.fieldErrors,
    };
  }

  if (error instanceof AppError) {
    // Expected, handled outcomes — logged at warn so they do not page anyone.
    logger.warn(event, { code: error.code, message: error.message, ...error.context });
    return { status: error.status, code: error.code, message: error.message };
  }

  logger.error(event, {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  return GENERIC_FAILURE;
}
