/**
 * MODULE: Not-found page
 *
 * Purpose        Handle unknown routes and records the caller may not see.
 * Responsibility Presentation only.
 *
 * Note that `rbac.ts` returns NotFound for cross-tenant access too, so this page
 * is also what an attacker probing student ids gets — it must not hint at
 * whether the record exists.
 */

import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="card max-w-md p-6 text-center">
        <h1 className="font-display text-2xl font-bold text-ink">Page not found</h1>
        <p className="mt-2 text-[13.5px] text-gray-500">
          That page does not exist, or it is not available to your account.
        </p>
        <Link
          href="/app"
          className="mt-4 inline-block rounded-xl bg-brand-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Go to my home
        </Link>
      </div>
    </main>
  );
}
