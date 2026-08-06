/**
 * MODULE: Password hashing
 *
 * Purpose        Hash and verify user passwords.
 * Responsibility Own the hashing algorithm and its parameters, and keep
 *                verification constant-time.
 * Dependencies   node:crypto only.
 *
 * WHY scrypt FROM node:crypto
 *  It is a memory-hard KDF recommended by OWASP, it is built into Node, and it
 *  needs no native compilation — which matters because a native bcrypt/argon2
 *  binding is a recurring source of broken Windows installs and broken CI. The
 *  stored format records its own parameters, so cost can be raised later
 *  without invalidating existing hashes.
 *
 * STORED FORMAT
 *  scrypt$<N>$<r>$<p>$<base64 salt>$<base64 derived key>
 */

import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/domain/password-policy";

/**
 * `promisify` infers scrypt's 3-argument overload and drops the options
 * parameter, so the signature is declared explicitly. Without this the cost
 * parameters below would be silently ignored and every hash would use Node's
 * weak defaults.
 */
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

const ALGORITHM = "scrypt";
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/** ~32 MB and ~100 ms per hash — OWASP's floor for scrypt. */
const COST = { N: 32_768, r: 8, p: 1 } as const;

/** scrypt needs roughly 128 * N * r bytes; give it headroom or it throws. */
const MAX_MEMORY = 64 * 1024 * 1024;

// Deliberately imported, not re-exported: everything else (forms, schemas,
// tests) reads the policy straight from `@/domain/password-policy`, so there is
// only one import path for it and no way to pull node:crypto into the browser.

/**
 * Unicode-normalise so a password typed on a phone keyboard and the same
 * password typed on a laptop produce identical bytes.
 */
function normalise(password: string): string {
  return password.normalize("NFKC");
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    throw new Error(`Password must be at most ${PASSWORD_MAX_LENGTH} characters`);
  }

  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = await scryptAsync(normalise(password), salt, KEY_LENGTH, {
    ...COST,
    maxmem: MAX_MEMORY,
  });

  return [
    ALGORITHM,
    COST.N,
    COST.r,
    COST.p,
    salt.toString("base64"),
    derivedKey.toString("base64"),
  ].join("$");
}

/**
 * Verify a password against a stored hash.
 * Returns false rather than throwing on a malformed hash: a corrupt row must
 * deny access, not crash the login endpoint for everyone.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 6) return false;

  const [algorithm, rawN, rawR, rawP, rawSalt, rawKey] = parts as [
    string, string, string, string, string, string,
  ];
  if (algorithm !== ALGORITHM) return false;

  const N = Number(rawN);
  const r = Number(rawR);
  const p = Number(rawP);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

  try {
    const salt = Buffer.from(rawSalt, "base64");
    const expected = Buffer.from(rawKey, "base64");

    const actual = await scryptAsync(normalise(password), salt, expected.length, {
      N,
      r,
      p,
      maxmem: MAX_MEMORY,
    });

    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Fixed salt used only by `burnEquivalentWork`. Never used for a real hash. */
const TIMING_SALT = Buffer.alloc(SALT_LENGTH, 0);

/**
 * Spend the same CPU time a real verification would, and discard the result.
 *
 * Login calls this when the email does not exist, so a missing account costs
 * the same wall-clock time as a wrong password. Without it, response timing
 * tells an attacker which parent emails are registered at a centre.
 */
export async function burnEquivalentWork(password: string): Promise<void> {
  await scryptAsync(normalise(password), TIMING_SALT, KEY_LENGTH, {
    ...COST,
    maxmem: MAX_MEMORY,
  });
}
