/**
 * MODULE: Account lifecycle
 *
 * Purpose        Create a new centre, and let any signed-in user change their
 *                own password.
 * Responsibility Registration and self-service credential management.
 * Dependencies   db, password, session, schemas, audit service.
 *
 * REGISTRATION CREATES A TENANT, NOT JUST A USER
 *  Signing up creates a Centre and its first OWNER in one transaction. There is
 *  no such thing as a user without a centre in this model — every query is
 *  scoped by `centreId`, so a user with no tenant could see nothing and would
 *  be a permanently broken account.
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { ConflictError, ValidationError } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { avatarColorFor, slugify } from "@/lib/auth/credentials";
import { createSession, type SessionUser } from "@/lib/auth/session";
import { PLAN, ROLE } from "@/domain/enums";
import {
  changePasswordSchema,
  parseOrThrow,
  registerCentreSchema,
} from "../schemas";
import { recordAudit } from "./audit.service";

/** Seats included with a new centre during its trial. */
const DEFAULT_SEAT_LIMIT = 150;

export interface RegisterResult {
  centreId: string;
  userId: string;
}

/**
 * Create a centre and sign its owner in.
 * The caller is anonymous by definition, so there is no session to authorise.
 */
export async function registerCentre(rawInput: unknown): Promise<RegisterResult> {
  const input = parseOrThrow(registerCentreSchema, rawInput);

  const existing = await db.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  // Reported as a validation error on the email field so it lands inline on the
  // form, rather than as a bare "conflict" the user cannot act on.
  if (existing) {
    throw new ValidationError("An account with that email already exists.", {
      email: ["That email is already registered — sign in instead"],
    });
  }

  const passwordHash = await hashPassword(input.password);
  const slug = await allocateSlug(slugify(input.centreName) || "centre");

  const result = await db.$transaction(async (tx) => {
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
        passwordHash,
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
      metadata: { centreName: input.centreName },
    });

    return { centreId: centre.id, userId: user.id };
  });

  await createSession({
    userId: result.userId,
    centreId: result.centreId,
    role: ROLE.OWNER,
    fullName: input.fullName,
    email: input.email,
  });

  logger.info("centre.registered", { centreId: result.centreId });
  return result;
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
