/**
 * MODULE: Marketing layout
 *
 * Purpose        Shell for the public, signed-out pages.
 * Responsibility Header, footer and the route into the app.
 */

import Link from "next/link";
import { GraduationCap } from "lucide-react";

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-hairline bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-brand-900">
              <GraduationCap size={18} color="#fff" aria-hidden="true" />
            </div>
            <span className="font-display text-lg font-bold text-ink">EduTrack</span>
          </Link>

          <nav aria-label="Main" className="ml-auto flex items-center gap-1">
            <Link
              href="/plans"
              className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-gray-600 hover:bg-gray-100"
            >
              Plans
            </Link>
            <Link
              href="/login"
              className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-gray-600 hover:bg-gray-100"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-brand-900 px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-brand-800"
            >
              Create centre
            </Link>
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-hairline bg-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 text-[12px] text-gray-500">
          <p>
            EduTrack — student progress tracking for tuition centres. Built for teachers
            who have thirty seconds, and parents who read one message.
          </p>
          <p className="mt-1 text-gray-400">
            Children&apos;s data is handled under India&apos;s DPDP Act 2023. Parents join
            free and can request their child&apos;s record at any time.
          </p>
        </div>
      </footer>
    </div>
  );
}
