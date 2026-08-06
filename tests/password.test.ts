/**
 * Tests: password hashing
 *
 * Security primitives get tests because their failure mode is silent. A broken
 * `verifyPassword` that returns true for everything looks exactly like a
 * working one until someone signs in as a stranger.
 */

import { describe, expect, it } from "vitest";
import { burnEquivalentWork, hashPassword, verifyPassword } from "@/lib/auth/password";
import { PASSWORD_MIN_LENGTH } from "@/domain/password-policy";

const PASSWORD = "correct-horse-battery";

describe("hashPassword", () => {
  it("produces a self-describing hash", async () => {
    const hash = await hashPassword(PASSWORD);
    const [algorithm, N, r, p, salt, key] = hash.split("$");

    expect(algorithm).toBe("scrypt");
    expect(Number(N)).toBeGreaterThanOrEqual(32_768);
    expect(Number(r)).toBe(8);
    expect(Number(p)).toBe(1);
    expect(salt).toBeTruthy();
    expect(key).toBeTruthy();
  });

  it("salts, so the same password never hashes to the same string", async () => {
    const [first, second] = await Promise.all([
      hashPassword(PASSWORD),
      hashPassword(PASSWORD),
    ]);
    expect(first).not.toBe(second);
  });

  it("rejects a password below the minimum length", async () => {
    await expect(hashPassword("a".repeat(PASSWORD_MIN_LENGTH - 1))).rejects.toThrow();
  });
});

describe("verifyPassword", () => {
  it("accepts the correct password", async () => {
    const hash = await hashPassword(PASSWORD);
    await expect(verifyPassword(PASSWORD, hash)).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword(PASSWORD);
    await expect(verifyPassword("wrong-password-here", hash)).resolves.toBe(false);
  });

  it("treats unicode-equivalent passwords as identical", async () => {
    // The same characters typed on a phone and a laptop can differ in encoding.
    const composed = "café-password-1";
    const decomposed = "café-password-1";

    const hash = await hashPassword(composed);
    await expect(verifyPassword(decomposed, hash)).resolves.toBe(true);
  });

  it("returns false for a malformed hash instead of throwing", async () => {
    // A corrupt row must deny that one login, not crash the endpoint for everyone.
    await expect(verifyPassword(PASSWORD, "not-a-hash")).resolves.toBe(false);
    await expect(verifyPassword(PASSWORD, "scrypt$x$y$z$a$b")).resolves.toBe(false);
    await expect(verifyPassword(PASSWORD, "")).resolves.toBe(false);
  });

  it("rejects a hash claiming a different algorithm", async () => {
    const hash = await hashPassword(PASSWORD);
    const forged = hash.replace("scrypt", "plaintext");
    await expect(verifyPassword(PASSWORD, forged)).resolves.toBe(false);
  });
});

describe("burnEquivalentWork", () => {
  it("completes without throwing, so login timing stays uniform", async () => {
    await expect(burnEquivalentWork("anything")).resolves.toBeUndefined();
  });
});
