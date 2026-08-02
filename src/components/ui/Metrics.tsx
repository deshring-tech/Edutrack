/**
 * MODULE: Metric display primitives
 *
 * Purpose        Render a percentage consistently everywhere it appears.
 * Responsibility Presentation only. Every value arrives already computed by
 *                `@/domain/metrics`; nothing here does arithmetic.
 *
 * NULL IS NOT ZERO
 *  Each component accepts `number | null` and renders "—" for null. A child
 *  with no attendance recorded yet must never be shown as 0% — that reads to a
 *  parent as "my child attended nothing".
 */

import type { LucideIcon } from "lucide-react";
import { formatPercent } from "@/domain/metrics";

function trackColor(value: number): string {
  if (value >= 75) return "var(--color-status-ontrack)";
  if (value >= 50) return "var(--color-status-watch)";
  return "var(--color-status-risk)";
}

interface ProgressRingProps {
  value: number | null;
  label: string;
  size?: number;
}

export function ProgressRing({ value, label, size = 56 }: ProgressRingProps) {
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = value ?? 0;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        width={size}
        height={size}
        role="img"
        aria-label={`${label}: ${formatPercent(value)}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e6e2da"
          strokeWidth={stroke}
        />
        {value !== null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={trackColor(filled)}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (circumference * filled) / 100}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
        <text
          x="50%"
          y="52%"
          dominantBaseline="middle"
          textAnchor="middle"
          fontSize={size * 0.26}
          fontWeight={700}
          fill="var(--color-ink)"
        >
          {value === null ? "—" : value}
        </text>
      </svg>
      <span className="text-[11px] text-gray-500">{label}</span>
    </div>
  );
}

interface MetricBarProps {
  icon: LucideIcon;
  label: string;
  value: number | null;
  detail: string;
  tint: string;
}

export function MetricBar({ icon: Icon, label, value, detail, tint }: MetricBarProps) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div
        className="flex size-8 shrink-0 items-center justify-center rounded-full"
        style={{ background: `color-mix(in srgb, ${tint} 14%, transparent)` }}
      >
        <Icon size={16} style={{ color: tint }} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[13px] font-medium text-gray-700">{label}</span>
          <span className="text-[13px] font-semibold text-gray-800">{detail}</span>
        </div>
        <div
          className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#e6e2da]"
          role="progressbar"
          aria-label={label}
          aria-valuenow={value ?? undefined}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full"
            style={{ width: `${value ?? 0}%`, background: tint }}
          />
        </div>
      </div>
    </div>
  );
}

interface KpiProps {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tint: string;
}

export function Kpi({ icon: Icon, label, value, detail, tint }: KpiProps) {
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium text-gray-500">{label}</span>
        <div
          className="flex size-8 items-center justify-center rounded-lg"
          style={{ background: `color-mix(in srgb, ${tint} 12%, transparent)` }}
        >
          <Icon size={16} style={{ color: tint }} aria-hidden="true" />
        </div>
      </div>
      <div className="font-display text-3xl font-bold text-ink">{value}</div>
      <div className="mt-0.5 text-[11.5px] text-gray-400">{detail}</div>
    </div>
  );
}
