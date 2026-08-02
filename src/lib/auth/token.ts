/**
 * MODULE: Session tokens
 *
 * Purpose        Sign and verify the JWT carried in the session cookie.
 * Responsibility Pure token mechanics. No cookies, no database, no env access.
 * Dependencies   jose.
 *
 * WHY THE SECRET IS A PARAMETER
 *  Next.js middleware runs on the Edge runtime, which cannot import the Node
 *  config module. Keeping this file dependency-free lets middleware and the
 *  Node server share exactly one verification implementation — so there is no
 *  chance of the two disagreeing about whether a token is valid.
 */

import { SignJWT, jwtVerify } from "jose";
import { ROLES, type Role } from "@/domain/enums";

export const SESSION_COOKIE_NAME = "edutrack_session";

const ISSUER = "edutrack";
const AUDIENCE = "edutrack.app";
const ALGORITHM = "HS256";

export interface SessionPayload {
  userId: string;
  centreId: string;
  role: Role;
  fullName: string;
  email: string;
}

function toKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(
  payload: SessionPayload,
  secret: string,
  ttlHours: number,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(payload.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + ttlHours * 3600)
    .sign(toKey(secret));
}

/**
 * Verify a token and return its payload, or null if it is missing, expired,
 * tampered with, or structurally wrong. Never throws — callers treat null as
 * "not signed in", which is the only safe interpretation.
 */
export async function verifySessionToken(
  token: string | undefined,
  secret: string,
): Promise<SessionPayload | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, toKey(secret), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: [ALGORITHM],
    });

    const { userId, centreId, role, fullName, email } = payload as Record<string, unknown>;

    if (
      typeof userId !== "string" ||
      typeof centreId !== "string" ||
      typeof fullName !== "string" ||
      typeof email !== "string" ||
      typeof role !== "string" ||
      !ROLES.includes(role as Role)
    ) {
      return null;
    }

    return { userId, centreId, role: role as Role, fullName, email };
  } catch {
    return null;
  }
}
