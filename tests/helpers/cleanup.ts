/**
 * MODULE: Test cleanup helper
 *
 * Purpose        Remove a throwaway centre and everything under it.
 * Responsibility Delete in dependency order.
 *
 * WHY `centre.delete()` IS NOT ENOUGH
 *  Centre cascades to User, Student and Batch — but Batch, ClassSession,
 *  Assignment, Assessment, EngagementLog and TimelineEntry all reference a User
 *  as author or teacher with the default `Restrict` action. That is deliberate:
 *  deleting a teacher must NOT silently delete their batches and every mark
 *  they ever recorded. The consequence is that a centre cannot be removed in
 *  one statement — the dependent rows have to go first.
 *
 *  Without this, `centre.delete()` throws a foreign-key error. A `.catch()`
 *  around it hides the failure and quietly leaves the test tenant behind.
 *
 * PRODUCTION NOTE
 *  The application has no "delete a centre" feature, and this ordering is what
 *  one would need. Erasing a tenant on request is a DPDP obligation, so this
 *  helper is a sketch of the routine that still has to be built properly —
 *  with archival and an audit record, rather than a hard delete.
 */

import { db } from "@/lib/db";

export async function deleteCentreDeep(centreId: string): Promise<void> {
  await db.$transaction([
    // Leaf records that point at users, students or batches.
    db.notificationOutbox.deleteMany({ where: { centreId } }),
    db.timelineEntry.deleteMany({ where: { centreId } }),
    db.auditLog.deleteMany({ where: { centreId } }),
    db.attendanceRecord.deleteMany({ where: { session: { batch: { centreId } } } }),
    db.classSession.deleteMany({ where: { batch: { centreId } } }),
    db.assessmentScore.deleteMany({ where: { assessment: { batch: { centreId } } } }),
    db.assessment.deleteMany({ where: { batch: { centreId } } }),
    db.homeworkRecord.deleteMany({ where: { batch: { centreId } } }),
    db.assignment.deleteMany({ where: { batch: { centreId } } }),
    db.engagementLog.deleteMany({ where: { student: { centreId } } }),
    db.enrollment.deleteMany({ where: { batch: { centreId } } }),
    db.parentLink.deleteMany({ where: { student: { centreId } } }),
    db.passwordResetToken.deleteMany({ where: { user: { centreId } } }),

    // Now the things those pointed at.
    db.batch.deleteMany({ where: { centreId } }),
    db.student.deleteMany({ where: { centreId } }),
    db.user.deleteMany({ where: { centreId } }),
    db.centre.deleteMany({ where: { id: centreId } }),
  ]);
}
