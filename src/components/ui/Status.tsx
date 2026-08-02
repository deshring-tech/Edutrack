/**
 * MODULE: Status presentation
 *
 * Purpose        Render risk levels and timeline kinds consistently.
 * Responsibility Presentation only.
 *
 * ACCESSIBILITY
 *  Every pill carries a text label, never colour alone. Roughly 1 in 12 men
 *  cannot reliably distinguish the green/amber/red used here, and "who needs
 *  attention" is exactly the information they must not miss.
 */

import { RISK_LABEL, type RiskLevel } from "@/domain/risk";
import { presentationFor } from "@/components/kinds";
import type { TimelineKind } from "@/domain/enums";

const RISK_COLOR: Record<RiskLevel, string> = {
  ON_TRACK: "var(--color-status-ontrack)",
  WATCH: "var(--color-status-watch)",
  AT_RISK: "var(--color-status-risk)",
};

export function StatusPill({ level }: { level: RiskLevel }) {
  const color = RISK_COLOR[level];

  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
      }}
    >
      {RISK_LABEL[level]}
    </span>
  );
}

export function KindBadge({ kind }: { kind: TimelineKind }) {
  const { icon: Icon, label, color } = presentationFor(kind);

  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon size={12} style={{ color }} aria-hidden="true" />
      <span className="text-[10.5px] font-bold" style={{ color }}>
        {label}
      </span>
    </span>
  );
}
