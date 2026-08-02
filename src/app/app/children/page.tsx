/**
 * MODULE: Children list (parent view)
 *
 * Purpose        A parent's home screen: my children and what is new.
 * Responsibility Authorised read and presentation.
 *
 * `listChildren` resolves the list from ParentLink rows, so a parent sees their
 * own children and nothing else. In the prototype this was a `mine` boolean on
 * a shared array, and switching tabs could show another family's child.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { loadPage } from "@/lib/page-guard";
import { listChildren } from "@/server/services/parent.service";
import { formatRelativeDay } from "@/domain/dates";
import { formatPercent } from "@/domain/metrics";
import { presentationFor } from "@/components/kinds";
import { Avatar } from "@/components/ui/Avatar";

export const metadata: Metadata = { title: "My children" };

export default async function ChildrenPage() {
  const session = await requireSession();
  const children = await loadPage(() => listChildren(session));

  return (
    <>
      <header className="mb-4">
        <h1 className="font-display text-xl font-bold text-ink">My children</h1>
        <p className="text-[13px] text-gray-500">
          Updates are posted by your tutor. Tap a child to see their full progress.
        </p>
      </header>

      {children.length === 0 ? (
        <div className="card p-8 text-center">
          <Users size={26} className="mx-auto mb-2 text-gray-300" aria-hidden="true" />
          <p className="text-[13.5px] text-gray-500">
            No children are linked to your account yet. Please contact your centre.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {children.map((child) => {
            const { icon: KindIcon, color } = presentationFor(child.lastEntryKind);

            return (
              <li key={child.id}>
                <Link
                  href={`/app/children/${child.id}`}
                  className="card flex items-center gap-3 p-4 transition-shadow hover:shadow-md"
                >
                  <Avatar name={child.fullName} color={child.avatarColor} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-semibold text-[15px] text-ink">
                        {child.fullName}
                      </span>
                      {child.lastEntryAt && (
                        <span className="shrink-0 text-[11px] text-gray-400">
                          {formatRelativeDay(child.lastEntryAt)}
                        </span>
                      )}
                    </div>

                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[12.5px] text-gray-500">
                        <KindIcon
                          size={12}
                          style={{ color }}
                          className="shrink-0"
                          aria-hidden="true"
                        />
                        <span className="truncate">
                          {child.lastEntryBody ?? "No updates yet"}
                        </span>
                      </span>

                      {child.unreadCount > 0 && (
                        <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[10px] font-bold text-white">
                          {child.unreadCount}
                          <span className="sr-only"> unread updates</span>
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 flex flex-wrap gap-3 text-[11.5px]">
                      <span style={{ color: "var(--color-kind-attendance)" }}>
                        Attendance {formatPercent(child.progress.attendance.ratePercent)}
                      </span>
                      <span style={{ color: "var(--color-kind-homework)" }}>
                        Homework {formatPercent(child.progress.homework.ratePercent)}
                      </span>
                      <span style={{ color: "var(--color-kind-engagement)" }}>
                        Engagement {child.progress.engagementLabel}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
