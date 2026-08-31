/**
 * MODULE: Student page (staff view)
 *
 * Purpose        One child's full record, for a teacher or centre owner.
 * Responsibility Authorised read and composition.
 *
 * Access is decided by `getStudentProfile` → `requireStudentAccess`. A teacher
 * reaching this URL for a student outside their centre gets "not found",
 * whether or not that student exists.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { requireStaff } from "@/lib/auth/rbac";
import { loadPage } from "@/lib/page-guard";
import { getStudentProfile } from "@/server/services/student.service";
import { Avatar } from "@/components/ui/Avatar";
import { ProgressPanel } from "@/components/student/ProgressPanel";
import { Timeline } from "@/components/student/Timeline";
import { TimelinePager } from "@/components/student/TimelinePager";
import { TeacherComposer } from "./TeacherComposer";

export const metadata: Metadata = { title: "Student" };

interface StudentPageProps {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ before?: string }>;
}

export default async function StudentPage({
  params,
  searchParams,
}: StudentPageProps) {
  const { studentId } = await params;
  const { before } = await searchParams;
  const session = await requireSession();

  const profile = await loadPage(async () => {
    requireStaff(session);
    return getStudentProfile(session, studentId, { before });
  });

  return (
    <>
      <header className="mb-3 flex items-center gap-2">
        <Link
          href={profile.batchId ? `/app/batches/${profile.batchId}` : "/app/batches"}
          aria-label="Back"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </Link>
        <Avatar name={profile.fullName} color={profile.avatarColor} size={40} />
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold text-ink">{profile.fullName}</h1>
          <p className="truncate text-[12.5px] text-gray-500">
            {profile.batchName ?? "No batch"}
            {profile.guardianNames.length > 0 && ` · guardian: ${profile.guardianNames.join(", ")}`}
          </p>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <Timeline entries={profile.timeline.items} audience="staff" />
          <TimelinePager
            page={profile.timeline}
            basePath={`/app/students/${profile.id}`}
          />
        </div>

        <div className="space-y-3">
          <ProgressPanel
            progress={profile.progress}
            homeworkVsBatch={profile.homeworkVsBatch}
            audience="staff"
          />
          <TeacherComposer studentId={profile.id} />
        </div>
      </div>
    </>
  );
}
