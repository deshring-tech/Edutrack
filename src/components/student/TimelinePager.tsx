/**
 * MODULE: Timeline pager
 *
 * Purpose        Reach a student's older history.
 * Responsibility Renders two links. No state, no client JavaScript.
 * Dependencies   next/link.
 *
 * WHY LINKS RATHER THAN AN INFINITE SCROLL
 *  A parent opening a child's record wants the newest updates, which is what
 *  they land on. Older entries are occasional lookups — "what did the tutor say
 *  in July?" — so plain paging is honest, works without JavaScript, and is
 *  linkable. Before this existed, anything past the newest 50 entries simply
 *  could not be reached, which quietly broke the product's promise to keep a
 *  child's full record.
 */

import Link from "next/link";
import { ArrowLeft, ArrowUp } from "lucide-react";
import type { TimelinePage } from "@/server/services/student.service";

interface TimelinePagerProps {
  page: TimelinePage;
  /** Route the links point at, e.g. `/app/children/abc123`. */
  basePath: string;
}

export function TimelinePager({ page, basePath }: TimelinePagerProps) {
  if (!page.olderCursor && !page.isHistoric) return null;

  return (
    <nav
      aria-label="Timeline history"
      className="flex flex-wrap items-center justify-between gap-2 pt-2"
    >
      {page.olderCursor ? (
        <Link
          href={`${basePath}?before=${encodeURIComponent(page.olderCursor)}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink hover:shadow-sm"
        >
          <ArrowUp size={14} aria-hidden="true" />
          Show older updates
        </Link>
      ) : (
        <span className="text-[12px] text-gray-400">
          That is the beginning of this record.
        </span>
      )}

      {page.isHistoric && (
        <Link
          href={basePath}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-700 hover:underline"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to latest
        </Link>
      )}
    </nav>
  );
}
