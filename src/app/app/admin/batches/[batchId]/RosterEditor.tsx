"use client";

/**
 * MODULE: Roster editor
 *
 * Purpose        Choose which students are in a batch.
 * Responsibility Presentation and pending state.
 *
 * Every active student in the centre is listed with an in/out toggle, rather
 * than a search-and-add flow. At the scale this product serves — tens of
 * students per centre, not thousands — seeing the whole list is faster and
 * makes it obvious who has been left out.
 */

import { useActionState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { ActionBanner, SubmitButton } from "@/components/ui/Forms";
import { IDLE_ACTION_STATE } from "@/server/action-result";
import type { RosterEditor as RosterEditorData } from "@/server/services/admin.service";
import { setEnrollmentAction } from "../../actions";

export function RosterEditor({ roster }: { roster: RosterEditorData }) {
  const [state, submit] = useActionState(setEnrollmentAction, IDLE_ACTION_STATE);

  return (
    <section className="card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="font-semibold text-ink">Who is in this batch</h2>
        <span className="ml-auto text-[11.5px] text-gray-400">
          {roster.enrolledCount} of {roster.students.length} students enrolled
        </span>
      </div>

      <ActionBanner state={state} />

      {roster.students.length === 0 ? (
        <p className="mt-2 text-[13px] text-gray-500">
          There are no active students in your centre yet. Add students first.
        </p>
      ) : (
        <ul className="mt-2">
          {roster.students.map((student) => (
            <li
              key={student.id}
              className="flex items-center gap-3 border-t border-[#f2f2f2] py-2 first:border-0"
            >
              <Avatar name={student.fullName} color={student.avatarColor} size={32} />

              <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">
                {student.fullName}
              </span>

              {student.enrolled && (
                <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10.5px] font-semibold text-brand-900">
                  Enrolled
                </span>
              )}

              <form action={submit}>
                <input type="hidden" name="batchId" value={roster.batchId} />
                <input type="hidden" name="studentId" value={student.id} />
                <input
                  type="hidden"
                  name="enrolled"
                  value={student.enrolled ? "false" : "true"}
                />
                <SubmitButton variant="secondary" pendingLabel="Saving…">
                  {student.enrolled ? "Remove" : "Add"}
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
