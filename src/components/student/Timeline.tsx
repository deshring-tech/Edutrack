/**
 * MODULE: Student timeline
 *
 * Purpose        Render a child's progress feed as a readable thread.
 * Responsibility Presentation. Acknowledgement is delegated to a client button.
 * Dependencies   @/domain/dates, kind presentation, AcknowledgeButton.
 *
 * The chat metaphor is deliberate: the parents this product serves already read
 * their child's school updates in a WhatsApp group. Matching that shape means
 * the app needs no explaining — which is what makes it get read at all.
 */

import { formatEntryTimestamp } from "@/domain/dates";
import type { TimelineKind } from "@/domain/enums";
import { presentationFor } from "@/components/kinds";
import { AcknowledgeButton } from "./AcknowledgeButton";

export interface TimelineEntryView {
  id: string;
  kind: TimelineKind;
  body: string;
  occurredAt: Date;
  authorName: string;
  acknowledgedAt: Date | null;
}

interface TimelineProps {
  entries: TimelineEntryView[];
  /** Parents can acknowledge; staff see whether the parent has. */
  audience: "staff" | "parent";
}

export function Timeline({ entries, audience }: TimelineProps) {
  if (entries.length === 0) {
    return (
      <div className="chat-surface rounded-2xl px-4 py-10 text-center text-[13px] text-gray-500">
        No updates yet. They will appear here as soon as a teacher logs something.
      </div>
    );
  }

  return (
    <ol className="chat-surface space-y-2 rounded-2xl px-3 py-4">
      {entries.map((entry) => {
        const { icon: Icon, label, color } = presentationFor(entry.kind);
        const isFromStaff = audience === "staff";

        return (
          <li key={entry.id} className={`flex ${isFromStaff ? "justify-end" : "justify-start"}`}>
            <article
              className="max-w-[85%] rounded-xl px-3 py-2 shadow-sm"
              style={{ background: isFromStaff ? "var(--color-bubble)" : "#fff" }}
            >
              <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                <Icon size={12} style={{ color }} aria-hidden="true" />
                <span className="text-[10.5px] font-bold" style={{ color }}>
                  {label}
                </span>
                <span className="text-[10px] text-gray-400">· {entry.authorName}</span>
              </div>

              <p className="text-[13.5px] leading-snug text-gray-800">{entry.body}</p>

              <div className="mt-1 flex items-center justify-end gap-2">
                {audience === "parent" && !entry.acknowledgedAt && (
                  <AcknowledgeButton entryId={entry.id} />
                )}
                {entry.acknowledgedAt && (
                  <span className="mr-auto text-[10px] text-brand-700">
                    ✓ Seen by parent
                  </span>
                )}
                <time
                  dateTime={entry.occurredAt.toISOString()}
                  className="text-[10px] text-gray-400"
                >
                  {formatEntryTimestamp(entry.occurredAt)}
                </time>
              </div>
            </article>
          </li>
        );
      })}
    </ol>
  );
}
