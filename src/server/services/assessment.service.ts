/**
 * MODULE: Assessment logging
 *
 * Purpose        Record test and quiz results and publish them to parents.
 * Responsibility Validate, authorise, persist and publish — atomically.
 * Dependencies   db, rbac, schemas, roster/timeline/audit services, domain.
 *
 * DESIGN NOTE
 *  The assessment is identified by (batch, title, date), so saving the same
 *  test twice corrects it rather than creating a second one that quietly drags
 *  the class average down.
 *
 *  Scores above the maximum are rejected outright. The prototype allowed
 *  30/25 and rendered it as 120%, and allowed a blank maximum which produced
 *  "avg 1800%" — both of those reach a parent as a number about their child.
 */

import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth/session";
import { requireBatchAccess } from "@/lib/auth/rbac";
import { parseDateInputValue } from "@/domain/dates";
import { TIMELINE_SOURCE } from "@/domain/enums";
import { composeAssessment } from "@/domain/timeline";
import { assessmentAverage } from "@/domain/metrics";
import { parseOrThrow, saveAssessmentSchema } from "../schemas";
import { getActiveRoster, retainEnrolled } from "./roster.service";
import { publishEntries, type PublishableEntry } from "./timeline.service";
import { recordAudit } from "./audit.service";

const TRANSACTION_TIMEOUT_MS = 30_000;

export interface SaveAssessmentResult {
  assessmentId: string;
  scoresRecorded: number;
  classAveragePercent: number | null;
  notificationsQueued: number;
}

export async function saveAssessment(
  session: SessionUser,
  rawInput: unknown,
): Promise<SaveAssessmentResult> {
  const input = parseOrThrow(saveAssessmentSchema, rawInput);
  const batch = await requireBatchAccess(session, input.batchId);

  const assessedOn = parseDateInputValue(input.assessedOn);
  if (!assessedOn) {
    throw new ValidationError("That date is not valid.", {
      assessedOn: ["Enter a valid date"],
    });
  }

  // Checked here rather than in the schema because it is a rule about the
  // relationship between two fields, not about either field alone.
  const overMax = input.scores.filter((entry) => entry.score > input.maxScore);
  if (overMax.length > 0) {
    throw new ValidationError(
      `A score cannot be higher than the total of ${input.maxScore}.`,
      { scores: [`${overMax.length} score(s) exceed the total marks`] },
    );
  }

  return db.$transaction(
    async (tx) => {
      const roster = await getActiveRoster(tx, batch.id);
      const scores = retainEnrolled(input.scores, roster);

      if (scores.length === 0) {
        throw new ValidationError("None of those students are in this batch.");
      }

      const assessment = await tx.assessment.upsert({
        where: {
          batchId_title_assessedOn: {
            batchId: batch.id,
            title: input.title,
            assessedOn,
          },
        },
        create: {
          batchId: batch.id,
          title: input.title,
          maxScore: input.maxScore,
          assessedOn,
          createdById: session.userId,
        },
        update: { maxScore: input.maxScore },
        select: { id: true },
      });

      const entries: PublishableEntry[] = [];

      for (const entry of scores) {
        const record = await tx.assessmentScore.upsert({
          where: {
            assessmentId_studentId: {
              assessmentId: assessment.id,
              studentId: entry.studentId,
            },
          },
          create: {
            assessmentId: assessment.id,
            studentId: entry.studentId,
            score: entry.score,
          },
          update: { score: entry.score },
          select: { id: true },
        });

        const composed = composeAssessment({
          title: input.title,
          score: entry.score,
          maxScore: input.maxScore,
        });

        entries.push({
          studentId: entry.studentId,
          kind: composed.kind,
          body: composed.body,
          sourceType: TIMELINE_SOURCE.ASSESSMENT,
          sourceId: record.id,
        });
      }

      const published = await publishEntries(tx, {
        centreId: session.centreId,
        authorId: session.userId,
        batchId: batch.id,
        occurredAt: assessedOn,
        title: `Test result · ${batch.name}`,
        entries,
      });

      await recordAudit(tx, {
        centreId: session.centreId,
        actorId: session.userId,
        action: "assessment.saved",
        targetType: "Assessment",
        targetId: assessment.id,
        metadata: { batchId: batch.id, scoresRecorded: scores.length },
      });

      return {
        assessmentId: assessment.id,
        scoresRecorded: scores.length,
        classAveragePercent: assessmentAverage(
          scores.map((entry) => ({ score: entry.score, maxScore: input.maxScore })),
        ),
        notificationsQueued: published.notificationsQueued,
      };
    },
    { timeout: TRANSACTION_TIMEOUT_MS },
  );
}
