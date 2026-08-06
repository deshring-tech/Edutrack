"use client";

/**
 * MODULE: Password change form
 *
 * Purpose        Let any signed-in user change their own password.
 * Responsibility Presentation and pending state.
 *
 * This is the screen that makes generated temporary passwords acceptable —
 * without it, whatever the owner handed over is that person's password forever.
 */

import { useActionState, useRef } from "react";
import { KeyRound } from "lucide-react";
import { ActionBanner, FieldError, SubmitButton } from "@/components/ui/Forms";
import { IDLE_ACTION_STATE } from "@/server/action-result";
import { PASSWORD_MIN_LENGTH } from "@/domain/password-policy";
import { changePasswordAction } from "./actions";

export function PasswordForm() {
  const [state, submit] = useActionState(changePasswordAction, IDLE_ACTION_STATE);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <section className="card max-w-md p-4">
      <div className="mb-3 flex items-center gap-2">
        <KeyRound size={16} className="text-brand-700" aria-hidden="true" />
        <h2 className="font-semibold text-ink">Change your password</h2>
      </div>

      <form
        ref={formRef}
        action={async (formData) => {
          await submit(formData);
          formRef.current?.reset();
        }}
        className="space-y-2.5"
      >
        <label className="block">
          <span className="text-[11px] font-semibold text-gray-500">
            Current password
          </span>
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            className="field-input mt-1"
          />
          <FieldError messages={state.fieldErrors?.currentPassword} />
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold text-gray-500">New password</span>
          <input
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            className="field-input mt-1"
          />
          <span className="mt-1 block text-[10.5px] text-gray-400">
            At least {PASSWORD_MIN_LENGTH} characters.
          </span>
          <FieldError messages={state.fieldErrors?.newPassword} />
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold text-gray-500">
            Confirm new password
          </span>
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
        <SubmitButton className="w-full">Change password</SubmitButton>
      </form>
    </section>
  );
}
