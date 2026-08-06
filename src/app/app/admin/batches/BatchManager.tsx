"use client";

/**
 * MODULE: Batch management
 *
 * Purpose        Create batches and route to their roster editor.
 * Responsibility Presentation and pending state.
 */

import { useActionState, useRef } from "react";
import Link from "next/link";
import { ChevronRight, Layers } from "lucide-react";
import { ActionBanner, SubmitButton } from "@/components/ui/Forms";
import { IDLE_ACTION_STATE } from "@/server/action-result";
import { formatPercent } from "@/domain/metrics";
import type { BatchSummary } from "@/server/services/batch.service";
import type { TeacherOption } from "@/server/services/admin.service";
import { createBatchAction } from "../actions";

interface BatchManagerProps {
  batches: BatchSummary[];
  teachers: TeacherOption[];
}

export function BatchManager({ batches, teachers }: BatchManagerProps) {
  const [state, submit] = useActionState(createBatchAction, IDLE_ACTION_STATE);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Layers size={16} className="text-brand-700" aria-hidden="true" />
          <h2 className="font-semibold text-ink">Create a batch</h2>
        </div>

        <form
          ref={formRef}
          action={async (formData) => {
            await submit(formData);
            formRef.current?.reset();
          }}
          className="space-y-2.5"
        >
          <div className="grid gap-2.5 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-semibold text-gray-500">Batch name</span>
              <input
                name="name"
                required
                maxLength={80}
                placeholder="Grade 7 Math"
                className="field-input mt-1"
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-semibold text-gray-500">Subject</span>
              <input
                name="subject"
                required
                maxLength={60}
                placeholder="Mathematics"
                className="field-input mt-1"
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-semibold text-gray-500">
                Short label
              </span>
              <input
                name="gradeLabel"
                required
                maxLength={20}
                placeholder="G7 Math"
                className="field-input mt-1"
              />
              <span className="mt-1 block text-[10.5px] text-gray-400">
                Used on the dashboard chart, so keep it short.
              </span>
            </label>

            <label className="block">
              <span className="text-[11px] font-semibold text-gray-500">Teacher</span>
              <select name="teacherId" required defaultValue="" className="field-input mt-1">
                <option value="" disabled>
                  Choose a teacher
                </option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.fullName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <ActionBanner state={state} />
          <SubmitButton>Create batch</SubmitButton>
        </form>
      </section>

      <section className="card p-4">
        <h2 className="mb-3 font-semibold text-ink">
          Batches <span className="font-normal text-gray-400">({batches.length})</span>
        </h2>

        {batches.length === 0 ? (
          <p className="text-[13px] text-gray-500">
            No batches yet. Create one above, then add students to it.
          </p>
        ) : (
          <ul>
            {batches.map((batch) => (
              <li key={batch.id} className="border-t border-[#f2f2f2] first:border-0">
                <Link
                  href={`/app/admin/batches/${batch.id}`}
                  className="flex items-center gap-3 py-2.5"
                >
                  <span
                    className="size-8 shrink-0 rounded-lg"
                    style={{ background: batch.colorHex }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium text-ink">
                      {batch.name}
                    </span>
                    <span className="block truncate text-[11.5px] text-gray-500">
                      {batch.teacherName} · {batch.studentCount}{" "}
                      {batch.studentCount === 1 ? "student" : "students"} · attendance{" "}
                      {formatPercent(batch.attendancePercent)}
                    </span>
                  </span>
                  <span className="text-[12px] font-semibold text-brand-700">
                    Edit roster
                  </span>
                  <ChevronRight size={18} className="text-gray-300" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
