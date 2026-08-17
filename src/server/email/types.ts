/**
 * MODULE: Email contracts
 *
 * Purpose        Separate "we decided to email someone" from "a vendor
 *                delivered it".
 * Responsibility Types only.
 *
 * The same shape as `server/notifications/types.ts`, and for the same reason:
 * the delivery vendor is the part most likely to change, and everything
 * upstream of the adapter should never have to care.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain text. Always sent — some clients never render the HTML part. */
  text: string;
  html: string;
}

export interface EmailResult {
  delivered: boolean;
  reference?: string;
  error?: string;
}

export interface EmailAdapter {
  readonly channel: string;
  send(message: EmailMessage): Promise<EmailResult>;
}
