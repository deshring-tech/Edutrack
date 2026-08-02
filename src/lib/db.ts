/**
 * MODULE: Database client
 *
 * Purpose        Provide the one Prisma client the application uses.
 * Responsibility Manage the client's lifetime correctly across Next.js hot
 *                reloads, and expose the transaction type services depend on.
 * Dependencies   @prisma/client, ./env, ./logger.
 *
 * WHY THE GLOBAL
 *  Next.js re-evaluates modules on every hot reload in development. Creating a
 *  new PrismaClient each time exhausts the database connection pool within a
 *  few minutes of editing. Caching on `globalThis` is the documented fix.
 */

import { PrismaClient, type Prisma } from "@prisma/client";
import { env, isProduction } from "./env";
import { logger } from "./logger";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: isProduction
      ? [{ emit: "event", level: "error" }]
      : [
          { emit: "event", level: "error" },
          { emit: "event", level: "warn" },
        ],
    datasources: { db: { url: env.DATABASE_URL } },
  });

  client.$on("error", (event) => {
    logger.error("prisma.error", { message: event.message, target: event.target });
  });

  return client;
}

export const db: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (!isProduction) globalForPrisma.prisma = db;

/**
 * The client type inside `db.$transaction(...)`.
 * Services accept this so a caller can compose several service calls into a
 * single atomic unit — which is exactly what batch fan-out requires.
 */
export type TransactionClient = Prisma.TransactionClient;

/** Either the pooled client or an open transaction. */
export type DbClient = PrismaClient | TransactionClient;
