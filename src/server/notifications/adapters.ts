/**
 * MODULE: Notification channel adapters
 *
 * Purpose        Deliver a composed message through a concrete channel.
 * Responsibility One class per vendor. Each converts a NotificationMessage into
 *                that vendor's call and classifies the outcome as retryable or
 *                permanent.
 * Dependencies   @/lib/env, @/lib/logger, ./types.
 *
 * Future extension points
 *  - SMS (fallback when WhatsApp is undelivered for 24h).
 *  - Web push for the installed PWA (cheapest channel; no per-message cost).
 */

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { NOTIFICATION_CHANNEL, type NotificationChannel } from "@/domain/enums";
import type { DeliveryResult, NotificationAdapter, NotificationMessage } from "./types";

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Development default. Logs instead of sending, so a developer running the
 * seed script cannot message a real parent. This is the reason the default is
 * CONSOLE and not WHATSAPP.
 */
class ConsoleAdapter implements NotificationAdapter {
  readonly channel = NOTIFICATION_CHANNEL.CONSOLE;

  async send(message: NotificationMessage): Promise<DeliveryResult> {
    logger.info("notification.console", {
      to: message.recipientName,
      student: message.studentName,
      title: message.title,
      body: message.body,
    });
    return { delivered: true, reference: "console", retryable: false };
  }
}

/** Posts the message to a URL. Useful for staging, Slack relays and testing. */
class WebhookAdapter implements NotificationAdapter {
  readonly channel = NOTIFICATION_CHANNEL.WEBHOOK;

  constructor(private readonly endpoint: string) {}

  async send(message: NotificationMessage): Promise<DeliveryResult> {
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (response.ok) {
        return { delivered: true, reference: String(response.status), retryable: false };
      }

      return {
        delivered: false,
        error: `Webhook responded ${response.status}`,
        // 4xx means our request is wrong; repeating it will not fix that.
        retryable: response.status >= 500,
      };
    } catch (error) {
      return {
        delivered: false,
        error: error instanceof Error ? error.message : "Webhook request failed",
        retryable: true,
      };
    }
  }
}

/**
 * Meta WhatsApp Cloud API.
 *
 * Business-initiated messages must use a pre-approved template, so the message
 * body is passed as template parameters rather than free text. The template
 * named by WHATSAPP_TEMPLATE_NAME is expected to take three parameters:
 *   {{1}} parent name · {{2}} student name · {{3}} the update itself
 */
class WhatsAppCloudAdapter implements NotificationAdapter {
  readonly channel = NOTIFICATION_CHANNEL.WHATSAPP;

  constructor(
    private readonly phoneNumberId: string,
    private readonly accessToken: string,
    private readonly templateName: string,
  ) {}

  async send(message: NotificationMessage): Promise<DeliveryResult> {
    if (!message.recipientPhone) {
      return {
        delivered: false,
        error: "Recipient has no phone number on file",
        retryable: false,
      };
    }

    const endpoint = `https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: message.recipientPhone,
          type: "template",
          template: {
            name: this.templateName,
            language: { code: "en" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: message.recipientName },
                  { type: "text", text: message.studentName },
                  { type: "text", text: message.body },
                ],
              },
            ],
          },
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      const payload = (await response.json().catch(() => null)) as {
        messages?: { id?: string }[];
        error?: { message?: string };
      } | null;

      if (response.ok) {
        return {
          delivered: true,
          reference: payload?.messages?.[0]?.id,
          retryable: false,
        };
      }

      return {
        delivered: false,
        error: payload?.error?.message ?? `WhatsApp responded ${response.status}`,
        // 429 (rate limited) and 5xx are worth retrying; other 4xx are not.
        retryable: response.status === 429 || response.status >= 500,
      };
    } catch (error) {
      return {
        delivered: false,
        error: error instanceof Error ? error.message : "WhatsApp request failed",
        retryable: true,
      };
    }
  }
}

/**
 * Placeholder for transactional email. Declared so EMAIL is a valid configured
 * channel that fails loudly and permanently, rather than silently doing
 * nothing — a queue of messages nobody sent is worse than an obvious error.
 */
class UnconfiguredEmailAdapter implements NotificationAdapter {
  readonly channel = NOTIFICATION_CHANNEL.EMAIL;

  async send(): Promise<DeliveryResult> {
    return {
      delivered: false,
      error: "EMAIL channel is not implemented yet — configure another channel",
      retryable: false,
    };
  }
}

let cachedAdapter: NotificationAdapter | null = null;

/** The adapter selected by NOTIFICATION_CHANNEL. Built once per process. */
export function getNotificationAdapter(): NotificationAdapter {
  if (cachedAdapter) return cachedAdapter;

  cachedAdapter = buildAdapter(env.NOTIFICATION_CHANNEL);
  logger.info("notifications.adapter.selected", { channel: cachedAdapter.channel });
  return cachedAdapter;
}

function buildAdapter(channel: NotificationChannel): NotificationAdapter {
  switch (channel) {
    case NOTIFICATION_CHANNEL.WEBHOOK:
      // env.ts guarantees the URL exists when this channel is selected.
      return new WebhookAdapter(env.NOTIFICATION_WEBHOOK_URL!);

    case NOTIFICATION_CHANNEL.WHATSAPP:
      return new WhatsAppCloudAdapter(
        env.WHATSAPP_PHONE_NUMBER_ID!,
        env.WHATSAPP_ACCESS_TOKEN!,
        env.WHATSAPP_TEMPLATE_NAME,
      );

    case NOTIFICATION_CHANNEL.EMAIL:
      return new UnconfiguredEmailAdapter();

    case NOTIFICATION_CHANNEL.CONSOLE:
    default:
      return new ConsoleAdapter();
  }
}
