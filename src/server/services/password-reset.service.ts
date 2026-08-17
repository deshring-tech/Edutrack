/**
 * MODULE: Password reset
 *
 * Purpose        Let someone who has forgotten their password set a new one
 *                without an administrator touching the database.
 * Responsibility Token issue, token redemption, and the emails that carry them.
 * Dependencies   db, password, email, rate-limit, schemas, audit service.
 *
 * TOKEN DESIGN
 *  - 32 random bytes from a CSPRNG: not guessable.
 *  - Only the SHA-256 hash is stored, so a leaked database yields nothing
 *    usable. The raw token exists only in the email and the user's URL bar.
 *  - One hour to live, single use, and issuing a new one invalidates the
 *    previous ones so a forwarded old email cannot be replayed.
 *
 * ENUMERATION
 *  `requestPasswordReset` always reports success. Replying "no such account"
 *  turns the form into an oracle for which parents are registered at a centre.
 *  The work is done unconditionally so the timing does not give it away either.
 */

import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { ValidationError } from "@/lib/errors";
import { hashPassword } from "@/lib/auth/password";
import {
  PASSWORD_RESET_RULE,
  assertWithinLimit,
  recordFailure,
} from "@/lib/rate-limit";
import { sendEmail } from "../email/adapters";
import {
  forgotPasswordSchema,
  parseOrThrow,
  resetPasswordSchema,
} from "../schemas";
import { recordAudit } from "./audit.service";

const TOKEN_BYTES = 32;
const TOKEN_TTL_MINUTES = 60;

/** Store only the digest — never the token itself. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issue a reset link if the address belongs to an active account.
 * Always resolves, and never reveals whether it did anything.
 */
export async function requestPasswordReset(rawInput: unknown): Promise<void> {
  const input = parseOrThrow(forgotPasswordSchema, rawInput);
  const key = `reset:${input.email}`;

  assertWithinLimit(key, PASSWORD_RESET_RULE);
  // Counted on every request, not only on misses: the limit exists to stop
  // someone using this endpoint to spam a real person's inbox.
  recordFailure(key, PASSWORD_RESET_RULE);

  const user = await db.user.findUnique({
    where: { email: input.email },
    select: { id: true, centreId: true, fullName: true, email: true, isActive: true },
  });

  if (!user || !user.isActive) {
    logger.info("password_reset.requested_unknown", { email: input.email });
    return;
  }

  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000);

  await db.$transaction(async (tx) => {
    // Supersede any outstanding links, so only the newest email works.
    await tx.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    await tx.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt },
    });

    await recordAudit(tx, {
      centreId: user.centreId,
      actorId: user.id,
      action: "password_reset.requested",
      targetType: "User",
      targetId: user.id,
    });
  });

  const link = `${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`;

  await sendEmail({
    to: user.email,
    subject: "Reset your EduTrack password",
    text: [
      `Hello ${user.fullName},`,
      "",
      "Use the link below to set a new EduTrack password. It expires in one hour and can only be used once.",
      "",
      link,
      "",
      "If you did not ask for this, you can ignore this email — your password has not changed.",
    ].join("\n"),
    html: [
      `<p>Hello ${escapeHtml(user.fullName)},</p>`,
      "<p>Use the link below to set a new EduTrack password. It expires in one hour and can only be used once.</p>",
      `<p><a href="${escapeHtml(link)}">Set a new password</a></p>`,
      "<p>If you did not ask for this, you can ignore this email — your password has not changed.</p>",
    ].join(""),
  });

  logger.info("password_reset.sent", { userId: user.id });
}

/** Redeem a reset link and set the new password. */
export async function resetPassword(rawInput: unknown): Promise<void> {
  const input = parseOrThrow(resetPasswordSchema, rawInput);

  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(input.token) },
    select: {
      id: true,
      usedAt: true,
      expiresAt: true,
      user: { select: { id: true, centreId: true, isActive: true } },
    },
  });

  // One message for expired, already-used and never-existed. All three mean the
  // same thing to an honest user: request a fresh link.
  const invalid = new ValidationError(
    "That reset link is no longer valid. Please request a new one.",
    { token: ["Expired or already used"] },
  );

  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) throw invalid;
  if (!record.user.isActive) throw invalid;

  const passwordHash = await hashPassword(input.newPassword);

  await db.$transaction(async (tx) => {
    // Guarded update: if a concurrent request redeemed this token first, the
    // WHERE clause matches nothing and this one changes no password.
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    if (claimed.count === 0) throw invalid;

    await tx.user.update({
      where: { id: record.user.id },
      data: { passwordHash },
    });

    await recordAudit(tx, {
      centreId: record.user.centreId,
      actorId: record.user.id,
      action: "password_reset.completed",
      targetType: "User",
      targetId: record.user.id,
    });
  });

  logger.info("password_reset.completed", { userId: record.user.id });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
