/**
 * MODULE: Date handling
 *
 * Purpose        Give the product one unambiguous notion of "a day".
 * Responsibility Normalise dates to day boundaries and format them for humans.
 * Dependencies   None.
 *
 * WHY THIS EXISTS
 *  Attendance and homework are keyed by day in the database. If one code path
 *  stores `2026-08-03T14:22:31Z` and another stores `2026-08-03T00:00:00Z`,
 *  the unique constraints silently stop deduplicating and a batch save creates
 *  a second set of records. Everything that touches a "date" goes through
 *  `startOfDayUtc` so the key is always identical.
 *
 *  Dates are normalised in UTC and rendered in the centre's timezone. Storing
 *  local-midnight would move the key whenever the server's timezone changed.
 */

const MILLISECONDS_PER_DAY = 86_400_000;

/** Midnight UTC on the calendar day of `value`. The canonical day key. */
export function startOfDayUtc(value: Date = new Date()): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

export function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * MILLISECONDS_PER_DAY);
}

export function daysAgo(days: number, from: Date = new Date()): Date {
  return startOfDayUtc(addDays(from, -days));
}

/** `2026-08-03` — used for date inputs and stable URL parameters. */
export function toDateInputValue(value: Date): string {
  return startOfDayUtc(value).toISOString().slice(0, 10);
}

/**
 * Parses a `YYYY-MM-DD` string into a canonical day key.
 * Returns null rather than an Invalid Date so callers cannot accidentally
 * persist `NaN` as a unique key.
 */
export function parseDateInputValue(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isSameDayUtc(a: Date, b: Date): boolean {
  return startOfDayUtc(a).getTime() === startOfDayUtc(b).getTime();
}

/** "Today" / "Yesterday" / "Mon 3 Aug" — the timeline's relative day label. */
export function formatRelativeDay(
  value: Date,
  now: Date = new Date(),
  timeZone = "Asia/Kolkata",
): string {
  if (isSameDayUtc(value, now)) return "Today";
  if (isSameDayUtc(value, addDays(now, -1))) return "Yesterday";
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  }).format(value);
}

export function formatDay(value: Date, timeZone = "Asia/Kolkata"): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone,
  }).format(value);
}

export function formatTime(value: Date, timeZone = "Asia/Kolkata"): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).format(value);
}

export function formatDateTime(value: Date, timeZone = "Asia/Kolkata"): string {
  return `${formatRelativeDay(value, new Date(), timeZone)} · ${formatTime(value, timeZone)}`;
}

/**
 * True when a timestamp is a pure day key rather than a real moment.
 * Attendance, homework and test entries are keyed by day, so their "time" is
 * an artefact of normalisation, not something that happened at that hour.
 */
export function isDayKey(value: Date): boolean {
  return value.getTime() === startOfDayUtc(value).getTime();
}

/**
 * Timestamp for a timeline entry.
 *
 * Day-keyed entries render as a day alone. Rendering midnight UTC in the
 * centre's timezone produced "Mon, 6 Jul · 5:30 am" on every attendance
 * record — a precise-looking time that claims something the data does not
 * know. Notes and engagement observations do carry a real moment, so those
 * keep their clock time.
 */
export function formatEntryTimestamp(
  value: Date,
  now: Date = new Date(),
  timeZone = "Asia/Kolkata",
): string {
  return isDayKey(value)
    ? formatRelativeDay(value, now, timeZone)
    : `${formatRelativeDay(value, now, timeZone)} · ${formatTime(value, timeZone)}`;
}
