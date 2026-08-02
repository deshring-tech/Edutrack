/**
 * Tests: date handling
 *
 * The day key is what makes batch logging idempotent. If `startOfDayUtc` ever
 * stops collapsing a timestamp to midnight, the unique constraints stop
 * deduplicating and every re-save creates a second set of records — visible to
 * a parent as the same message twice.
 */

import { describe, expect, it } from "vitest";
import {
  addDays,
  formatEntryTimestamp,
  formatRelativeDay,
  isDayKey,
  isSameDayUtc,
  parseDateInputValue,
  startOfDayUtc,
  toDateInputValue,
} from "@/domain/dates";

describe("startOfDayUtc", () => {
  it("collapses any time on a day to the same key", () => {
    const morning = new Date("2026-08-03T04:15:00.000Z");
    const evening = new Date("2026-08-03T23:59:59.000Z");

    expect(startOfDayUtc(morning).toISOString()).toBe("2026-08-03T00:00:00.000Z");
    expect(startOfDayUtc(morning).getTime()).toBe(startOfDayUtc(evening).getTime());
  });
});

describe("parseDateInputValue", () => {
  it("parses a date input value into a day key", () => {
    expect(parseDateInputValue("2026-08-03")?.toISOString()).toBe(
      "2026-08-03T00:00:00.000Z",
    );
  });

  it("rejects anything that is not YYYY-MM-DD", () => {
    // Returning null rather than an Invalid Date stops NaN reaching a unique key.
    expect(parseDateInputValue("03/08/2026")).toBeNull();
    expect(parseDateInputValue("")).toBeNull();
    expect(parseDateInputValue("2026-8-3")).toBeNull();
  });

  it("round-trips with toDateInputValue", () => {
    const value = "2026-08-03";
    const parsed = parseDateInputValue(value);
    expect(parsed).not.toBeNull();
    expect(toDateInputValue(parsed!)).toBe(value);
  });
});

describe("addDays and isSameDayUtc", () => {
  it("moves by whole days", () => {
    const base = new Date("2026-08-03T00:00:00.000Z");
    expect(toDateInputValue(addDays(base, 1))).toBe("2026-08-04");
    expect(toDateInputValue(addDays(base, -3))).toBe("2026-07-31");
  });

  it("compares by calendar day, not by instant", () => {
    expect(
      isSameDayUtc(new Date("2026-08-03T01:00:00Z"), new Date("2026-08-03T22:00:00Z")),
    ).toBe(true);
    expect(
      isSameDayUtc(new Date("2026-08-03T23:00:00Z"), new Date("2026-08-04T01:00:00Z")),
    ).toBe(false);
  });
});

describe("formatRelativeDay", () => {
  const now = new Date("2026-08-03T10:00:00.000Z");

  it("uses relative wording for the last two days", () => {
    expect(formatRelativeDay(new Date("2026-08-03T02:00:00Z"), now)).toBe("Today");
    expect(formatRelativeDay(new Date("2026-08-02T18:00:00Z"), now)).toBe("Yesterday");
  });

  it("falls back to a dated label further back", () => {
    const label = formatRelativeDay(new Date("2026-07-28T10:00:00Z"), now);
    expect(label).not.toBe("Today");
    expect(label).toContain("Jul");
  });
});

describe("formatEntryTimestamp", () => {
  const now = new Date("2026-08-03T10:00:00.000Z");

  it("recognises a day key", () => {
    expect(isDayKey(new Date("2026-07-06T00:00:00.000Z"))).toBe(true);
    expect(isDayKey(new Date("2026-07-06T09:15:00.000Z"))).toBe(false);
  });

  // Midnight UTC rendered in Asia/Kolkata is 5:30 am, so every attendance
  // record used to claim it happened at 5:30 in the morning.
  it("omits the clock time for day-keyed entries", () => {
    const label = formatEntryTimestamp(new Date("2026-07-06T00:00:00.000Z"), now);
    expect(label).toContain("Jul");
    expect(label).not.toContain("am");
    expect(label).not.toContain(":");
  });

  it("keeps the clock time for entries that happened at a real moment", () => {
    const label = formatEntryTimestamp(new Date("2026-08-03T09:15:00.000Z"), now);
    expect(label).toContain("Today");
    expect(label).toContain(":");
  });
});
