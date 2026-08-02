/**
 * MODULE: Timeline kind presentation
 *
 * Purpose        Map each timeline kind to its icon, label and colour, once.
 * Responsibility Presentation metadata only.
 * Dependencies   lucide-react, @/domain/enums.
 *
 * The record is exhaustive over `TimelineKind`, so adding a kind to the domain
 * produces a compile error here rather than a silently unstyled entry.
 */

import {
  Award,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  Star,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import { TIMELINE_KIND, type TimelineKind } from "@/domain/enums";

export interface KindPresentation {
  icon: LucideIcon;
  label: string;
  color: string;
}

export const KIND_PRESENTATION: Record<TimelineKind, KindPresentation> = {
  [TIMELINE_KIND.ATTENDANCE]: {
    icon: CalendarCheck,
    label: "Attendance",
    color: "var(--color-kind-attendance)",
  },
  [TIMELINE_KIND.HOMEWORK]: {
    icon: BookOpen,
    label: "Homework",
    color: "var(--color-kind-homework)",
  },
  [TIMELINE_KIND.ASSIGNMENT]: {
    icon: ClipboardList,
    label: "Assignment",
    color: "var(--color-kind-assignment)",
  },
  [TIMELINE_KIND.ASSESSMENT]: {
    icon: Award,
    label: "Test result",
    color: "var(--color-kind-assessment)",
  },
  [TIMELINE_KIND.ENGAGEMENT]: {
    icon: Star,
    label: "Engagement",
    color: "var(--color-kind-engagement)",
  },
  [TIMELINE_KIND.NOTE]: {
    icon: StickyNote,
    label: "Note",
    color: "var(--color-kind-note)",
  },
};

export function presentationFor(kind: TimelineKind | null): KindPresentation {
  return kind
    ? KIND_PRESENTATION[kind]
    : KIND_PRESENTATION[TIMELINE_KIND.NOTE];
}
