/**
 * MODULE: Student profile queries
 *
 * Purpose        Assemble everything shown on one child's page — for whoever is
 *                allowed to see it.
 * Responsibility Authorised reads, composition of progress + timeline + peers.
 * Dependencies   @/lib/db, rbac, progress/batch services, domain.
 *
 * The SAME function serves the teacher view and the parent view. Access is
 * decided by `requireStudentAccess`, not by a `role` flag chosen in the UI, so
 * the two views cannot drift into showing different things to the wrong person.
 */

import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";
import { requireStudentAccess } from "@/lib/auth/rbac";
import { comparePeer, type PeerComparison } from "@/domain/metrics";
import type { TimelineKind } from "@/domain/enums";
import { getBatchStats } from "./batch.service";
import { getProgress, type StudentProgress } from "./progress.service";

/** One page of timeline. Deep history is reachable by paging, not by loading. */
export const TIMELINE_PAGE_SIZE = 50;

export interface TimelinePage {
  /** Oldest-first, ready to render as a thread. */
  items: TimelineItem[];
  /** Cursor for the next, older page — null when this is the last one. */
  olderCursor: string | null;
  /** True when `before` was supplied, i.e. we are not on the newest page. */
  isHistoric: boolean;
}

export interface TimelineItem {
  id: string;
  kind: TimelineKind;
  body: string;
  occurredAt: Date;
  authorName: string;
  batchName: string | null;
  acknowledgedAt: Date | null;
}

export interface StudentProfile {
  id: string;
  fullName: string;
  avatarColor: string;
  gradeLabel: string | null;
  batchName: string | null;
  batchId: string | null;
  progress: StudentProgress;
  /** How this child compares with their batch on homework completion. */
  homeworkVsBatch: PeerComparison | null;
  timeline: TimelinePage;
  unacknowledgedCount: number;
  guardianNames: string[];
}

export interface StudentProfileOptions {
  /** Entries per page. */
  limit?: number;
  /**
   * Id of the oldest entry already seen. The next page starts immediately
   * before it.
   *
   * A cursor rather than an offset: entries are added while a parent reads, and
   * `skip: 50` would silently shift the window under them — showing some
   * entries twice and hiding others entirely.
   */
  before?: string;
}

export async function getStudentProfile(
  session: SessionUser,
  studentId: string,
  options: StudentProfileOptions = {},
): Promise<StudentProfile> {
  const student = await requireStudentAccess(session, studentId);
  const limit = options.limit ?? TIMELINE_PAGE_SIZE;

  const [enrollment, progress, timelineRows, unacknowledgedCount, guardians] =
    await Promise.all([
      db.enrollment.findFirst({
        where: { studentId: student.id, isActive: true },
        select: { batch: { select: { id: true, name: true } } },
        orderBy: { joinedAt: "asc" },
      }),
      getProgress(student.id),
      db.timelineEntry.findMany({
        where: { studentId: student.id },
        select: {
          id: true,
          kind: true,
          body: true,
          occurredAt: true,
          acknowledgedAt: true,
          author: { select: { fullName: true } },
          batch: { select: { name: true } },
        },
        // `id` is the tie-breaker so the order is total: two entries saved in
        // the same batch share an `occurredAt`, and cursor paging needs a
        // deterministic sequence or it can skip or repeat rows.
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        // One extra row reveals whether an older page exists, without a
        // second count query.
        take: limit + 1,
        ...(options.before
          ? { cursor: { id: options.before }, skip: 1 }
          : {}),
      }),
      db.timelineEntry.count({
        where: { studentId: student.id, acknowledgedAt: null },
      }),
      db.parentLink.findMany({
        where: { studentId: student.id },
        select: { parent: { select: { fullName: true } } },
      }),
    ]);

  const batchId = enrollment?.batch.id ?? null;
  const batchStats = batchId ? await getBatchStats([batchId]) : null;

  // Trim the probe row back off before anything renders it.
  const hasOlder = timelineRows.length > limit;
  const pageRows = hasOlder ? timelineRows.slice(0, limit) : timelineRows;
  const oldestRow = pageRows[pageRows.length - 1];

  return {
    id: student.id,
    fullName: student.fullName,
    avatarColor: student.avatarColor,
    gradeLabel: student.gradeLabel,
    batchId,
    batchName: enrollment?.batch.name ?? null,
    progress,
    homeworkVsBatch: comparePeer(
      progress.homework.ratePercent,
      batchId ? (batchStats?.get(batchId)?.homeworkPercent ?? null) : null,
    ),
    timeline: {
      // Reversed to oldest-first for reading, like a chat thread. The cursor is
      // taken before this flip, from the genuinely oldest row.
      items: [...pageRows].reverse().map((row) => ({
        id: row.id,
        kind: row.kind as TimelineKind,
        body: row.body,
        occurredAt: row.occurredAt,
        authorName: row.author.fullName,
        batchName: row.batch?.name ?? null,
        acknowledgedAt: row.acknowledgedAt,
      })),
      olderCursor: hasOlder && oldestRow ? oldestRow.id : null,
      isHistoric: Boolean(options.before),
    },
    unacknowledgedCount,
    guardianNames: guardians.map((link) => link.parent.fullName),
  };
}
