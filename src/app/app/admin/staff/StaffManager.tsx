"use client";

/**
 * MODULE: Staff management
 *
 * Purpose        Add teachers and control who can sign in.
 * Responsibility Presentation and pending state. Authorisation and validation
 *                are server-side.
 */

import { useActionState, useRef } from "react";
import { UserPlus } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { ActionBanner, SubmitButton } from "@/components/ui/Forms";
import { IDLE_ACTION_STATE } from "@/server/action-result";
import { ROLE } from "@/domain/enums";
import type { StaffMember } from "@/server/services/admin.service";
import { createStaffAction, setStaffActiveAction } from "../actions";

export function StaffManager({ staff }: { staff: StaffMember[] }) {
  const [createState, submitCreate] = useActionState(
    createStaffAction,
    IDLE_ACTION_STATE,
  );
  const [toggleState, submitToggle] = useActionState(
    setStaffActiveAction,
    IDLE_ACTION_STATE,
  );
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <div className="mb-3 flex items-center gap-2">
          <UserPlus size={16} className="text-brand-700" aria-hidden="true" />
          <h2 className="font-semibold text-ink">Add a teacher</h2>
        </div>

        <form
          ref={formRef}
          action={async (formData) => {
            await submitCreate(formData);
            formRef.current?.reset();
          }}
          className="space-y-2.5"
        >
          <div className="grid gap-2.5 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-semibold text-gray-500">Full name</span>
              <input
                name="fullName"
                required
                maxLength={120}
                placeholder="Sunita Rao"
                className="field-input mt-1"
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-semibold text-gray-500">Email</span>
              <input
                name="email"
                type="email"
                required
                placeholder="rao@yourcentre.in"
                className="field-input mt-1"
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-semibold text-gray-500">
                Phone (optional)
              </span>
              <input name="phone" maxLength={20} className="field-input mt-1" />
            </label>

            <label className="block">
              <span className="text-[11px] font-semibold text-gray-500">Role</span>
              <select name="role" defaultValue={ROLE.TEACHER} className="field-input mt-1">
                <option value={ROLE.TEACHER}>Teacher — logs their own batches</option>
                <option value={ROLE.OWNER}>Owner — full access to the centre</option>
              </select>
            </label>
          </div>

          <p className="text-[11px] text-gray-400">
            A temporary password is generated and shown once. Share it with them; they
            can change it under Settings.
          </p>

          <ActionBanner state={createState} />
          <SubmitButton>Create account</SubmitButton>
        </form>
      </section>

      <section className="card p-4">
        <h2 className="mb-3 font-semibold text-ink">
          Staff <span className="font-normal text-gray-400">({staff.length})</span>
        </h2>

        <ActionBanner state={toggleState} />

        <ul className="mt-2">
          {staff.map((member) => (
            <li
              key={member.id}
              className="flex flex-wrap items-center gap-3 border-t border-[#f2f2f2] py-2.5 first:border-0"
            >
              <Avatar name={member.fullName} color={member.avatarColor} size={34} />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13.5px] font-medium text-ink">
                    {member.fullName}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10.5px] font-semibold text-gray-600">
                    {member.role === ROLE.OWNER ? "Owner" : "Teacher"}
                  </span>
                  {!member.isActive && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10.5px] font-semibold text-red-600">
                      Deactivated
                    </span>
                  )}
                </div>
                <div className="truncate text-[11.5px] text-gray-500">
                  {member.email} · {member.batchCount}{" "}
                  {member.batchCount === 1 ? "batch" : "batches"}
                  {member.lastLoginAt ? "" : " · never signed in"}
                </div>
              </div>

              <form action={submitToggle}>
                <input type="hidden" name="userId" value={member.id} />
                <input
                  type="hidden"
                  name="isActive"
                  value={member.isActive ? "false" : "true"}
                />
                <SubmitButton variant="secondary" pendingLabel="Saving…">
                  {member.isActive ? "Deactivate" : "Reactivate"}
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
