/**
 * MODULE: Authentication
 *
 * Purpose        Verify credentials and start a session.
 * Responsibility Login, logout, and the throttle that protects them.
 * Dependencies   @/lib/db, @/lib/auth/*, schemas, audit service.
 *
 * SECURITY PROPERTIES
 *  1. No user enumeration — an unknown email and a wrong password produce the
 *     same message and the same response time.
 *  2. Throttled — repeated failures for one email are slowed down, so a stolen
 *     password list cannot be tried at speed.
 *  3. Deactivated accounts cannot sign in, even with the right password.
 *
 * THROTTLE LIMITATION (deliberate, documented)
 *  Attempts are counted in process memory. On a single instance that is
 *  effective. Across several serverless instances each has its own counter, so
 *  the real limit is `MAX_ATTEMPTS × instances`. Moving this to Redis is the
 *  fix when the app scales horizontally; the interface below does not change.
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { ForbiddenError, RateLimitError, ValidationError } from "@/lib/errors";
import { burnEquivalentWork, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, type SessionUser } from "@/lib/auth/session";
import type { Role } from "@/domain/enums";
import { loginSchema, parseOrThrow } from "../schemas";
import { recordAudit } from "./audit.service";

const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;

interface AttemptRecord {
  count: number;
  firstAttemptAt: number;
}

const attemptsByKey = new Map<string, AttemptRecord>();

function throttleKey(email: string): string {
  return email.toLowerCase();
}

function assertNotThrottled(email: string): void {
  const record = attemptsByKey.get(throttleKey(email));
  if (!record) return;

  if (Date.now() - record.firstAttemptAt > WINDOW_MS) {
    attemptsByKey.delete(throttleKey(email));
    return;
  }

  if (record.count >= MAX_ATTEMPTS) throw new RateLimitError();
}

function recordFailure(email: string): void {
  const key = throttleKey(email);
  const record = attemptsByKey.get(key);

  if (!record || Date.now() - record.firstAttemptAt > WINDOW_MS) {
    attemptsByKey.set(key, { count: 1, firstAttemptAt: Date.now() });
    return;
  }

  record.count += 1;
}

function clearFailures(email: string): void {
  attemptsByKey.delete(throttleKey(email));
}

/** One message for every failure mode, so nothing is leaked by the difference. */
const INVALID_CREDENTIALS = "That email and password do not match.";

export interface LoginResult {
  userId: string;
  role: Role;
  fullName: string;
}

export async function login(rawInput: unknown): Promise<LoginResult> {
  const input = parseOrThrow(loginSchema, rawInput);
  assertNotThrottled(input.email);

  const user = await db.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      centreId: true,
      email: true,
      fullName: true,
      role: true,
      passwordHash: true,
      isActive: true,
    },
  });

  if (!user) {
    // Spend the same CPU a real verification would, so timing reveals nothing.
    await burnEquivalentWork(input.password);
    recordFailure(input.email);
    throw new ValidationError(INVALID_CREDENTIALS);
  }

  const passwordMatches = await verifyPassword(input.password, user.passwordHash);

  if (!passwordMatches) {
    recordFailure(input.email);
    logger.warn("auth.login.failed", { userId: user.id });
    throw new ValidationError(INVALID_CREDENTIALS);
  }

  if (!user.isActive) {
    throw new ForbiddenError("This account has been deactivated. Contact your centre.");
  }

  clearFailures(input.email);

  await createSession({
    userId: user.id,
    centreId: user.centreId,
    role: user.role as Role,
    fullName: user.fullName,
    email: user.email,
  });

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await recordAudit(tx, {
      centreId: user.centreId,
      actorId: user.id,
      action: "auth.login",
      targetType: "User",
      targetId: user.id,
    });
  });

  logger.info("auth.login.succeeded", { userId: user.id, role: user.role });

  return { userId: user.id, role: user.role as Role, fullName: user.fullName };
}

export async function logout(session: SessionUser | null): Promise<void> {
  if (session) {
    logger.info("auth.logout", { userId: session.userId });
  }
  await destroySession();
}
