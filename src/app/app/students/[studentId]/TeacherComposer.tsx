"use client";

/**
 * MODULE: Teacher composer
 *
 * Purpose        Send a private note about one child, or record an engagement
 *                observation.
 * Responsibility Presentation and pending state.
 *
 * Engagement offers a positive and a negative option with equal weight. A
 * control that can only praise produces a number that always rises and
 * therefore says nothing — which is what the prototype's "+Engagement" button
 * did.
 */

import { useActionState, useRef } from "react";
import { Send, StickyNote, ThumbsDown, ThumbsUp } from "lucide-react";
import { FormError, SubmitButton } from "@/components/ui/Forms";
import { IDLE_ACTION_STATE } from "@/server/action-result";
import { logEngagementAction, postNoteAction } from "@/server/actions/student.actions";

const ENGAGEMENT_STEP = 6;

export function TeacherComposer({ studentId }: { studentId: string }) {
  const [noteState, submitNote] = useActionState(postNoteAction, IDLE_ACTION_STATE);
  const [engagementState, submitEngagement] = useActionState(
    logEngagementAction,
    IDLE_ACTION_STATE,
  );
  const noteFormRef = useRef<HTMLFormElement>(null);

  return (
    <section className="card space-y-3 p-4">
      <h2 className="font-semibold text-ink">Post an update</h2>

      <form
        ref={noteFormRef}
        action={async (formData) => {
          await submitNote(formData);
          noteFormRef.current?.reset();
        }}
        className="space-y-2"
      >
        <input type="hidden" name="studentId" value={studentId} />
        <label className="flex items-center gap-2 rounded-full border border-hairline bg-white px-3 py-2">
          <StickyNote
            size={16}
            className="shrink-0 text-[color:var(--color-kind-note)]"
            aria-hidden="true"
          />
          <span className="sr-only">Note to the parent</span>
          <input
            name="body"
            required
            maxLength={1000}
            placeholder="Write a note to the parent…"
            className="flex-1 bg-transparent text-sm text-ink outline-none"
          />
        </label>

        {noteState.status === "success" && (
          <p role="status" className="text-[12px] font-medium text-brand-700">
            {noteState.message}
          </p>
        )}
        {noteState.status === "error" && <FormError message={noteState.message} />}

        <SubmitButton className="w-full" pendingLabel="Sending…">
          <Send size={15} aria-hidden="true" /> Send to parent
        </SubmitButton>
      </form>

      <div className="border-t border-hairline pt-3">
        <p className="mb-2 text-[12px] font-semibold text-gray-500">
          Class engagement today
        </p>

        <div className="flex gap-2">
          <form action={submitEngagement} className="flex-1">
            <input type="hidden" name="studentId" value={studentId} />
            <input type="hidden" name="delta" value={ENGAGEMENT_STEP} />
            <SubmitButton variant="secondary" className="w-full" pendingLabel="Saving…">
              <ThumbsUp size={15} aria-hidden="true" /> Engaged
            </SubmitButton>
          </form>

          <form action={submitEngagement} className="flex-1">
            <input type="hidden" name="studentId" value={studentId} />
            <input type="hidden" name="delta" value={-ENGAGEMENT_STEP} />
            <SubmitButton variant="secondary" className="w-full" pendingLabel="Saving…">
              <ThumbsDown size={15} aria-hidden="true" /> Distracted
            </SubmitButton>
          </form>
        </div>

        {engagementState.status === "success" && (
          <p role="status" className="mt-2 text-[12px] font-medium text-brand-700">
            {engagementState.message}
          </p>
        )}
        {engagementState.status === "error" && (
          <div className="mt-2">
            <FormError message={engagementState.message} />
          </div>
        )}
      </div>
    </section>
  );
}
