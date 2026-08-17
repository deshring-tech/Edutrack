/**
 * MODULE: Rate limiting
 *
 * Purpose        Slow down repeated attempts against the endpoints that are
 *                worth attacking.
 * Responsibility Fixed-window counting, keyed by caller-supplied string.
 * Dependencies   @/lib/errors.
 *
 * WHY IT IS IN MEMORY (a deliberate, documented trade-off)
 *  Counters live in the process. On one instance that is genuinely effective.
 *  Across N serverless instances the real limit becomes `max × N`, because each
 *  has its own map.
 *
 *  That is acceptable for the current deployment and useless at scale. The fix
 *  is to back `consume` with Redis; every call site already goes through this
 *  one function, so nothing else changes. Pretending it is stronger than it is
 *  would be worse than the limitation itself.
 *
 * MEMORY
 *  Entries are swept lazily on write, so an idle process does not grow without
 *  bound after a burst of traffic.
 */

import { RateLimitError } from "./errors";

export interface RateLimitRule {
  /** Attempts permitted inside the window. */
  max: number;
  windowMs: number;
}

/** Failed sign-in attempts for one email address. */
export const LOGIN_RULE: RateLimitRule = { max: 8, windowMs: 15 * 60 * 1000 };

/** New centre registrations. Public and unauthenticated, so worth bounding. */
export const SIGNUP_RULE: RateLimitRule = { max: 5, windowMs: 60 * 60 * 1000 };

/** Password reset requests for one email address. */
export const PASSWORD_RESET_RULE: RateLimitRule = { max: 5, windowMs: 60 * 60 * 1000 };

/** Google sign-in attempts, which are cheap for us but not free. */
export const GOOGLE_SIGN_IN_RULE: RateLimitRule = { max: 20, windowMs: 15 * 60 * 1000 };

interface Attempt {
  count: number;
  windowStartedAt: number;
}

const attempts = new Map<string, Attempt>();

/** Remove expired entries so a traffic spike does not leak memory forever. */
function sweep(now: number): void {
  for (const [key, attempt] of attempts) {
    // The longest window in use bounds how long anything needs to be kept.
    if (now - attempt.windowStartedAt > 60 * 60 * 1000) attempts.delete(key);
  }
}

/**
 * Throw if `key` has already exhausted `rule` inside the current window.
 * Call before doing the expensive work, and record the outcome with
 * `recordFailure` / `clearAttempts`.
 */
export function assertWithinLimit(key: string, rule: RateLimitRule): void {
  const attempt = attempts.get(key);
  if (!attempt) return;

  if (Date.now() - attempt.windowStartedAt > rule.windowMs) {
    attempts.delete(key);
    return;
  }

  if (attempt.count >= rule.max) throw new RateLimitError();
}

/** Count one failed attempt against `key`. */
export function recordFailure(key: string, rule: RateLimitRule): void {
  const now = Date.now();
  const attempt = attempts.get(key);

  if (!attempt || now - attempt.windowStartedAt > rule.windowMs) {
    sweep(now);
    attempts.set(key, { count: 1, windowStartedAt: now });
    return;
  }

  attempt.count += 1;
}

/** Forget a key's failures — called after a successful attempt. */
export function clearAttempts(key: string): void {
  attempts.delete(key);
}

/** Test seam. Never call from application code. */
export function resetAllLimits(): void {
  attempts.clear();
}
