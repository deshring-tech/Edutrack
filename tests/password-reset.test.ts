/**
 * Tests: password reset and password-less accounts
 *
 * The reset flow is a credential-issuing endpoint, so its failure modes are the
 * expensive kind: a token that works twice, one that never expires, or a form
 * that reveals which addresses are registered.
 *
 * ISOLATION
 *  Creates a throwaway centre with a unique id and deletes it afterwards.
 *  Emails carry a per-run suffix so repeat runs cannot collide on the global
 *  unique index. The console email adapter is the default, so nothing is sent.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { resetAllLimits } from "@/lib/rate-limit";
import { ROLE } from "@/domain/enums";
import { login } from "@/server/services/auth.service";
import {
  requestPasswordReset,
  resetPassword,
} from "@/server/services/password-reset.service";
import { deleteCentreDeep } from "./helpers/cleanup";

const RUN_ID = Math.random().toString(36).slice(2, 8);
const CENTRE_ID = `centre_reset_${RUN_ID}`;
const USER_ID = `user_reset_${RUN_ID}`;
const GOOGLE_USER_ID = `user_google_${RUN_ID}`;

const USER_EMAIL = `reset-${RUN_ID}@test.local`;
const GOOGLE_EMAIL = `google-${RUN_ID}@test.local`;
const ORIGINAL_PASSWORD = "original-password-1";

/** Mirrors the service's storage format so tests can find the row. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * The raw token only exists in the email, so tests read the row the service
 * wrote and work backwards — the same thing an attacker with database access
 * would have to do, which is precisely what must not be enough.
 */
async function latestTokenRow(userId: string) {
  return db.passwordResetToken.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Insert a reset token whose raw value the test knows.
 *
 * The service deliberately never returns the token — it only reaches the user
 * by email — so redemption cannot be tested through `requestPasswordReset`.
 * Writing an equivalent row directly exercises the same redemption path while
 * letting the test control expiry.
 */
async function issueTokenFor(userId: string, options: { expiresAt?: Date } = {}) {
  const token = `test-token-${Math.random().toString(36).slice(2)}-${Date.now()}`;

  await db.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: options.expiresAt ?? new Date(Date.now() + 60 * 60_000),
    },
  });

  return token;
}

beforeAll(async () => {
  const passwordHash = await hashPassword(ORIGINAL_PASSWORD);

  await db.centre.create({
    data: {
      id: CENTRE_ID,
      name: `Reset Centre ${RUN_ID}`,
      slug: `reset-centre-${RUN_ID}`,
      users: {
        create: [
          {
            id: USER_ID,
            email: USER_EMAIL,
            passwordHash,
            fullName: "Reset Tester",
            role: ROLE.OWNER,
          },
          {
            id: GOOGLE_USER_ID,
            email: GOOGLE_EMAIL,
            // A Google-only account: no password was ever set.
            passwordHash: null,
            googleSub: `google-sub-${RUN_ID}`,
            fullName: "Google Tester",
            role: ROLE.TEACHER,
          },
        ],
      },
    },
  });
});

afterAll(async () => {
  await deleteCentreDeep(CENTRE_ID);
});

beforeEach(() => {
  // Requests are rate limited per address; without this the later cases in a
  // file would fail purely because the earlier ones used up the window.
  resetAllLimits();
});

describe("requestPasswordReset", () => {
  it("issues a hashed token for a real account", async () => {
    await requestPasswordReset({ email: USER_EMAIL });

    const row = await latestTokenRow(USER_ID);
    expect(row).not.toBeNull();
    expect(row?.usedAt).toBeNull();
    expect(row?.expiresAt.getTime()).toBeGreaterThan(Date.now());

    // 64 hex characters — a SHA-256 digest, not the token itself.
    expect(row?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("does not reveal that an address is unknown", async () => {
    // Same outcome as a real address: resolves, throws nothing.
    await expect(
      requestPasswordReset({ email: `nobody-${RUN_ID}@test.local` }),
    ).resolves.toBeUndefined();
  });

  it("supersedes any earlier outstanding link", async () => {
    await requestPasswordReset({ email: USER_EMAIL });
    const first = await latestTokenRow(USER_ID);

    await requestPasswordReset({ email: USER_EMAIL });
    const second = await latestTokenRow(USER_ID);

    expect(second?.id).not.toBe(first?.id);

    // The older link must stop working the moment a newer one is sent.
    const supersededFirst = await db.passwordResetToken.findUnique({
      where: { id: first?.id ?? "" },
      select: { usedAt: true },
    });
    expect(supersededFirst?.usedAt).not.toBeNull();
  });

  it("rejects a malformed email before doing any work", async () => {
    await expect(requestPasswordReset({ email: "not-an-email" })).rejects.toThrow(
      ValidationError,
    );
  });
});

describe("resetPassword", () => {
  it("sets a new password and lets the user sign in with it", async () => {
    const token = await issueTokenFor(USER_ID);
    const newPassword = "a-freshly-chosen-password";

    await resetPassword({
      token,
      newPassword,
      confirmPassword: newPassword,
    });

    const user = await db.user.findUniqueOrThrow({
      where: { id: USER_ID },
      select: { passwordHash: true },
    });

    await expect(verifyPassword(newPassword, user.passwordHash ?? "")).resolves.toBe(true);
    await expect(
      verifyPassword(ORIGINAL_PASSWORD, user.passwordHash ?? ""),
    ).resolves.toBe(false);
  });

  it("refuses to use the same token twice", async () => {
    const token = await issueTokenFor(USER_ID);

    await resetPassword({
      token,
      newPassword: "first-use-password",
      confirmPassword: "first-use-password",
    });

    await expect(
      resetPassword({
        token,
        newPassword: "second-use-password",
        confirmPassword: "second-use-password",
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("refuses an expired token", async () => {
    const token = await issueTokenFor(USER_ID, {
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(
      resetPassword({
        token,
        newPassword: "too-late-password",
        confirmPassword: "too-late-password",
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("refuses a token that was never issued", async () => {
    await expect(
      resetPassword({
        token: "completely-made-up-token-value",
        newPassword: "made-up-password",
        confirmPassword: "made-up-password",
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("refuses when the confirmation does not match", async () => {
    const token = await issueTokenFor(USER_ID);

    await expect(
      resetPassword({
        token,
        newPassword: "mismatched-password",
        confirmPassword: "different-password",
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("lets a Google-only account set its first password", async () => {
    const token = await issueTokenFor(GOOGLE_USER_ID);
    const password = "now-i-have-a-password";

    await resetPassword({ token, newPassword: password, confirmPassword: password });

    const user = await db.user.findUniqueOrThrow({
      where: { id: GOOGLE_USER_ID },
      select: { passwordHash: true, googleSub: true },
    });

    await expect(verifyPassword(password, user.passwordHash ?? "")).resolves.toBe(true);
    // Setting a password must not unlink Google — both routes now work.
    expect(user.googleSub).not.toBeNull();
  });
});

describe("password login against a password-less account", () => {
  it("is rejected with the same message as any other failure", async () => {
    // Created fresh so this case is independent of the Google test above.
    const email = `nopass-${RUN_ID}@test.local`;
    await db.user.create({
      data: {
        centreId: CENTRE_ID,
        email,
        passwordHash: null,
        fullName: "No Password",
        role: ROLE.TEACHER,
      },
    });

    await expect(login({ email, password: "anything-at-all" })).rejects.toThrow(
      ValidationError,
    );
  });
});
