/**
 * MODULE: Administration layout
 *
 * Purpose        Frame the owner-only administration screens.
 * Responsibility Section navigation and the role gate for everything beneath it.
 *
 * The gate here is convenience, not the boundary: every function in
 * `admin.service.ts` calls `requireOwner` itself. This layout exists so a
 * teacher who follows a stale link sees "not found" instead of a half-rendered
 * page that errors when its data loads.
 */

import Link from "next/link";
import { GraduationCap, Layers, Users } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { requireOwner } from "@/lib/auth/rbac";
import { loadPage } from "@/lib/page-guard";

const SECTIONS = [
  { href: "/app/admin/staff", label: "Staff", icon: GraduationCap },
  { href: "/app/admin/students", label: "Students", icon: Users },
  { href: "/app/admin/batches", label: "Batches", icon: Layers },
];

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSession();
  await loadPage(async () => requireOwner(session));

  return (
    <>
      <nav
        aria-label="Administration"
        className="mb-4 flex flex-wrap gap-1 rounded-full bg-panel p-1"
      >
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-semibold text-gray-600 transition-colors hover:bg-white hover:text-ink"
          >
            <section.icon size={14} aria-hidden="true" />
            {section.label}
          </Link>
        ))}
      </nav>

      {children}
    </>
  );
}
