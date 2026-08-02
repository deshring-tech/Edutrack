/**
 * MODULE: Session management
 *
 * Purpose        Create, read and destroy the signed-in user's session.
 * Responsibility Cookie lifecycle plus the "who is asking?" question that every
 *                server action and page begins with.
 * Dependencies   next/headers, ./token, @/lib/env, @/lib/errors.
 *
 * SERVER ONLY.
 *
 * WHY A STATELESS JWT COOKIE
 *  At this scale a database-backed session table buys revocation we do not yet
 *  need and costs a query on every request. The trade-off is explicit: sessions
 *  cannot be revoked before expiry. When centre admins need "sign out all
 *  devices", add a `sessionVersion` column to User and assert it here — the
 *  call sites do not change.
 */

import { cookies } from "next/headers";
import { env, isProduction } from "@/lib/env";
import { UnauthenticatedError } from "@/lib/errors";
import { STAFF_ROLES, type Role } from "@/domain/enums";
import {
  SESSION_COOKIE_NAME,
  signSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "./token";

export type { SessionPayload } from "./token";
export { SESSION_COOKIE_NAME } from "./token";

/** The authenticated caller. Passed explicitly into every service call. */
export interface SessionUser extends SessionPayload {
  isStaff: boolean;
}

function toSessionUser(payload: SessionPayload): SessionUser {
  return { ...payload, isStaff: STAFF_ROLES.includes(payload.role) };
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await signSessionToken(
    payload,
    env.SESSION_SECRET,
    env.SESSION_TTL_HOURS,
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: env.SESSION_TTL_HOURS * 3600,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/** The current user, or null when signed out. Never throws. */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const payload = await verifySessionToken(token, env.SESSION_SECRET);
  return payload ? toSessionUser(payload) : null;
}

/** The current user, or throw. The default for anything behind a login. */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new UnauthenticatedError();
  return session;
}

/** Where each role lands after signing in. */
export const HOME_PATH_BY_ROLE: Record<Role, string> = {
  OWNER: "/app/dashboard",
  TEACHER: "/app/batches",
  PARENT: "/app/children",
};

export function homePathFor(role: Role): string {
  return HOME_PATH_BY_ROLE[role];
}
