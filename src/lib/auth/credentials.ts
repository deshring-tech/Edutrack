/**
 * MODULE: Credential helpers
 *
 * Purpose        Generate the values needed when one person creates an account
 *                for another.
 * Responsibility Temporary passwords and stable avatar colours.
 * Dependencies   node:crypto.
 *
 * WHY THE CENTRE DOES NOT CHOOSE THE PASSWORD
 *  An owner adding twelve teachers will type the same weak password twelve
 *  times. Generating it removes that choice, and showing it exactly once
 *  forces it to be handed over deliberately rather than left in a spreadsheet.
 *  When transactional email is added this is replaced by an invite link and the
 *  password never exists at all.
 */

import { randomInt } from "node:crypto";

/**
 * Deliberately excludes characters that are misread when a password is spoken
 * or written down: 0/O, 1/l/I. A credential that has to be repeated three times
 * over the phone gets replaced by "password123".
 */
const UNAMBIGUOUS_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const TEMPORARY_PASSWORD_LENGTH = 14;

export function generateTemporaryPassword(): string {
  let password = "";
  for (let index = 0; index < TEMPORARY_PASSWORD_LENGTH; index += 1) {
    password += UNAMBIGUOUS_ALPHABET[randomInt(UNAMBIGUOUS_ALPHABET.length)];
  }
  return password;
}

/**
 * The avatar palette. Chosen for contrast against white initials rather than
 * for variety, so every avatar stays legible.
 */
const AVATAR_PALETTE = [
  "#7E57C2", "#26A69A", "#EF6C00", "#D81B60", "#5C6BC0",
  "#43A047", "#8E24AA", "#1E88E5", "#00897B", "#EC407A",
  "#3949AB", "#F4511E",
] as const;

/**
 * Pick a colour deterministically from a name, so the same person keeps the
 * same colour across environments and after a re-seed.
 */
export function avatarColorFor(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length] ?? "#7E57C2";
}

/** URL-safe centre identifier derived from its name. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
