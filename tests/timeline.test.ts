/**
 * Tests: timeline message composition
 *
 * These assert the product's voice as well as its correctness. The wording that
 * reaches a parent about their child is a product surface: "Marked absent
 * today. Please let us know the reason." and "Your child skipped class" carry
 * identical data and completely different relationships.
 */

import { describe, expect, it } from "vitest";
import {
  composeAssessment,
  composeAssignment,
  composeAttendance,
  composeEngagement,
  composeHomework,
  composeNote,
} from "@/domain/timeline";
import { TIMELINE_KIND } from "@/domain/enums";

const formatDate = () => "6 Jun";

describe("composeAttendance", () => {
  it("labels every status with the attendance kind", () => {
    expect(composeAttendance("PRESENT").kind).toBe(TIMELINE_KIND.ATTENDANCE);
    expect(composeAttendance("PRESENT").body).toContain("Present");
    expect(composeAttendance("LATE").body).toContain("late");
  });

  it("asks rather than accuses when a student is absent", () => {
    const body = composeAttendance("ABSENT").body;
    expect(body).toContain("absent");
    expect(body.toLowerCase()).toContain("reason");
  });

  it("thanks a parent who gave notice", () => {
    expect(composeAttendance("EXCUSED").body.toLowerCase()).toContain("thank you");
  });
});

describe("composeHomework", () => {
  it("describes each outcome", () => {
    expect(composeHomework("DONE").body).toBe("Homework completed.");
    expect(composeHomework("PARTIAL").body).toContain("partly");
    expect(composeHomework("MISSING").body).toContain("not submitted");
  });

  it("names the assignment when there is one", () => {
    const body = composeHomework("DONE", "Algebra worksheet").body;
    expect(body).toContain("Algebra worksheet");
    // The sentence is stitched, so the second clause must not start capitalised.
    expect(body).toBe("Algebra worksheet — homework completed.");
  });
});

describe("composeAssignment", () => {
  it("includes only the parts that are present", () => {
    expect(composeAssignment({ title: "Ch. 4 worksheet", formatDate }).body).toBe(
      "New assignment: Ch. 4 worksheet",
    );
  });

  it("appends due date and attachment when given", () => {
    const body = composeAssignment({
      title: "Ch. 4 worksheet",
      dueDate: new Date("2026-06-06T00:00:00Z"),
      attachmentName: "ch4.pdf",
      formatDate,
    }).body;

    expect(body).toContain("due 6 Jun");
    expect(body).toContain("ch4.pdf");
  });
});

describe("composeAssessment", () => {
  it("shows the raw score and the percentage", () => {
    expect(composeAssessment({ title: "Unit Test 3", score: 18, maxScore: 25 }).body).toBe(
      "Unit Test 3: 18/25 (72%)",
    );
  });

  it("omits the percentage when it cannot be computed", () => {
    const body = composeAssessment({ title: "Quiz", score: 5, maxScore: 0 }).body;
    expect(body).toBe("Quiz: 5/0");
    expect(body).not.toContain("%");
  });

  it("trims trailing zeros from fractional marks", () => {
    expect(
      composeAssessment({ title: "Quiz", score: 18.5, maxScore: 25 }).body,
    ).toContain("18.5/25");
  });
});

describe("composeEngagement", () => {
  it("prefers the teacher's own words", () => {
    expect(composeEngagement(6, "Led the group experiment.").body).toBe(
      "Led the group experiment.",
    );
  });

  it("has a default for both directions", () => {
    expect(composeEngagement(6).body).toContain("engaged");
    expect(composeEngagement(-6).body).toContain("distracted");
  });
});

describe("composeNote", () => {
  it("trims and keeps the note kind", () => {
    const entry = composeNote("  Please practise tables.  ");
    expect(entry.kind).toBe(TIMELINE_KIND.NOTE);
    expect(entry.body).toBe("Please practise tables.");
  });
});
