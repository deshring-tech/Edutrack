/**
 * MODULE: Google identity verification
 *
 * Purpose        Turn a Google ID token from the browser into a trustworthy
 *                identity.
 * Responsibility Cryptographic verification and claim validation only. It makes
 *                no decision about who may sign in.
 * Dependencies   jose, @/lib/env, @/lib/errors.
 *
 * WHY THE TOKEN IS VERIFIED SERVER-SIDE
 *  The browser hands us a JWT and says "this is who I am". Decoding it without
 *  checking the signature would let anyone sign in as anyone by editing a
 *  base64 string. We check the signature against Google's published keys, and
 *  that the token was issued *for this application* — a valid Google token
 *  minted for someone else's app must not be accepted here, which is what the
 *  audience check prevents.
 *
 * NO CLIENT SECRET IS NEEDED
 *  This is the Google Identity Services flow: the browser obtains an ID token
 *  and we verify it with public keys. There is no authorization-code exchange,
 *  so there is no secret to store or leak. The Client ID is public by design.
 */

import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "@/lib/env";
import { UnauthenticatedError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** Google's public signing keys. `jose` caches and refreshes these for us. */
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

/** Google issues tokens under both spellings; both are legitimate. */
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export interface GoogleIdentity {
  /** Google's stable, immutable user id. The right thing to key an account on. */
  subject: string;
  email: string;
  fullName: string;
}

/** Whether Google Sign-In is configured for this deployment. */
export function isGoogleSignInEnabled(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID);
}

/** The Client ID, for passing to the browser widget. Public by design. */
export function googleClientId(): string | null {
  return env.GOOGLE_CLIENT_ID ?? null;
}

export async function verifyGoogleIdToken(token: unknown): Promise<GoogleIdentity> {
  const clientId = env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    throw new ValidationError("Google sign-in is not enabled for this deployment.");
  }

  if (typeof token !== "string" || token.length === 0) {
    throw new ValidationError("Google sign-in did not return a valid token.");
  }

  let claims: Record<string, unknown>;

  try {
    const { payload } = await jwtVerify(token, GOOGLE_JWKS, {
      issuer: GOOGLE_ISSUERS,
      // Ties the token to THIS application. Without it, a token issued for any
      // other Google app would be accepted.
      audience: clientId,
    });
    claims = payload as Record<string, unknown>;
  } catch (error) {
    // Covers a bad signature, a wrong audience and an expired token alike.
    logger.warn("google.token.rejected", {
      message: error instanceof Error ? error.message : String(error),
    });
    throw new UnauthenticatedError("That Google sign-in could not be verified.");
  }

  const subject = claims.sub;
  const email = claims.email;

  if (typeof subject !== "string" || typeof email !== "string") {
    throw new UnauthenticatedError("Google did not return an email address.");
  }

  // Google sends this as a boolean or the string "true" depending on the flow.
  const emailVerified = claims.email_verified === true || claims.email_verified === "true";

  if (!emailVerified) {
    // An unverified address proves nothing about who is signing in, and we
    // match accounts on email.
    throw new UnauthenticatedError(
      "That Google account's email address is not verified.",
    );
  }

  const name = typeof claims.name === "string" ? claims.name.trim() : "";

  return {
    subject,
    email: email.toLowerCase(),
    // Fall back to the local part so an account always has a usable name.
    fullName: name || email.split("@")[0] || "New user",
  };
}
