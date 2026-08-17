/**
 * MODULE: Authentication
 *
 * Purpose        Verify credentials — a password or a Google identity — and
 *                start a session.
 * Responsibility Sign-in, sign-out, and the rules about which accounts may.
 * Dependencies   db, auth/*, rate-limit, schemas, audit service.
 *
 * SECURITY PROPERTIES
 *  1. No user enumeration — an unknown email, a wrong password and an account
 *     with no password all produce the same message and the same response time.
 *  2. Throttled — repeated failures for one email are slowed, so a stolen
 *     password list cannot be tried at speed.
 *  3. Deactivated accounts cannot sign in by any route.
 *  4. Google identities are matched on Google's immutable subject id first, and
 *     only then on a verified email address.
 *
 * GOOGLE IS A SIGN-IN METHOD, NOT A SIGN-UP METHOD.
 *  Signing in with Google never creates a teacher or parent account. Membership
 *  of a centre is granted by its owner, and a stranger with a Gmail address
 *  must not be able to manufacture themselves an account. Creating a *new
 *  centre* from Google is a separate, deliberate flow in `account.service.ts`.
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { burnEquivalentWork, verifyPassword } from "@/lib/auth/password";
import { verifyGoogleIdToken, type GoogleIdentity } from "@/lib/auth/google";
import { createSession, destroySession, type SessionUser } from "@/lib/auth/session";
import {
  GOOGLE_SIGN_IN_RULE,
  LOGIN_RULE,
  assertWithinLimit,
  clearAttempts,
  recordFailure,
} from "@/lib/rate-limit";
import type { Role } from "@/domain/enums";
import { loginSchema, parseOrThrow } from "../schemas";
import { recordAudit } from "./audit.service";

/**
 * One message for every failure mode, so nothing is revealed by the difference.
 *
 * This deliberately covers the "your account signs in with Google, not a
 * password" case too. Saying so would be friendlier, and would also confirm to
 * anyone guessing that the address is registered here.
 */
const INVALID_CREDENTIALS = "That email and password do not match.";

function loginKey(email: string): string {
  return `login:${email.toLowerCase()}`;
}

export interface LoginResult {
  userId: string;
  role: Role;
  fullName: string;
}

// ------------------------------------------------------------- password ----

export async function login(rawInput: unknown): Promise<LoginResult> {
  const input = parseOrThrow(loginSchema, rawInput);
  assertWithinLimit(loginKey(input.email), LOGIN_RULE);

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

  // Spend the same CPU a real verification would, so timing reveals nothing —
  // whether the account is missing entirely or simply has no password set.
  if (!user || !user.passwordHash) {
    await burnEquivalentWork(input.password);
    recordFailure(loginKey(input.email), LOGIN_RULE);
    throw new ValidationError(INVALID_CREDENTIALS);
  }

  const passwordMatches = await verifyPassword(input.password, user.passwordHash);

  if (!passwordMatches) {
    recordFailure(loginKey(input.email), LOGIN_RULE);
    logger.warn("auth.login.failed", { userId: user.id });
    throw new ValidationError(INVALID_CREDENTIALS);
  }

  assertActive(user.isActive);
  clearAttempts(loginKey(input.email));

  await startSession(user);
  logger.info("auth.login.succeeded", { userId: user.id, role: user.role });

  return { userId: user.id, role: user.role as Role, fullName: user.fullName };
}

// --------------------------------------------------------------- google ----

/**
 * Sign in an existing user with Google.
 *
 * Matching order matters. `googleSub` is Google's immutable id and is checked
 * first; email is only used to adopt an account that predates Google sign-in,
 * and only when Google says the address is verified.
 */
export async function signInWithGoogle(idToken: unknown): Promise<LoginResult> {
  const identity = await verifyGoogleIdToken(idToken);
  assertWithinLimit(`google:${identity.email}`, GOOGLE_SIGN_IN_RULE);

  const user = await findUserForGoogleIdentity(identity);

  if (!user) {
    recordFailure(`google:${identity.email}`, GOOGLE_SIGN_IN_RULE);
    logger.warn("auth.google.no_account", { email: identity.email });

    // Explicit and actionable: accounts are created by a centre, not by Google.
    throw new NotFoundError(
      "No EduTrack account uses that Google address. Ask your centre to add you, or create a new centre.",
    );
  }

  assertActive(user.isActive);

  // Bind the Google identity on first use so later sign-ins match on `sub`
  // even if the address changes.
  if (!user.googleSub) {
    await db.user.update({
      where: { id: user.id },
      data: { googleSub: identity.subject },
    });
  }

  clearAttempts(`google:${identity.email}`);

  await startSession(user);
  logger.info("auth.google.succeeded", { userId: user.id, role: user.role });

  return { userId: user.id, role: user.role as Role, fullName: user.fullName };
}

interface MatchedUser {
  id: string;
  centreId: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  googleSub: string | null;
}

async function findUserForGoogleIdentity(
  identity: GoogleIdentity,
): Promise<MatchedUser | null> {
  const selection = {
    id: true,
    centreId: true,
    email: true,
    fullName: true,
    role: true,
    isActive: true,
    googleSub: true,
  } as const;

  const bySubject = await db.user.findUnique({
    where: { googleSub: identity.subject },
    select: selection,
  });
  if (bySubject) return bySubject;

  const byEmail = await db.user.findUnique({
    where: { email: identity.email },
    select: selection,
  });

  // Only adopt an account whose Google identity is not already bound to a
  // different subject — otherwise a reassigned address could hijack it.
  if (byEmail && byEmail.googleSub === null) return byEmail;

  return null;
}

// -------------------------------------------------------------- shared ----

function assertActive(isActive: boolean): void {
  if (!isActive) {
    throw new ForbiddenError("This account has been deactivated. Contact your centre.");
  }
}

async function startSession(user: {
  id: string;
  centreId: string;
  email: string;
  fullName: string;
  role: string;
}): Promise<void> {
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
}

export async function logout(session: SessionUser | null): Promise<void> {
  if (session) logger.info("auth.logout", { userId: session.userId });
  await destroySession();
}
