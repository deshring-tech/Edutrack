/**
 * MODULE: Audit trail
 *
 * Purpose        Record who changed what, for every write that touches a
 *                child's record.
 * Responsibility A single append-only write helper.
 * Dependencies   @/lib/db.
 *
 * WHY THIS IS NOT OPTIONAL
 *  When a parent disputes a mark — and they will — a centre needs to answer
 *  "who recorded this, and when?". Under India's DPDP Act 2023 a centre also
 *  has to be able to demonstrate how a child's data was handled. Audit writes
 *  ride inside the same transaction as the change itself, so the log can never
 *  disagree with the data.
 */

import type { DbClient } from "@/lib/db";

export interface AuditInput {
  centreId: string;
  actorId: string | null;
  /** Dotted verb, e.g. "attendance.saved". */
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}

export async function recordAudit(
  client: DbClient,
  input: AuditInput,
): Promise<void> {
  await client.auditLog.create({
    data: {
      centreId: input.centreId,
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}
