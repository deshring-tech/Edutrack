"use client";

/**
 * MODULE: Acknowledge button
 *
 * Purpose        Let a parent confirm they have read one update.
 * Responsibility Submission and pending state.
 *
 * This is the product's only feedback loop. A centre that can see 38 of 47
 * updates were read knows its communication is working; without it, "we send
 * updates" is an assertion nobody can check.
 */

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { IDLE_ACTION_STATE } from "@/server/action-result";
import { acknowledgeEntryAction } from "@/server/actions/parent.actions";

export function AcknowledgeButton({ entryId }: { entryId: string }) {
  const [state, submit] = useActionState(acknowledgeEntryAction, IDLE_ACTION_STATE);

  if (state.status === "success") {
    return <span className="mr-auto text-[10px] text-brand-700">✓ Marked as read</span>;
  }

  return (
    <form action={submit} className="mr-auto">
      <input type="hidden" name="timelineEntryId" value={entryId} />
      <AcknowledgeSubmit />
      {state.status === "error" && (
        <span role="alert" className="ml-2 text-[10px] text-red-600">
          {state.message}
        </span>
      )}
    </form>
  );
}

function AcknowledgeSubmit() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 disabled:opacity-50"
    >
      {pending ? "Saving…" : "Acknowledge"}
    </button>
  );
}
