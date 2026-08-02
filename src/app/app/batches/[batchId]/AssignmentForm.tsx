"use client";

/**
 * MODULE: Assignment form
 *
 * Purpose        Publish one assignment to every student in a batch.
 * Responsibility Presentation and pending state only.
 *
 * Attachments are recorded by filename rather than uploaded. File storage for
 * a batch of minors needs a retention policy, virus scanning and a signed-URL
 * scheme — worth building, but not worth pretending to have. The field is
 * honest about what it does until that work is done.
 */

import { useActionState, useState } from "react";
import { ClipboardList } from "lucide-react";
import { FormError, SubmitButton } from "@/components/ui/Forms";
import { IDLE_ACTION_STATE } from "@/server/action-result";
import { postAssignmentAction } from "./actions";

export function AssignmentForm({ batchId }: { batchId: string }) {
  const [state, submit] = useActionState(postAssignmentAction, IDLE_ACTION_STATE);
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="card flex w-full items-center gap-2 p-3 text-[13.5px] font-semibold text-[color:var(--color-kind-assignment)] hover:shadow-md"
      >
        <ClipboardList size={16} aria-hidden="true" />
        Post an assignment to this batch
      </button>
    );
  }

  return (
    <form action={submit} className="card space-y-2.5 p-4">
      <div className="flex items-center gap-2">
        <ClipboardList
          size={16}
          className="text-[color:var(--color-kind-assignment)]"
          aria-hidden="true"
        />
        <h2 className="font-semibold text-ink">New assignment</h2>
      </div>

      <input type="hidden" name="batchId" value={batchId} />

      <label className="block">
        <span className="text-[11px] font-semibold text-gray-500">Title</span>
        <input
          name="title"
          required
          maxLength={120}
          autoFocus
          placeholder="e.g. Algebra worksheet — Ch. 4"
          className="field-input mt-1"
        />
      </label>

      <div className="flex gap-2">
        <label className="flex-1">
          <span className="text-[11px] font-semibold text-gray-500">Due date</span>
          <input type="date" name="dueDate" className="field-input mt-1" />
        </label>
        <label className="flex-1">
          <span className="text-[11px] font-semibold text-gray-500">Attachment name</span>
          <input
            name="attachmentName"
            maxLength={120}
            placeholder="worksheet_ch4.pdf"
            className="field-input mt-1"
          />
        </label>
      </div>

      {state.status === "success" && (
        <p role="status" className="rounded-lg bg-brand-100 px-3 py-2 text-[12.5px] font-medium text-[color:var(--color-status-ontrack)]">
          {state.message}
        </p>
      )}
      {state.status === "error" && <FormError message={state.message} />}

      <div className="flex gap-2">
        <SubmitButton className="flex-1">Post to every student</SubmitButton>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-100"
        >
          Close
        </button>
      </div>
    </form>
  );
}
