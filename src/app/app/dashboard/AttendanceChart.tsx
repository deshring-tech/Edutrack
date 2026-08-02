"use client";

/**
 * MODULE: Attendance chart
 *
 * Purpose        Show attendance per batch so an owner spots the outlier class
 *                without reading the table.
 * Responsibility Rendering only; the data arrives already aggregated.
 * Dependencies   recharts.
 *
 * Bars are coloured by the same health thresholds used everywhere else, and the
 * table beside it carries the same numbers as text — the chart is never the
 * only way to get the information.
 */

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RiskLevel } from "@/domain/risk";

const HEALTH_COLOR: Record<RiskLevel, string> = {
  ON_TRACK: "#43a047",
  WATCH: "#fb8c00",
  AT_RISK: "#e53935",
};

export interface ChartDatum {
  name: string;
  attendance: number;
  health: RiskLevel;
}

export function AttendanceChart({ data }: { data: ChartDatum[] }) {
  if (data.length === 0) return null;

  return (
    <div style={{ width: "100%", height: 160 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "#888" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: "#aaa" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgb(0 0 0 / 0.03)" }}
            contentStyle={{ borderRadius: 10, fontSize: 12, border: "1px solid #eee" }}
            formatter={(value: number) => [`${value}%`, "Attendance"]}
          />
          <Bar dataKey="attendance" radius={[6, 6, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={HEALTH_COLOR[entry.health]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
