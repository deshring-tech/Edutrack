/**
 * MODULE: Account lifecycle
 *
 * Purpose        Create a new centre — with a password or with Google — and let
 *                any signed-in user change their own password.
 * Responsibility Registration and self-service credential management.
 * Dependencies   db, password, google, session, rate-limit, schemas, audit.
 *
 * REGISTRATION CREATES A TENANT, NOT JUST A USER
 *  Signing up creates a Centre and its first OWNER in one transaction. There is
 *  no such thing as a user without a centre in this model — every query is
 *  scoped by `centreId`, so a user with no tenant could see nothing and would
 *  be a permanently broken account.
 *
 * THIS IS THE ONLY PLACE GOOGLE CAN CREATE AN ACCOUNT.
 *  Signing *in* with Google never creates anything (see auth.service). Creating
 *  a centre is a deliberate act with a name typed by a human, which is what
 *  keeps a stray Gmail address from becoming an account somewhere it should not
 *  exist.
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { ConflictError, ValidationError } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { avatarColorFor, slugify } from "@/lib/auth/credentials";
import { verifyGoogleIdToken } from "@/lib/auth/google";
import { createSession, type SessionUser } from "@/lib/auth/session";
import {
  SIGNUP_RULE,
  assertWithinLimit,
  recordFailure,
} from "@/lib/rate-limit";
import { PLAN, ROLE } from "@/domain/enums";
import {
  changePasswordSchema,
  parseOrThrow,
  registerCentreSchema,
  registerCentreWithGoogleSchema,
} from "../schemas";
import { recordAudit } from "./audit.service";

/** Seats included with a new centre during its trial. */
const DEFAULT_SEAT_LIMIT = 150;

/**
 * Registration is public and unauthenticated, so it is bounded globally as well
 * as per-address. Without this, one script can fill the database with tenants.
 */
const GLOBAL_SIGNUP_KEY = "signup:global";

export interface RegisterResult {
  centreId: string;
  userId: string;
}

// -------------------------------------------------------- password signup --

export async function registerCentre(rawInput: unknown): Promise<RegisterResult> {
  const input = parseOrThrow(registerCentreSchema, rawInput);

  assertWithinLimit(GLOBAL_SIGNUP_KEY, SIGNUP_RULE);
  await assertEmailAvailable(input.email);

  const passwordHash = await hashPassword(input.password);

  const result = await createCentreWithOwner({
    centreName: input.centreName,
    fullName: input.fullName,
    email: input.email,
    passwordHash,
    googleSub: null,
  });

  recordFailure(GLOBAL_SIGNUP_KEY, SIGNUP_RULE);

  await createSession({
    userId: result.userId,
    centreId: result.centreId,
    role: ROLE.OWNER,
    fullName: input.fullName,
    email: input.email,
  });

  logger.info("centre.registered", { centreId: result.centreId, method: "password" });
  return result;
}

// ---------------------------------------------------------- google signup --

/**
 * Create a centre from a verified Google identity.
 * The centre name still comes from the form — Google cannot tell us what the
 * business is called, and an auto-generated name would be wrong forever.
 */
export async function registerCentreWithGoogle(
  rawInput: unknown,
): Promise<RegisterResult> {
  const input = parseOrThrow(registerCentreWithGoogleSchema, rawInput);
  assertWithinLimit(GLOBAL_SIGNUP_KEY, SIGNUP_RULE);

  const identity = await verifyGoogleIdToken(input.credential);
  await assertEmailAvailable(identity.email);

  const result = await createCentreWithOwner({
    centreName: input.centreName,
    fullName: identity.fullName,
    email: identity.email,
    // No password is set. They can add one later from Settings if they want a
    // second way in; until then Google is the only route, which is fine.
    passwordHash: null,
    googleSub: identity.subject,
  });

  recordFailure(GLOBAL_SIGNUP_KEY, SIGNUP_RULE);

  await createSession({
    userId: result.userId,
    centreId: result.centreId,
    role: ROLE.OWNER,
    fullName: identity.fullName,
    email: identity.email,
  });

  logger.info("centre.registered", { centreId: result.centreId, method: "google" });
  return result;
}

// ------------------------------------------------------------------ shared --

interface NewCentreOwner {
  centreName: string;
  fullName: string;
  email: string;
  passwordHash: string | null;
  googleSub: string | null;
}

async function createCentreWithOwner(input: NewCentreOwner): Promise<RegisterResult> {
  const slug = await allocateSlug(slugify(input.centreName) || "centre");

  return db.$transaction(async (tx) => {
    const centre = await tx.centre.create({
      data: {
        name: input.centreName,
        slug,
        plan: PLAN.CENTRE,
        seatLimit: DEFAULT_SEAT_LIMIT,
      },
      select: { id: true },
    });

    const user = await tx.user.create({
      data: {
        centreId: centre.id,
        email: input.email,
        passwordHash: input.passwordHash,
        googleSub: input.googleSub,
        fullName: input.fullName,
        role: ROLE.OWNER,
        avatarColor: avatarColorFor(input.fullName),
        // Registration signs them in immediately, so recording it here keeps
        // the staff list from labelling the person reading it "never signed in".
        lastLoginAt: new Date(),
      },
      select: { id: true },
    });

    await recordAudit(tx, {
      centreId: centre.id,
      actorId: user.id,
      action: "centre.registered",
      targetType: "Centre",
      targetId: centre.id,
      metadata: { centreName: input.centreName, google: Boolean(input.googleSub) },
    });

    return { centreId: centre.id, userId: user.id };
  });
}

/**
 * Reported as a validation error on the email field so it lands inline on the
 * form, rather than as a bare "conflict" the user cannot act on.
 */
async function assertEmailAvailable(email: string): Promise<void> {
  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    throw new ValidationError("An account with that email already exists.", {
      email: ["That email is already registered — sign in instead"],
    });
  }
}

/**
 * Find a free slug, appending a counter on collision.
 * Two centres called "Bright Minds" is entirely plausible.
 */
async function allocateSlug(base: string): Promise<string> {
  for (let suffix = 0; suffix < 50; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;
    const taken = await db.centre.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }

  // Practically unreachable; a random suffix is still better than throwing.
  return `${base}-${Date.now().toString(36)}`;
}

// -------------------------------------------------------- password change --

/** Change your own password. Never anyone else's — that is a reset, not this. */
export async function changeOwnPassword(
  session: SessionUser,
  rawInput: unknown,
): Promise<void> {
  const input = parseOrThrow(changePasswordSchema, rawInput);

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, centreId: true, passwordHash: true },
  });

  if (!user) throw new ConflictError("Your account could not be loaded.");

  // A Google-only account has no current password to prove. Sending them to the
  // reset flow is the safe route: it proves control of the mailbox instead.
  if (!user.passwordHash) {
    throw new ValidationError(
      "This account signs in with Google. Use “Forgot password” to set one.",
      { currentPassword: ["No password is set for this account"] },
    );
  }

  const matches = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!matches) {
    logger.warn("account.password_change.rejected", { userId: user.id });
    throw new ValidationError("That is not your current password.", {
      currentPassword: ["Incorrect password"],
    });
  }

  const passwordHash = await hashPassword(input.newPassword);

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash } });

    await recordAudit(tx, {
      centreId: user.centreId,
      actorId: user.id,
      action: "account.password_changed",
      targetType: "User",
      targetId: user.id,
    });
  });

  logger.info("account.password_changed", { userId: user.id });
}
