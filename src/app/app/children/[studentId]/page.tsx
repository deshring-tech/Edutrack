/**
 * MODULE: Child page (parent view)
 *
 * Purpose        One child's progress and full timeline, for their parent.
 * Responsibility Authorised read and composition.
 *
 * This uses the same `getStudentProfile` as the staff view. The difference is
 * the audience prop — which changes what is emphasised, not what is permitted.
 * Permission is settled inside the service by `requireStudentAccess`, which for
 * a parent requires a ParentLink row joining them to this child.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { requireParent } from "@/lib/auth/rbac";
import { loadPage } from "@/lib/page-guard";
import { getStudentProfile } from "@/server/services/student.service";
import { Avatar } from "@/components/ui/Avatar";
import { ProgressPanel } from "@/components/student/ProgressPanel";
import { Timeline } from "@/components/student/Timeline";
import { AcknowledgeAllButton } from "./AcknowledgeAllButton";

export const metadata: Metadata = { title: "My child" };

interface ChildPageProps {
  params: Promise<{ studentId: string }>;
}

export default async function ChildPage({ params }: ChildPageProps) {
  const { studentId } = await params;
  const session = await requireSession();

  // A student who is not this parent's child resolves to the not-found page,
  // never to an error screen and never to another family's record.
  const profile = await loadPage(async () => {
    requireParent(session);
    return getStudentProfile(session, studentId);
  });

  return (
    <>
      <header className="mb-3 flex items-center gap-2">
        <Link
          href="/app/children"
          aria-label="Back to my children"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </Link>
        <Avatar name={profile.fullName} color={profile.avatarColor} size={40} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-bold text-ink">{profile.fullName}</h1>
          <p className="truncate text-[12.5px] text-gray-500">
            {profile.batchName ?? "No batch yet"}
          </p>
        </div>
        <AcknowledgeAllButton
          studentId={profile.id}
          unreadCount={profile.unacknowledgedCount}
        />
      </header>

      <div className="grid gap-3 md:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-3">
          <ProgressPanel
            progress={profile.progress}
            homeworkVsBatch={profile.homeworkVsBatch}
            audience="parent"
          />

          <p className="flex items-start gap-2 rounded-xl bg-panel px-3 py-2.5 text-[12px] text-gray-600">
            <ShieldCheck
              size={15}
              className="mt-0.5 shrink-0 text-brand-700"
              aria-hidden="true"
            />
            Updates are posted by your child&apos;s tutor. Acknowledging one lets the
            centre know you have seen it.
          </p>
        </div>

        <Timeline entries={profile.timeline} audience="parent" />
      </div>
    </>
  );
}
