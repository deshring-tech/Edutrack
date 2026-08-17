/**
 * MODULE: Email adapters
 *
 * Purpose        Deliver an email through a concrete provider.
 * Responsibility One implementation per vendor, plus adapter selection.
 * Dependencies   @/lib/env, @/lib/logger, ./types.
 *
 * CONSOLE IS THE DEFAULT ON PURPOSE
 *  A developer running the app locally must not be able to email a real parent.
 *  The console adapter prints the message — including the reset link — so the
 *  whole flow can be exercised end to end with no provider account at all.
 *
 * Future extension points
 *  - SES or Postmark: another class here, one more case in `buildAdapter`.
 */

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { EmailAdapter, EmailMessage, EmailResult } from "./types";

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Logs instead of sending. The link is printed in full so a developer can
 * follow it, which is exactly what makes this usable without a vendor.
 */
class ConsoleEmailAdapter implements EmailAdapter {
  readonly channel = "CONSOLE";

  async send(message: EmailMessage): Promise<EmailResult> {
    logger.info("email.console", {
      to: message.to,
      subject: message.subject,
      body: message.text,
    });
    return { delivered: true, reference: "console" };
  }
}

/**
 * Resend's HTTP API, called with `fetch` rather than their SDK.
 * One less dependency to keep patched for a single POST.
 */
class ResendAdapter implements EmailAdapter {
  readonly channel = "RESEND";

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<EmailResult> {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      const payload = (await response.json().catch(() => null)) as {
        id?: string;
        message?: string;
      } | null;

      if (response.ok) return { delivered: true, reference: payload?.id };

      return {
        delivered: false,
        error: payload?.message ?? `Resend responded ${response.status}`,
      };
    } catch (error) {
      return {
        delivered: false,
        error: error instanceof Error ? error.message : "Email request failed",
      };
    }
  }
}

let cachedAdapter: EmailAdapter | null = null;

export function getEmailAdapter(): EmailAdapter {
  if (cachedAdapter) return cachedAdapter;

  cachedAdapter =
    env.EMAIL_CHANNEL === "RESEND"
      ? // env.ts guarantees these exist when RESEND is selected.
        new ResendAdapter(env.RESEND_API_KEY!, env.EMAIL_FROM!)
      : new ConsoleEmailAdapter();

  logger.info("email.adapter.selected", { channel: cachedAdapter.channel });
  return cachedAdapter;
}

/**
 * Send an email, logging failures rather than throwing.
 *
 * Callers are flows like "forgot password", which must behave identically
 * whether or not the address exists — so they cannot surface a delivery error
 * without leaking that the account is real.
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const result = await getEmailAdapter().send(message);

  if (!result.delivered) {
    logger.error("email.failed", { to: message.to, error: result.error });
  }

  return result.delivered;
}
