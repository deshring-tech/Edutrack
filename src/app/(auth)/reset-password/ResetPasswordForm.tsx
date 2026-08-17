"use client";

/**
 * MODULE: Reset-password form
 *
 * Purpose        Set a new password using a link from email.
 * Responsibility Presentation and pending state.
 */

import { useActionState } from "react";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { ActionBanner, FieldError, SubmitButton } from "@/components/ui/Forms";
import { IDLE_ACTION_STATE } from "@/server/action-result";
import { PASSWORD_MIN_LENGTH } from "@/domain/password-policy";
import { resetPasswordAction } from "./actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, submit] = useActionState(resetPasswordAction, IDLE_ACTION_STATE);

  // Once the password is set the form is useless; show the way onward instead.
  if (state.status === "success") {
    return (
      <div className="card w-full max-w-sm p-6 text-center shadow-sm">
        <h1 className="font-display text-lg font-bold text-ink">Password updated</h1>
        <p className="mt-1 text-[13px] text-gray-500">{state.message}</p>
        <Link
          href="/login"
          className="mt-4 inline-block rounded-xl bg-brand-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={submit} className="card w-full max-w-sm p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-xl bg-brand-900">
          <KeyRound size={18} color="#fff" aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-display text-lg font-bold text-ink">Choose a new password</h1>
          <p className="text-[12px] text-gray-500">This link works once</p>
        </div>
      </div>

      <input type="hidden" name="token" value={token} />

      <div className="space-y-3">
        <label className="block">
          <span className="text-[11px] font-semibold text-gray-500">New password</span>
          <input
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            autoFocus
            minLength={PASSWORD_MIN_LENGTH}
            className="field-input mt-1"
          />
          <span className="mt-1 block text-[10.5px] text-gray-400">
            At least {PASSWORD_MIN_LENGTH} characters.
          </span>
          <FieldError messages={state.fieldErrors?.newPassword} />
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold text-gray-500">Confirm password</span>
          <input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            className="field-input mt-1"
          />
          <FieldError messages={state.fieldErrors?.confirmPassword} />
        </label>

        <ActionBanner state={state} />

        <SubmitButton className="w-full" pendingLabel="Saving…">
          Set password
        </SubmitButton>
      </div>
    </form>
  );
}
