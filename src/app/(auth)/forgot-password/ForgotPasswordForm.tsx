"use client";

/**
 * MODULE: Forgot-password form
 *
 * Purpose        Ask for the address that needs a reset link.
 * Responsibility Presentation and pending state.
 */

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { ActionBanner, SubmitButton } from "@/components/ui/Forms";
import { IDLE_ACTION_STATE } from "@/server/action-result";
import { forgotPasswordAction } from "./actions";

export function ForgotPasswordForm() {
  const [state, submit] = useActionState(forgotPasswordAction, IDLE_ACTION_STATE);

  return (
    <form action={submit} className="card w-full max-w-sm p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-xl bg-brand-900">
          <KeyRound size={18} color="#fff" aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-display text-lg font-bold text-ink">Reset your password</h1>
          <p className="text-[12px] text-gray-500">We&apos;ll email you a link</p>
        </div>
      </div>

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

        <ActionBanner state={state} />

        <SubmitButton className="w-full" pendingLabel="Sending…">
          Send reset link
        </SubmitButton>
      </div>
    </form>
  );
}
