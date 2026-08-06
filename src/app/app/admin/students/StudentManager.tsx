"use client";

/**
 * MODULE: Student management
 *
 * Purpose        Add students, link a guardian, and withdraw or re-admit them.
 * Responsibility Presentation and pending state.
 *
 * The guardian block is part of the create form rather than a separate step:
 * a student with no linked guardian generates timeline entries nobody can see,
 * which is the one configuration that makes the product silently useless.
 */

import { useActionState, useRef } from "react";
import { UserPlus } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { ActionBanner, SubmitButton } from "@/components/ui/Forms";
import { IDLE_ACTION_STATE } from "@/server/action-result";
import type { AdminStudent } from "@/server/services/admin.service";
import { createStudentAction, setStudentActiveAction } from "../actions";

export interface BatchOption {
  id: string;
  name: string;
}

interface StudentManagerProps {
  students: AdminStudent[];
  batches: BatchOption[];
  seatsRemaining: number;
}

export function StudentManager({
  students,
  batches,
  seatsRemaining,
}: StudentManagerProps) {
  const [createState, submitCreate] = useActionState(
    createStudentAction,
    IDLE_ACTION_STATE,
  );
  const [toggleState, submitToggle] = useActionState(
    setStudentActiveAction,
    IDLE_ACTION_STATE,
  );
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <UserPlus size={16} className="text-brand-700" aria-hidden="true" />
          <h2 className="font-semibold text-ink">Add a student</h2>
          <span className="ml-auto text-[11.5px] text-gray-400">
            {seatsRemaining} {seatsRemaining === 1 ? "seat" : "seats"} left on your plan
          </span>
        </div>

        <form
          ref={formRef}
          action={async (formData) => {
            await submitCreate(formData);
            formRef.current?.reset();
          }}
          className="space-y-2.5"
        >
          <div className="grid gap-2.5 sm:grid-cols-3">
            <label className="block">
              <span className="text-[11px] font-semibold text-gray-500">
                Student name
              </span>
              <input
                name="fullName"
                required
                maxLength={120}
                placeholder="Aarav Sharma"
                className="field-input mt-1"
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-semibold text-gray-500">
                Grade (optional)
              </span>
              <input
                name="gradeLabel"
                maxLength={40}
                placeholder="Grade 7"
                className="field-input mt-1"
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-semibold text-gray-500">Batch</span>
              <select name="batchId" defaultValue="" className="field-input mt-1">
                <option value="">Not enrolled yet</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <fieldset className="rounded-xl border border-hairline p-3">
            <legend className="px-1 text-[11px] font-semibold text-gray-500">
              Guardian (optional, but they see nothing without one)
            </legend>

            <div className="grid gap-2.5 sm:grid-cols-3">
              <label className="block">
                <span className="text-[11px] font-semibold text-gray-500">Name</span>
                <input
                  name="guardianName"
                  maxLength={120}
                  placeholder="Anita Sharma"
                  className="field-input mt-1"
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-semibold text-gray-500">Email</span>
                <input
                  name="guardianEmail"
                  type="email"
                  placeholder="anita@example.in"
                  className="field-input mt-1"
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-semibold text-gray-500">Phone</span>
                <input name="guardianPhone" maxLength={20} className="field-input mt-1" />
              </label>
            </div>
          </fieldset>

          <ActionBanner state={createState} />
          <SubmitButton disabled={seatsRemaining <= 0}>
            {seatsRemaining <= 0 ? "No seats left on your plan" : "Add student"}
          </SubmitButton>
        </form>
      </section>

      <section className="card p-4">
        <h2 className="mb-3 font-semibold text-ink">
          Students <span className="font-normal text-gray-400">({students.length})</span>
        </h2>

        <ActionBanner state={toggleState} />

        {students.length === 0 ? (
          <p className="mt-2 text-[13px] text-gray-500">
            No students yet. Add your first one above.
          </p>
        ) : (
          <ul className="mt-2">
            {students.map((student) => (
              <li
                key={student.id}
                className="flex flex-wrap items-center gap-3 border-t border-[#f2f2f2] py-2.5 first:border-0"
              >
                <Avatar name={student.fullName} color={student.avatarColor} size={34} />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13.5px] font-medium text-ink">
                      {student.fullName}
                    </span>
                    {!student.isActive && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10.5px] font-semibold text-red-600">
                        Withdrawn
                      </span>
                    )}
                    {student.guardians.length === 0 && student.isActive && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700">
                        No guardian
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[11.5px] text-gray-500">
                    {student.batchNames.length > 0
                      ? student.batchNames.join(", ")
                      : "Not enrolled"}
                    {student.guardians.length > 0 &&
                      ` · ${student.guardians.map((guardian) => guardian.fullName).join(", ")}`}
                  </div>
                </div>

                <form action={submitToggle}>
                  <input type="hidden" name="studentId" value={student.id} />
                  <input
                    type="hidden"
                    name="isActive"
                    value={student.isActive ? "false" : "true"}
                  />
                  <SubmitButton variant="secondary" pendingLabel="Saving…">
                    {student.isActive ? "Withdraw" : "Re-admit"}
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
