"use client";

/**
 * MODULE: Registration form
 *
 * Purpose        Create a centre and its first owner account.
 * Responsibility Presentation and pending state; the server validates.
 */

import { useActionState } from "react";
import { GraduationCap } from "lucide-react";
import { ActionBanner, FieldError, SubmitButton } from "@/components/ui/Forms";
import { IDLE_ACTION_STATE } from "@/server/action-result";
import { PASSWORD_MIN_LENGTH } from "@/domain/password-policy";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { registerAction } from "./actions";

/** Null when Google Sign-In is not configured; the button then renders nothing. */
export function SignupForm({ googleClientId }: { googleClientId: string | null }) {
  const [state, submit] = useActionState(registerAction, IDLE_ACTION_STATE);

  return (
    <div className="card w-full max-w-sm p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-xl bg-brand-900">
          <GraduationCap size={20} color="#fff" aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-display text-lg font-bold text-ink">Create your centre</h1>
          <p className="text-[12px] text-gray-500">Free while you try it out</p>
        </div>
      </div>

      <form action={submit} className="space-y-3">
        <label className="block">
          <span className="text-[11px] font-semibold text-gray-500">Centre name</span>
          <input
            name="centreName"
            required
            maxLength={120}
            autoFocus
            placeholder="Bright Minds Academy"
            className="field-input mt-1"
          />
          <FieldError messages={state.fieldErrors?.centreName} />
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold text-gray-500">Your name</span>
          <input
            name="fullName"
            required
            maxLength={120}
            autoComplete="name"
            placeholder="Priya Nair"
            className="field-input mt-1"
          />
          <FieldError messages={state.fieldErrors?.fullName} />
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold text-gray-500">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@yourcentre.in"
            className="field-input mt-1"
          />
          <FieldError messages={state.fieldErrors?.email} />
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold text-gray-500">Password</span>
          <input
            name="password"
            type="password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            autoComplete="new-password"
            className="field-input mt-1"
          />
          <span className="mt-1 block text-[10.5px] text-gray-400">
            At least {PASSWORD_MIN_LENGTH} characters.
          </span>
          <FieldError messages={state.fieldErrors?.password} />
        </label>

        <ActionBanner state={state} />

        <SubmitButton className="w-full" pendingLabel="Creating…">
          Create centre
        </SubmitButton>
      </form>

      {/* Reads the centre name from the field above, so it must stay rendered. */}
      <GoogleAuthButton clientId={googleClientId} mode="signup" />
    </div>
  );
}
