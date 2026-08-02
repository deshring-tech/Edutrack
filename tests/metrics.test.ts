/**
 * Tests: progress metrics
 *
 * These cover the arithmetic a parent reads about their child. Several cases
 * here are regressions of real defects in the original prototype, marked as
 * such — a score above the maximum rendering as 120%, a blank total producing
 * "avg 1800%", and an empty record set reading as 0%.
 */

import { describe, expect, it } from "vitest";
import {
  assessmentAverage,
  clamp,
  comparePeer,
  consecutiveAbsences,
  engagementLabel,
  engagementScore,
  formatPercent,
  ratePercent,
  scorePercent,
  tallyAttendance,
  tallyHomework,
  weightedAverage,
  ENGAGEMENT_BASELINE,
} from "@/domain/metrics";
import type { AttendanceStatus, HomeworkStatus } from "@/domain/enums";

const attendance = (...statuses: AttendanceStatus[]) =>
  statuses.map((status) => ({ status }));

const homework = (...statuses: HomeworkStatus[]) =>
  statuses.map((status) => ({ status }));

describe("clamp", () => {
  it("constrains to the range", () => {
    expect(clamp(150, 0, 100)).toBe(100);
    expect(clamp(-20, 0, 100)).toBe(0);
    expect(clamp(42, 0, 100)).toBe(42);
  });

  it("returns the minimum for NaN rather than propagating it", () => {
    expect(clamp(Number.NaN, 0, 100)).toBe(0);
  });
});

describe("ratePercent", () => {
  it("rounds to a whole percentage", () => {
    expect(ratePercent(2, 3)).toBe(67);
  });

  // REGRESSION: the prototype's pct() returned 0 for an empty denominator,
  // which told a parent their child attended nothing.
  it("returns null for an empty denominator instead of zero", () => {
    expect(ratePercent(0, 0)).toBeNull();
    expect(ratePercent(5, -1)).toBeNull();
  });
});

describe("tallyAttendance", () => {
  it("counts each status", () => {
    const result = tallyAttendance(
      attendance("PRESENT", "PRESENT", "ABSENT", "LATE", "EXCUSED"),
    );

    expect(result.present).toBe(2);
    expect(result.absent).toBe(1);
    expect(result.late).toBe(1);
    expect(result.excused).toBe(1);
  });

  it("gives lateness half credit", () => {
    // 1 present + 1 late = 1.5 credit over 2 assessable sessions.
    expect(tallyAttendance(attendance("PRESENT", "LATE")).ratePercent).toBe(75);
  });

  it("excludes excused absences from the denominator", () => {
    const result = tallyAttendance(attendance("PRESENT", "EXCUSED", "EXCUSED"));
    expect(result.assessable).toBe(1);
    expect(result.ratePercent).toBe(100);
  });

  it("reports null when nothing has been recorded", () => {
    expect(tallyAttendance([]).ratePercent).toBeNull();
  });
});

describe("consecutiveAbsences", () => {
  it("counts the current streak from the most recent session", () => {
    expect(consecutiveAbsences(attendance("ABSENT", "ABSENT", "PRESENT", "ABSENT"))).toBe(2);
  });

  it("is zero when the most recent session was attended", () => {
    expect(consecutiveAbsences(attendance("PRESENT", "ABSENT", "ABSENT"))).toBe(0);
  });
});

describe("tallyHomework", () => {
  it("gives partial work half credit", () => {
    // done(1) + partial(0.5) + missing(0) = 1.5 over 3 records.
    expect(tallyHomework(homework("DONE", "PARTIAL", "MISSING")).ratePercent).toBe(50);
  });

  it("reports null when nothing has been recorded", () => {
    expect(tallyHomework([]).ratePercent).toBeNull();
  });
});

