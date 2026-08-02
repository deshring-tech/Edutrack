"use client";

/**
 * MODULE: Login form
 *
 * Purpose        Collect credentials and surface server-side validation errors.
 * Responsibility Presentation and pending state. No validation happens here —
 *                the server is the only authority on whether a login is valid.
 */

import { useActionState } from "react";
import { GraduationCap } from "lucide-react";
import { FormError, SubmitButton } from "@/components/ui/Forms";
import { IDLE_ACTION_STATE } from "@/server/action-result";
import { loginAction } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(loginAction, IDLE_ACTION_STATE);

  return (
    <form action={formAction} className="card w-full max-w-sm p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-xl bg-brand-900">
          <GraduationCap size={20} color="#fff" aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-display text-lg font-bold text-ink">Sign in to EduTrack</h1>
          <p className="text-[12px] text-gray-500">Teachers, parents and centre admins</p>
        </div>
      </div>

      {next && <input type="hidden" name="next" value={next} />}

      <div className="space-y-3">
        <label className="block">
          <span className="text-[11px] font-semibold text-gray-500">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            className="field-input mt-1"
            placeholder="you@centre.in"
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold text-gray-500">Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="field-input mt-1"
            placeholder="••••••••••"
          />
        </label>

        {state.status === "error" && <FormError message={state.message} />}

        <SubmitButton className="w-full" pendingLabel="Signing in…">
          Sign in
        </SubmitButton>
      </div>
    </form>
  );
}
