"use client";

/**
 * MODULE: Login form
 *
 * Purpose        Collect credentials and surface server-side validation errors.
 * Responsibility Presentation and pending state. No validation happens here —
 *                the server is the only authority on whether a login is valid.
 */

import { useActionState } from "react";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { FormError, SubmitButton } from "@/components/ui/Forms";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { IDLE_ACTION_STATE } from "@/server/action-result";
import { loginAction } from "./actions";

interface LoginFormProps {
  next?: string;
  /** Null when Google Sign-In is not configured; the button then renders nothing. */
  googleClientId: string | null;
}

export function LoginForm({ next, googleClientId }: LoginFormProps) {
  const [state, formAction] = useActionState(loginAction, IDLE_ACTION_STATE);

  return (
    <div className="card w-full max-w-sm p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-xl bg-brand-900">
          <GraduationCap size={20} color="#fff" aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-display text-lg font-bold text-ink">Sign in to EduTrack</h1>
          <p className="text-[12px] text-gray-500">Teachers, parents and centre admins</p>
        </div>
      </div>

      <form action={formAction} className="space-y-3">
        {next && <input type="hidden" name="next" value={next} />}

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
      </form>

      <p className="mt-2 text-right">
        <Link
          href="/forgot-password"
          className="text-[12px] font-semibold text-brand-700 hover:underline"
        >
          Forgot your password?
        </Link>
      </p>

      <GoogleAuthButton clientId={googleClientId} mode="signin" next={next} />
    </div>
  );
}