describe("scorePercent", () => {
  it("converts a score to a percentage", () => {
    expect(scorePercent({ score: 18, maxScore: 25 })).toBe(72);
  });

  // REGRESSION: the prototype rendered bonus marks as 120%.
  it("clamps a score above the maximum to 100%", () => {
    expect(scorePercent({ score: 30, maxScore: 25 })).toBe(100);
  });

  // REGRESSION: the prototype divided by `Number(testMax) || 1`, so clearing
  // the total field produced "avg 1800%".
  it("returns null for a zero or missing maximum", () => {
    expect(scorePercent({ score: 18, maxScore: 0 })).toBeNull();
    expect(scorePercent({ score: 18, maxScore: Number.NaN })).toBeNull();
  });

  it("rejects negative scores", () => {
    expect(scorePercent({ score: -5, maxScore: 25 })).toBeNull();
  });
});

describe("assessmentAverage", () => {
  it("averages valid results", () => {
    expect(
      assessmentAverage([
        { score: 20, maxScore: 25 }, // 80
        { score: 5, maxScore: 10 }, // 50
      ]),
    ).toBe(65);
  });

  it("ignores unusable results rather than skewing the average", () => {
    expect(
      assessmentAverage([
        { score: 20, maxScore: 25 },
        { score: 10, maxScore: 0 },
      ]),
    ).toBe(80);
  });

  it("returns null when there are no results", () => {
    expect(assessmentAverage([])).toBeNull();
  });
});

describe("engagementScore", () => {
  const now = new Date("2026-08-03T00:00:00.000Z");

  it("starts from the neutral baseline", () => {
    expect(engagementScore([], now)).toBe(ENGAGEMENT_BASELINE);
  });

  it("applies observations inside the window", () => {
    expect(
      engagementScore(
        [
          { delta: 6, occurredAt: new Date("2026-08-01T00:00:00.000Z") },
          { delta: 6, occurredAt: new Date("2026-07-30T00:00:00.000Z") },
        ],
        now,
      ),
    ).toBe(62);
  });

  it("ignores observations older than the window", () => {
    expect(
      engagementScore([{ delta: 20, occurredAt: new Date("2026-01-01T00:00:00.000Z") }], now),
    ).toBe(ENGAGEMENT_BASELINE);
  });

  // REGRESSION: the prototype's engagement could only ever increase, capped
  // at 100 — so the number carried no information.
  it("moves down as well as up, and stays in range", () => {
    const negative = Array.from({ length: 20 }, () => ({
      delta: -6,
      occurredAt: now,
    }));
    expect(engagementScore(negative, now)).toBe(0);

    const positive = Array.from({ length: 20 }, () => ({ delta: 6, occurredAt: now }));
    expect(engagementScore(positive, now)).toBe(100);
  });
});

describe("engagementLabel", () => {
  it("bands the score", () => {
    expect(engagementLabel(85)).toBe("Excellent");
    expect(engagementLabel(65)).toBe("Good");
    expect(engagementLabel(45)).toBe("Fair");
    expect(engagementLabel(10)).toBe("Needs focus");
  });
});

describe("comparePeer", () => {
  it("bands a child against their batch", () => {
    expect(comparePeer(90, 80)?.standing).toBe("AHEAD");
    expect(comparePeer(80, 80)?.standing).toBe("ON_PACE");
    expect(comparePeer(70, 80)?.standing).toBe("BEHIND");
  });

  it("returns null when either side has no data", () => {
    expect(comparePeer(null, 80)).toBeNull();
    expect(comparePeer(80, null)).toBeNull();
  });
});

describe("weightedAverage", () => {
  it("weights by class size", () => {
    // A 40-student batch at 90% must dominate a 4-student batch at 50%.
    expect(
      weightedAverage([
        { value: 90, weight: 40 },
        { value: 50, weight: 4 },
      ]),
    ).toBe(86);
  });

  it("skips entries with no value", () => {
    expect(
      weightedAverage([
        { value: null, weight: 10 },
        { value: 80, weight: 10 },
      ]),
    ).toBe(80);
  });

  it("returns null when nothing is weighable", () => {
    expect(weightedAverage([{ value: null, weight: 5 }])).toBeNull();
  });
});

describe("formatPercent", () => {
  it("renders missing data as an em dash, never as zero", () => {
    expect(formatPercent(null)).toBe("—");
    expect(formatPercent(0)).toBe("0%");
  });
});
