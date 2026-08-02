/**
 * Tests: at-risk detection
 *
 * These encode the centre's early-warning policy. If a threshold changes, a
 * test here should fail — that is the point. Silent drift in who gets flagged
 * is how a dashboard stops being trusted.
 */

import { describe, expect, it } from "vitest";
import { assessBatchHealth, assessRisk, RISK_THRESHOLDS, type RiskInput } from "@/domain/risk";
import { tallyAttendance, tallyHomework } from "@/domain/metrics";
import type { AttendanceStatus, HomeworkStatus } from "@/domain/enums";

/** Build an attendance tally with a target rate over `sessions` sessions. */
function attendanceAt(ratePercent: number, sessions: number) {
  const presentCount = Math.round((ratePercent / 100) * sessions);
  const statuses: AttendanceStatus[] = [
    ...Array<AttendanceStatus>(presentCount).fill("PRESENT"),
    ...Array<AttendanceStatus>(sessions - presentCount).fill("ABSENT"),
  ];
  return tallyAttendance(statuses.map((status) => ({ status })));
}

function homeworkAt(ratePercent: number, records: number) {
  const doneCount = Math.round((ratePercent / 100) * records);
  const statuses: HomeworkStatus[] = [
    ...Array<HomeworkStatus>(doneCount).fill("DONE"),
    ...Array<HomeworkStatus>(records - doneCount).fill("MISSING"),
  ];
  return tallyHomework(statuses.map((status) => ({ status })));
}

function input(overrides: Partial<RiskInput> = {}): RiskInput {
  return {
    attendance: attendanceAt(95, 20),
    homework: homeworkAt(90, 10),
    engagement: 70,
    consecutiveAbsences: 0,
    ...overrides,
  };
}

describe("assessRisk", () => {
  it("leaves a healthy student unflagged", () => {
    const result = assessRisk(input());
    expect(result.level).toBe("ON_TRACK");
    expect(result.reasons).toHaveLength(0);
  });

  it("flags low attendance as at risk", () => {
    const result = assessRisk(input({ attendance: attendanceAt(60, 20) }));
    expect(result.level).toBe("AT_RISK");
    expect(result.reasons.map((reason) => reason.code)).toContain("LOW_ATTENDANCE");
  });

  it("uses the milder band for borderline attendance", () => {
    const result = assessRisk(input({ attendance: attendanceAt(80, 20) }));
    expect(result.level).toBe("WATCH");
  });

  it("flags a run of missed sessions even when the average still looks fine", () => {
    // 85% attendance over a long period hides three sessions missed in a row —
    // which is the signal a centre can actually act on today.
    const result = assessRisk(
      input({ attendance: attendanceAt(90, 40), consecutiveAbsences: 3 }),
    );
    expect(result.level).toBe("AT_RISK");
    expect(result.reasons.map((reason) => reason.code)).toContain("CONSECUTIVE_ABSENCES");
  });

  it("flags low homework completion", () => {
    const result = assessRisk(input({ homework: homeworkAt(40, 10) }));
    expect(result.reasons.map((reason) => reason.code)).toContain("LOW_HOMEWORK");
  });

  it("flags low engagement", () => {
    const result = assessRisk(input({ engagement: 20 }));
    expect(result.level).toBe("AT_RISK");
  });

  it("does not flag a student with too little history to judge", () => {
    // Two sessions attended out of three is 67%, below the risk threshold —
    // but flagging a child in their first week is noise, not signal.
    const result = assessRisk(
      input({ attendance: attendanceAt(67, 3), homework: homeworkAt(50, 2) }),
    );
    expect(result.level).toBe("ON_TRACK");
  });

  it("reports every reason, not just the first", () => {
    const result = assessRisk(
      input({ attendance: attendanceAt(60, 20), homework: homeworkAt(30, 10), engagement: 20 }),
    );
    expect(result.reasons.length).toBeGreaterThanOrEqual(3);
  });
});

describe("assessBatchHealth", () => {
  it("classifies by the same thresholds students are judged by", () => {
    expect(assessBatchHealth(95, 90)).toBe("ON_TRACK");
    expect(assessBatchHealth(80, 90)).toBe("WATCH");
    expect(assessBatchHealth(60, 90)).toBe("AT_RISK");
    expect(assessBatchHealth(95, 40)).toBe("AT_RISK");
  });

  it("treats a batch with no data as on track rather than at risk", () => {
    // A brand-new batch must not appear in the owner's "needs attention" list.
    expect(assessBatchHealth(null, null)).toBe("ON_TRACK");
  });

  it("uses thresholds from the shared policy object", () => {
    expect(assessBatchHealth(RISK_THRESHOLDS.attendanceRisk - 1, 100)).toBe("AT_RISK");
    expect(assessBatchHealth(RISK_THRESHOLDS.attendanceRisk, 100)).toBe("WATCH");
  });
});
