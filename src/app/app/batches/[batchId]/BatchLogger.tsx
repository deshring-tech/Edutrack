"use client";

/**
 * MODULE: Batch logging screen
 *
 * Purpose        Let a teacher record attendance, homework or a test for an
 *                entire batch in one pass.
 * Responsibility Local mark state and submission. Every value is re-validated
 *                and re-authorised on the server.
 * Dependencies   ./actions, roster passed from the server page.
 *
 * WHY THIS SCREEN IS THE PRODUCT
 *  A tutor finishing a class has about thirty seconds of attention. Anything
 *  that takes longer gets done "later", which means never, which means the
 *  parent hears nothing and the subscription churns. Every choice here serves
 *  that budget: attendance defaults to everyone present, marks are one tap, and
 *  saving is a single button that says exactly what will happen.
 *
 * The form is pre-filled from what is already saved for the chosen day, so
 * re-opening it corrects rather than duplicates.
 */

import { useActionState, useMemo, useState } from "react";
import {
  Award,
  BookOpen,
  CalendarCheck,
  Check,
  Clock,
  Minus,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { FormError, SubmitButton } from "@/components/ui/Forms";
import {
  ATTENDANCE_STATUS,
  HOMEWORK_STATUS,
  type AttendanceStatus,
  type HomeworkStatus,
} from "@/domain/enums";
import { IDLE_ACTION_STATE } from "@/server/action-result";
import {
  saveAssessmentAction,
  saveAttendanceAction,
  saveHomeworkAction,
} from "./actions";

export interface RosterEntry {
  studentId: string;
  fullName: string;
  avatarColor: string;
}

interface BatchLoggerProps {
  batchId: string;
  today: string;
  roster: RosterEntry[];
  initialAttendance: Record<string, AttendanceStatus>;
  initialHomework: Record<string, HomeworkStatus>;
}

type Tab = "attendance" | "homework" | "test";

const TABS: { id: Tab; label: string; icon: typeof Check; color: string }[] = [
  { id: "attendance", label: "Attendance", icon: CalendarCheck, color: "var(--color-kind-attendance)" },
  { id: "homework", label: "Homework", icon: BookOpen, color: "var(--color-kind-homework)" },
  { id: "test", label: "Test", icon: Award, color: "var(--color-kind-assessment)" },
];

const ATTENDANCE_OPTIONS: {
  value: AttendanceStatus;
  label: string;
  icon: typeof Check;
  color: string;
}[] = [
  { value: ATTENDANCE_STATUS.PRESENT, label: "Present", icon: Check, color: "#43a047" },
  { value: ATTENDANCE_STATUS.LATE, label: "Late", icon: Clock, color: "#fb8c00" },
  { value: ATTENDANCE_STATUS.ABSENT, label: "Absent", icon: X, color: "#e53935" },
];

const HOMEWORK_OPTIONS: {
  value: HomeworkStatus;
  label: string;
  icon: typeof Check;
  color: string;
}[] = [
  { value: HOMEWORK_STATUS.DONE, label: "Done", icon: Check, color: "#43a047" },
  { value: HOMEWORK_STATUS.PARTIAL, label: "Partly done", icon: Minus, color: "#fb8c00" },
  { value: HOMEWORK_STATUS.MISSING, label: "Not done", icon: X, color: "#e53935" },
];

export function BatchLogger({
  batchId,
  today,
  roster,
  initialAttendance,
  initialHomework,
}: BatchLoggerProps) {
  const [tab, setTab] = useState<Tab>("attendance");
  const [date, setDate] = useState(today);

  // Attendance defaults to present: in a tuition centre most students turn up,
  // so the teacher only has to touch the exceptions.
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>(() =>
    Object.fromEntries(
      roster.map((entry) => [
        entry.studentId,
        initialAttendance[entry.studentId] ?? ATTENDANCE_STATUS.PRESENT,
      ]),
    ),
  );

  // Homework starts blank: an unrecorded student is different from one marked
  // as having done nothing, and only the teacher knows which it is.
  const [homework, setHomework] = useState<Record<string, HomeworkStatus | undefined>>(
    () => ({ ...initialHomework }),
  );

  const [scores, setScores] = useState<Record<string, string>>({});
  const [testTitle, setTestTitle] = useState("");
  const [testMax, setTestMax] = useState("25");

  const [attendanceState, submitAttendance] = useActionState(
    saveAttendanceAction,
    IDLE_ACTION_STATE,
  );
  const [homeworkState, submitHomework] = useActionState(
    saveHomeworkAction,
    IDLE_ACTION_STATE,
  );
  const [assessmentState, submitAssessment] = useActionState(
    saveAssessmentAction,
    IDLE_ACTION_STATE,
  );

  const attendanceCounts = useMemo(() => {
    const counts = { present: 0, late: 0, absent: 0 };
    for (const entry of roster) {
      const status = attendance[entry.studentId];
      if (status === ATTENDANCE_STATUS.PRESENT) counts.present += 1;
      else if (status === ATTENDANCE_STATUS.LATE) counts.late += 1;
      else if (status === ATTENDANCE_STATUS.ABSENT) counts.absent += 1;
    }
    return counts;
  }, [attendance, roster]);

  const homeworkCounts = useMemo(() => {
    const counts = { done: 0, partial: 0, missing: 0, recorded: 0 };
    for (const entry of roster) {
      const status = homework[entry.studentId];
      if (!status) continue;
      counts.recorded += 1;
      if (status === HOMEWORK_STATUS.DONE) counts.done += 1;
      else if (status === HOMEWORK_STATUS.PARTIAL) counts.partial += 1;
      else counts.missing += 1;
    }
    return counts;
  }, [homework, roster]);

  const enteredScores = useMemo(
    () =>
      roster
        .map((entry) => ({ studentId: entry.studentId, raw: scores[entry.studentId] ?? "" }))
        .filter((entry) => entry.raw.trim() !== "")
        .map((entry) => ({ studentId: entry.studentId, score: Number(entry.raw) }))
        .filter((entry) => Number.isFinite(entry.score)),
    [roster, scores],
  );

  const maxScore = Number(testMax);
  // Mirrors `domain/metrics.assessmentAverage`, guarded the same way: an empty
  // or zero maximum shows nothing rather than a nonsense percentage.
  const liveAverage =
    enteredScores.length > 0 && Number.isFinite(maxScore) && maxScore > 0
      ? Math.round(
          (enteredScores.reduce(
            (total, entry) => total + Math.min(entry.score / maxScore, 1),
            0,
          ) /
            enteredScores.length) *
            100,
        )
      : null;

  const homeworkMarks = roster
    .filter((entry) => homework[entry.studentId])
    .map((entry) => ({ studentId: entry.studentId, status: homework[entry.studentId] }));

  const activeState =
    tab === "attendance" ? attendanceState : tab === "homework" ? homeworkState : assessmentState;

  return (
    <div className="card overflow-hidden">
      {/* ------------------------------------------------------------ tabs -- */}
      <div role="tablist" aria-label="What to record" className="flex gap-1 bg-[#efefed] p-1.5">
        {TABS.map((entry) => {
          const isActive = tab === entry.id;
          return (
            <button
              key={entry.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => setTab(entry.id)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[12.5px] font-semibold transition-colors"
              style={
                isActive
                  ? { background: "#fff", color: entry.color, boxShadow: "0 1px 3px rgb(0 0 0 / 0.08)" }
                  : { color: "#888" }
              }
            >
              <entry.icon size={14} aria-hidden="true" />
              {entry.label}
            </button>
          );
        })}
      </div>

      {/* --------------------------------------------------- summary strip -- */}
      <div className="flex flex-wrap items-center gap-3 border-b border-hairline bg-[#fafaf8] px-4 py-2.5 text-[12.5px]">
        {tab === "attendance" && (
          <>
            <span className="font-semibold text-[color:var(--color-status-ontrack)]">
              {attendanceCounts.present} present
            </span>
            <span className="font-semibold text-[color:var(--color-status-watch)]">
              {attendanceCounts.late} late
            </span>
            <span className="font-semibold text-[color:var(--color-status-risk)]">
              {attendanceCounts.absent} absent
            </span>
          </>
        )}

        {tab === "homework" && (
          <>
            <span className="font-semibold text-[color:var(--color-status-ontrack)]">
              {homeworkCounts.done} done
            </span>
            <span className="font-semibold text-[color:var(--color-status-watch)]">
              {homeworkCounts.partial} partly
            </span>
            <span className="font-semibold text-[color:var(--color-status-risk)]">
              {homeworkCounts.missing} not done
            </span>
            <span className="text-gray-400">
              {homeworkCounts.recorded} of {roster.length} recorded
            </span>
          </>
        )}

        {tab === "test" && (
          <div className="flex w-full flex-wrap items-center gap-2">
            <input
              value={testTitle}
              onChange={(event) => setTestTitle(event.target.value)}
              placeholder="Test name (e.g. Unit Test 3)"
              aria-label="Test name"
              className="min-w-40 flex-1 border-b border-hairline bg-transparent pb-1 text-[13px] outline-none"
            />
            <label className="flex items-center gap-1 text-[12px] text-gray-500">
              out of
              <input
                value={testMax}
                onChange={(event) => setTestMax(event.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                aria-label="Total marks"
                className="w-12 border-b border-hairline bg-transparent pb-1 text-center text-[13px] outline-none"
              />
            </label>
            {liveAverage !== null && (
              <span className="text-[12px] font-bold text-[color:var(--color-kind-assessment)]">
                avg {liveAverage}%
              </span>
            )}
          </div>
        )}

        <label className="ml-auto flex items-center gap-1.5 text-[12px] text-gray-500">
          Date
          <input
            type="date"
            value={date}
            max={today}
            onChange={(event) => setDate(event.target.value)}
            aria-label="Date being recorded"
            className="rounded-md border border-hairline bg-white px-2 py-1 text-[12px] text-ink outline-none"
          />
        </label>
      </div>

      {/* ----------------------------------------------------------- roster -- */}
      <ul className="max-h-[52vh] overflow-y-auto">
        {roster.map((entry) => (
          <li
            key={entry.studentId}
            className="flex items-center gap-3 border-b border-[#f4f4f2] px-3 py-2"
          >
            <Avatar name={entry.fullName} color={entry.avatarColor} size={34} />
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">
              {entry.fullName}
            </span>

            {tab === "attendance" && (
              <OptionGroup
                label={`Attendance for ${entry.fullName}`}
                options={ATTENDANCE_OPTIONS}
                value={attendance[entry.studentId]}
                onChange={(value) =>
                  setAttendance((previous) => ({ ...previous, [entry.studentId]: value }))
                }
              />
            )}

            {tab === "homework" && (
              <OptionGroup
                label={`Homework for ${entry.fullName}`}
                options={HOMEWORK_OPTIONS}
                value={homework[entry.studentId]}
                onChange={(value) =>
                  setHomework((previous) => ({ ...previous, [entry.studentId]: value }))
                }
              />
            )}

            {tab === "test" && (
              <div className="flex items-center gap-1">
                <input
                  value={scores[entry.studentId] ?? ""}
                  onChange={(event) =>
                    setScores((previous) => ({
                      ...previous,
                      [entry.studentId]: event.target.value.replace(/[^0-9.]/g, ""),
                    }))
                  }
                  inputMode="decimal"
                  placeholder="–"
                  aria-label={`Score for ${entry.fullName}`}
                  className="w-14 rounded-lg border border-hairline bg-[#f2f2f0] py-1.5 text-center text-[13px] outline-none"
                />
                <span className="w-8 text-[12px] text-gray-400">/{testMax || "—"}</span>
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* ------------------------------------------------------------ save -- */}
      <div className="border-t border-hairline bg-[#fafaf8] p-3">
        {activeState.status === "success" && (
          <p
            role="status"
            className="mb-2 rounded-lg bg-brand-100 px-3 py-2 text-[12.5px] font-medium text-[color:var(--color-status-ontrack)]"
          >
            {activeState.message}
          </p>
        )}
        {activeState.status === "error" && (
          <div className="mb-2">
            <FormError message={activeState.message} />
          </div>
        )}

        {tab === "attendance" && (
          <form action={submitAttendance}>
            <input type="hidden" name="batchId" value={batchId} />
            <input type="hidden" name="sessionDate" value={date} />
            <input
              type="hidden"
              name="marks"
              value={JSON.stringify(
                roster.map((entry) => ({
                  studentId: entry.studentId,
                  status: attendance[entry.studentId],
                })),
              )}
            />
            <SubmitButton className="w-full">
              Save attendance · notify {roster.length}{" "}
              {roster.length === 1 ? "parent" : "parents"}
            </SubmitButton>
          </form>
        )}

        {tab === "homework" && (
          <form action={submitHomework}>
            <input type="hidden" name="batchId" value={batchId} />
            <input type="hidden" name="recordedOn" value={date} />
            <input type="hidden" name="marks" value={JSON.stringify(homeworkMarks)} />
            <SubmitButton className="w-full" disabled={homeworkMarks.length === 0}>
              {homeworkMarks.length === 0
                ? "Mark at least one student"
                : `Save homework · notify ${homeworkMarks.length} ${homeworkMarks.length === 1 ? "parent" : "parents"}`}
            </SubmitButton>
          </form>
        )}

        {tab === "test" && (
          <form action={submitAssessment}>
            <input type="hidden" name="batchId" value={batchId} />
            <input type="hidden" name="assessedOn" value={date} />
            <input type="hidden" name="title" value={testTitle} />
            <input type="hidden" name="maxScore" value={testMax} />
            <input type="hidden" name="scores" value={JSON.stringify(enteredScores)} />
            <SubmitButton
              className="w-full"
              disabled={enteredScores.length === 0 || testTitle.trim() === ""}
            >
              {testTitle.trim() === ""
                ? "Name the test first"
                : enteredScores.length === 0
                  ? "Enter at least one score"
                  : `Save results · notify ${enteredScores.length} ${enteredScores.length === 1 ? "parent" : "parents"}`}
            </SubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}

/**
 * A single-choice row control.
 * Implemented as buttons with `aria-pressed` rather than a custom widget, so it
 * works with a keyboard and announces its state without extra wiring.
 */
function OptionGroup<Value extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: Value; label: string; icon: typeof Check; color: string }[];
  value: Value | undefined;
  onChange: (value: Value) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1">
      {options.map((option) => {
        const isSelected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isSelected}
            title={option.label}
            onClick={() => onChange(option.value)}
            className="flex size-9 items-center justify-center rounded-lg transition-colors"
            style={{
              background: isSelected
                ? option.color
                : `color-mix(in srgb, ${option.color} 10%, transparent)`,
              color: isSelected ? "#fff" : option.color,
            }}
          >
            <option.icon size={16} aria-hidden="true" />
            <span className="sr-only">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
