/**
 * MODULE: Structured logging
 *
 * Purpose        Emit machine-readable logs that a hosting platform can index.
 * Responsibility Enforce one log shape, and redact anything that must never
 *                reach a log aggregator.
 * Dependencies   None (reads NODE_ENV directly so it is safe to import from
 *                `env.ts` itself, which must be able to log its own failures).
 *
 * WHY NOT console.log
 *  `console.log("saved", data)` is unsearchable and, worse, cheerfully prints
 *  password hashes and phone numbers. This wrapper makes the common case a
 *  single line of JSON with an event name, and drops sensitive keys by default.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

/** Keys whose values are never written to a log, at any level. */
const REDACTED_KEYS = new Set([
  "password",
  "passwordhash",
  "confirmpassword",
  "token",
  "accesstoken",
  "sessionsecret",
  "cronsecret",
  "authorization",
  "cookie",
  "phone",
]);

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const isProductionRuntime = process.env.NODE_ENV === "production";
const minimumLevel: LogLevel = isProductionRuntime ? "info" : "debug";

function redact(context: LogContext): LogContext {
  const safe: LogContext = {};

  for (const [key, value] of Object.entries(context)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      safe[key] = "[redacted]";
      continue;
    }
    if (value instanceof Error) {
      safe[key] = { name: value.name, message: value.message };
      continue;
    }
    safe[key] = value;
  }

  return safe;
}

function write(level: LogLevel, event: string, context: LogContext = {}): void {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[minimumLevel]) return;

  const line = {
    level,
    event,
    time: new Date().toISOString(),
    ...redact(context),
  };

  const serialised = isProductionRuntime
    ? JSON.stringify(line)
    : `${level.toUpperCase().padEnd(5)} ${event} ${formatForHumans(line)}`;

  if (level === "error") console.error(serialised);
  else if (level === "warn") console.warn(serialised);
  else console.log(serialised);
}

/** The envelope keys are already printed in the prefix, so drop them here. */
const ENVELOPE_KEYS = new Set(["level", "event", "time"]);

function formatForHumans(line: Record<string, unknown>): string {
  const details: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(line)) {
    if (ENVELOPE_KEYS.has(key)) continue;
    details[key] = value;
  }

  return Object.keys(details).length === 0 ? "" : JSON.stringify(details);
}

export const logger = {
  debug: (event: string, context?: LogContext) => write("debug", event, context),
  info: (event: string, context?: LogContext) => write("info", event, context),
  warn: (event: string, context?: LogContext) => write("warn", event, context),
  error: (event: string, context?: LogContext) => write("error", event, context),
};
