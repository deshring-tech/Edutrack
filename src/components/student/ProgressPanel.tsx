/**
 * MODULE: Progress panel
 *
 * Purpose        The at-a-glance summary at the top of a student's page.
 * Responsibility Presentation only. Every figure arrives pre-computed.
 * Dependencies   @/domain/metrics (formatting), UI primitives.
 *
 * Shown identically to staff and to parents. One rendering of a child's
 * progress means a parent and a tutor discussing it are looking at the same
 * numbers — which is the entire point of the product.
 */

import { Award, BookOpen, CalendarCheck, Star, TrendingUp } from "lucide-react";
import { formatPercent, type PeerComparison } from "@/domain/metrics";
import type { StudentProgress } from "@/server/services/progress.service";
import { Kpi, MetricBar, ProgressRing } from "@/components/ui/Metrics";
import { StatusPill } from "@/components/ui/Status";

const PEER_MESSAGE: Record<PeerComparison["standing"], { text: string; color: string; background: string }> = {
  AHEAD: {
    text: "Ahead of the batch pace",
    color: "#2e7d32",
    background: "#e8f5e9",
  },
  ON_PACE: {
    text: "Keeping pace with the batch",
    color: "#1565c0",
    background: "#e8f0fe",
  },
  BEHIND: {
    text: "Slightly behind — a gentle nudge helps",
    color: "#b26a00",
    background: "#fff4e5",
  },
};

interface ProgressPanelProps {
  progress: StudentProgress;
  homeworkVsBatch: PeerComparison | null;
  /** Parents see the peer comparison; staff see the risk reasons instead. */
  audience: "staff" | "parent";
}

export function ProgressPanel({
  progress,
  homeworkVsBatch,
  audience,
}: ProgressPanelProps) {
  const { attendance, homework } = progress;

  return (
    <section className="card p-4" aria-label="Progress summary">
      <div className="mb-3 flex items-center justify-around">
        <ProgressRing value={attendance.ratePercent} label="Attendance" />
        <ProgressRing value={homework.ratePercent} label="Homework" />
        <ProgressRing value={progress.engagement} label="Engagement" />
      </div>

      <MetricBar
        icon={CalendarCheck}
        label="Attendance"
        tint="var(--color-kind-attendance)"
        value={attendance.ratePercent}
        detail={
          attendance.assessable === 0
            ? "No sessions yet"
            : `${attendance.present + attendance.late}/${attendance.assessable} sessions`
        }
      />

      <MetricBar
        icon={BookOpen}
        label="Homework done"
        tint="var(--color-kind-homework)"
        value={homework.ratePercent}
        detail={homework.total === 0 ? "Nothing recorded yet" : `${homework.done}/${homework.total}`}
      />

      <MetricBar
        icon={Star}
        label="Class engagement"
        tint="var(--color-kind-engagement)"
        value={progress.engagement}
        detail={progress.engagementLabel}
      />

      {progress.assessmentCount > 0 && (
        <MetricBar
          icon={Award}
          label={`Test average (${progress.assessmentCount})`}
          tint="var(--color-kind-assessment)"
          value={progress.assessmentAveragePercent}
          detail={formatPercent(progress.assessmentAveragePercent)}
        />
      )}

      {audience === "parent" && homeworkVsBatch && (
        <div
          className="mt-3 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2"
          style={{ background: PEER_MESSAGE[homeworkVsBatch.standing].background }}
        >
          <TrendingUp
            size={15}
            style={{ color: PEER_MESSAGE[homeworkVsBatch.standing].color }}
            aria-hidden="true"
          />
          <span
            className="text-[12px] font-semibold"
            style={{ color: PEER_MESSAGE[homeworkVsBatch.standing].color }}
          >
            {PEER_MESSAGE[homeworkVsBatch.standing].text}
          </span>
          <span className="ml-auto text-[11px] text-gray-500">
            your child {homeworkVsBatch.studentPercent}% · batch{" "}
            {homeworkVsBatch.batchPercent}%
          </span>
        </div>
      )}

      {audience === "staff" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusPill level={progress.risk.level} />
          {progress.risk.reasons.map((reason) => (
            <span
              key={reason.code}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600"
            >
              {reason.message}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

/** Compact KPI row used above a parent's list of children. */
export function ProgressKpiRow({ progress }: { progress: StudentProgress }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Kpi
        icon={CalendarCheck}
        label="Attendance"
        value={formatPercent(progress.attendance.ratePercent)}
        detail={`${progress.attendance.assessable} sessions`}
        tint="var(--color-kind-attendance)"
      />
      <Kpi
        icon={BookOpen}
        label="Homework"
        value={formatPercent(progress.homework.ratePercent)}
        detail={`${progress.homework.total} recorded`}
        tint="var(--color-kind-homework)"
      />
      <Kpi
        icon={Star}
        label="Engagement"
        value={String(progress.engagement)}
        detail={progress.engagementLabel}
        tint="var(--color-kind-engagement)"
      />
      <Kpi
        icon={Award}
        label="Test average"
        value={formatPercent(progress.assessmentAveragePercent)}
        detail={`${progress.assessmentCount} recorded`}
        tint="var(--color-kind-assessment)"
      />
    </div>
  );
}
