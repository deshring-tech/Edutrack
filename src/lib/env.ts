/**
 * MODULE: Environment configuration
 *
 * Purpose        Validate and expose every environment variable exactly once.
 * Responsibility Fail at startup on bad configuration, and give the rest of the
 *                codebase a fully-typed config object instead of
 *                `process.env.SOMETHING!` scattered through it.
 * Dependencies   zod.
 * Outputs        `env` — a frozen, validated configuration object.
 *
 * SERVER ONLY. Never import from a Client Component; it would leak secrets into
 * the browser bundle.
 *
 * WHY FAIL FAST
 *  A missing WHATSAPP_ACCESS_TOKEN discovered when the app boots costs a deploy.
 *  Discovered when the outbox first flushes, it costs a day of parents silently
 *  not being told their child was absent.
 */

import { z } from "zod";
import { NOTIFICATION_CHANNEL } from "@/domain/enums";

/**
 * Standalone scripts (seed, dispatcher) do not go through Next's loader, so
 * they need `.env` read explicitly. Node >=20.12 provides `loadEnvFile`.
 */
if (!process.env.DATABASE_URL && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file present — fall through to schema validation, which will
    // produce a far clearer error than a filesystem exception would.
  }
}

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

    SESSION_SECRET: z
      .string()
      .min(32, "SESSION_SECRET must be at least 32 characters"),
    SESSION_TTL_HOURS: z.coerce.number().int().positive().default(720),

    APP_URL: z.string().url().default("http://localhost:3000"),

    NOTIFICATION_CHANNEL: z
      .enum([
        NOTIFICATION_CHANNEL.CONSOLE,
        NOTIFICATION_CHANNEL.WEBHOOK,
        NOTIFICATION_CHANNEL.WHATSAPP,
        NOTIFICATION_CHANNEL.EMAIL,
      ])
      .default(NOTIFICATION_CHANNEL.CONSOLE),
    NOTIFICATION_WEBHOOK_URL: z.string().url().optional(),

    WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
    WHATSAPP_ACCESS_TOKEN: z.string().optional(),
    WHATSAPP_TEMPLATE_NAME: z.string().default("edutrack_progress_update"),

    CRON_SECRET: z.string().min(16, "CRON_SECRET must be at least 16 characters"),
  })
  // Channel-specific requirements are checked here rather than at send time,
  // so a misconfigured channel can never reach production silently.
  .superRefine((value, ctx) => {
    if (
      value.NOTIFICATION_CHANNEL === NOTIFICATION_CHANNEL.WEBHOOK &&
      !value.NOTIFICATION_WEBHOOK_URL
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["NOTIFICATION_WEBHOOK_URL"],
        message: "Required when NOTIFICATION_CHANNEL=WEBHOOK",
      });
    }

    if (value.NOTIFICATION_CHANNEL === NOTIFICATION_CHANNEL.WHATSAPP) {
      if (!value.WHATSAPP_PHONE_NUMBER_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["WHATSAPP_PHONE_NUMBER_ID"],
          message: "Required when NOTIFICATION_CHANNEL=WHATSAPP",
        });
      }
      if (!value.WHATSAPP_ACCESS_TOKEN) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["WHATSAPP_ACCESS_TOKEN"],
          message: "Required when NOTIFICATION_CHANNEL=WHATSAPP",
        });
      }
    }
  });

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  • ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration:\n${details}\n\nCopy .env.example to .env and fill in the missing values.`,
    );
  }

  return Object.freeze(parsed.data);
}

export const env = loadEnv();

export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
