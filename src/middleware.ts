/**
 * MODULE: Route protection middleware
 *
 * Purpose        Keep signed-out visitors out of `/app` before a page renders.
 * Responsibility Edge-side session verification and redirects only.
 * Dependencies   @/lib/auth/token (deliberately dependency-free so it runs on
 *                the Edge runtime).
 *
 * IMPORTANT
 *  This is a user-experience guard, not the security boundary. It cannot query
 *  the database, so it cannot know whether a user may see a specific student.
 *  Real authorization happens in `@/lib/auth/rbac.ts` on every data access.
 *  Treating middleware as the boundary is how apps ship IDOR bugs.
 */

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/token";

const PROTECTED_PREFIX = "/app";
const LOGIN_PATH = "/login";

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  // Read the secret directly: the Edge runtime cannot load the Node config
  // module. `env.ts` still validates it at server boot.
  const secret = process.env.SESSION_SECRET ?? "";
  const session = secret ? await verifySessionToken(token, secret) : null;

  if (pathname.startsWith(PROTECTED_PREFIX) && !session) {
    const redirectUrl = new URL(LOGIN_PATH, request.url);
    // Preserve where they were going so login can return them there.
    redirectUrl.searchParams.set("next", `${pathname}${search}`);

    const response = NextResponse.redirect(redirectUrl);
    // Clear a stale or tampered cookie so the loop cannot repeat.
    if (token) response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }

  if (pathname === LOGIN_PATH && session) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/login"],
};
