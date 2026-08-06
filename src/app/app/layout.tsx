/**
 * MODULE: Application shell
 *
 * Purpose        The frame every signed-in page renders inside.
 * Responsibility Session lookup, role-aware navigation, sign-out.
 * Dependencies   session, rbac-free (navigation is cosmetic; each page still
 *                authorises its own data).
 *
 * The navigation shown here is a convenience, not a control. Hiding a link does
 * not protect the route behind it — that is `rbac.ts`'s job, enforced on every
 * data access.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
  UserCheck,
} from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { ROLE, type Role } from "@/domain/enums";
import { logoutAction } from "@/app/(auth)/login/actions";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Users;
  roles: Role[];
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/app/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: [ROLE.OWNER],
  },
  {
    href: "/app/batches",
    label: "My batches",
    icon: UserCheck,
    roles: [ROLE.OWNER, ROLE.TEACHER],
  },
  {
    href: "/app/children",
    label: "My children",
    icon: Users,
    roles: [ROLE.PARENT],
  },
  {
    href: "/app/admin/staff",
    label: "Manage",
    icon: Settings,
    roles: [ROLE.OWNER],
  },
];

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();

  // Middleware normally catches this; re-checking here covers the case where a
  // session expires between the middleware check and the render.
  if (!session) redirect("/login");

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(session.role));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-hairline bg-brand-900">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-3 py-2.5">
          <Link href="/app" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-white/15">
              <GraduationCap size={18} color="#fff" aria-hidden="true" />
            </div>
            <span className="font-display text-base font-bold text-white">EduTrack</span>
          </Link>

          <nav aria-label="Main" className="ml-2 flex flex-1 items-center gap-1">
            {visibleItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                <item.icon size={14} aria-hidden="true" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            ))}
          </nav>

          <Link
            href="/app/settings"
            className="hidden text-[12px] text-white/70 transition-colors hover:text-white sm:inline"
          >
            {session.fullName}
          </Link>

          <form action={logoutAction}>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12.5px] font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut size={14} aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </form>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-3 py-4">
        {children}
      </main>
    </div>
  );
}
