"use client";

/**
 * MODULE: Application error boundary
 *
 * Purpose        Show a recoverable failure instead of a blank screen.
 * Responsibility Presentation and a retry affordance.
 *
 * The underlying error is deliberately not rendered. It has already been logged
 * server-side with full context by `presentError`; showing a stack trace to a
 * tuition-centre owner helps nobody and can leak internals.
 */

import { AlertTriangle } from "lucide-react";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card mx-auto mt-10 max-w-md p-6 text-center">
      <AlertTriangle
        size={28}
        className="mx-auto mb-3 text-[color:var(--color-status-risk)]"
        aria-hidden="true"
      />
      <h1 className="font-display text-lg font-bold text-ink">Something went wrong</h1>
      <p className="mt-1 text-[13px] text-gray-500">
        The page could not be loaded. Your data has not been changed.
      </p>
      <button
        onClick={reset}
        className="mt-4 rounded-xl bg-brand-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
      >
        Try again
      </button>
    </div>
  );
}
