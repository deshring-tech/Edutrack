/**
 * MODULE: Password policy
 *
 * Purpose        State the length rules for a password, once.
 * Responsibility Constants only.
 * Dependencies   None — and that is the point.
 *
 * WHY THIS IS NOT IN lib/auth/password.ts
 *  Login and signup forms need to show "at least 10 characters" and set a
 *  `minLength` attribute. Importing that constant from the hashing module drags
 *  `node:crypto` into the browser bundle, which fails the build outright.
 *
 *  The policy is a business rule; the hashing is infrastructure. Splitting them
 *  lets both sides of the network boundary agree on the rule without the client
 *  seeing anything it should not.
 */

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 200;
