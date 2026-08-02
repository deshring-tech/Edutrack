"use client";

/**
 * MODULE: Acknowledge-all button
 *
 * Purpose        Clear a child's unread updates in one tap.
 * Responsibility Submission and pending state.
 *
 * A parent opening the app after a week should not have to tap twelve times to
 * clear a badge. Per-entry acknowledgement still exists for anything they want
 * to confirm individually.
 */

import { useActionState } from "react";
import { CheckCheck } from "lucide-react";
import { SubmitButton } from "@/components/ui/Forms";
import { IDLE_ACTION_STATE } from "@/server/action-result";
import { acknowledgeAllAction } from "@/server/actions/parent.actions";

interface AcknowledgeAllButtonProps {
  studentId: string;
  unreadCount: number;
}

export function AcknowledgeAllButton({
  studentId,
  unreadCount,
}: AcknowledgeAllButtonProps) {
  const [state, submit] = useActionState(acknowledgeAllAction, IDLE_ACTION_STATE);

  if (unreadCount === 0 && state.status !== "success") return null;

  if (state.status === "success") {
    return (
      <p role="status" className="text-[12px] font-medium text-brand-700">
        {state.message}
      </p>
    );
  }

  return (
    <form action={submit}>
      <input type="hidden" name="studentId" value={studentId} />
      <SubmitButton variant="secondary" pendingLabel="Marking…">
        <CheckCheck size={15} aria-hidden="true" /> Mark {unreadCount} as read
      </SubmitButton>
    </form>
  );
}
