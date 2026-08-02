/**
 * MODULE: Notification contracts
 *
 * Purpose        Define the boundary between "we decided to tell a parent
 *                something" and "a vendor delivered it".
 * Responsibility Types only — no behaviour, no I/O.
 * Dependencies   @/domain/enums.
 *
 * WHY AN ADAPTER INTERFACE
 *  The delivery channel is the single most expensive and most likely-to-change
 *  decision in this product: WhatsApp template pricing, SMS fallback and web
 *  push all have different economics per centre and per country. Everything
 *  upstream of `NotificationAdapter` is written once and never touched again
 *  when that decision changes.
 */

import type { NotificationChannel } from "@/domain/enums";

/** Everything a channel could need to render a message. */
export interface NotificationMessage {
  recipientName: string;
  recipientEmail: string;
  recipientPhone: string | null;
  studentName: string;
  /** Short heading, e.g. "Homework · Grade 7 Math". */
  title: string;
  /** The sentence a parent reads, already composed by `domain/timeline`. */
  body: string;
  /** Deep link into the parent app. */
  url: string;
}

export interface DeliveryResult {
  delivered: boolean;
  /** Vendor-side identifier, kept for support tickets. */
  reference?: string;
  error?: string;
  /**
   * Whether another attempt could plausibly succeed.
   * A 500 from the vendor is retryable; "this phone number is not on WhatsApp"
   * is not, and retrying it forever just fills the queue.
   */
  retryable: boolean;
}

export interface NotificationAdapter {
  readonly channel: NotificationChannel;
  send(message: NotificationMessage): Promise<DeliveryResult>;
}
