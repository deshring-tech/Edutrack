"use client";

/**
 * MODULE: Form primitives
 *
 * Purpose        Give every form the same pending state, error surface and
 *                disabled behaviour.
 * Responsibility Client-side interaction only; all validation is server-side.
 * Dependencies   react-dom's `useFormStatus`.
 *
 * WHY A SHARED SUBMIT BUTTON
 *  A teacher on a slow connection who taps "Save attendance" twice must not
 *  save twice. `useFormStatus` disables the button for the duration of the
 *  action, which — combined with the idempotent upserts on the server — makes
 *  double submission harmless rather than merely unlikely.
 */

import { useFormStatus } from "react-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import type { ActionState } from "@/server/action-result";

interface SubmitButtonProps {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary";
  className?: string;
  disabled?: boolean;
}

export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  variant = "primary",
  className = "",
  disabled = false,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  const palette =
    variant === "primary"
      ? "bg-brand-900 text-white hover:bg-brand-800"
      : "bg-[#f1f1ef] text-ink hover:bg-[#e8e8e4]";

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${palette} ${className}`}
    >
      {pending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
      {pending ? pendingLabel : children}
    </button>
  );
}

/**
 * Form-level error. `role="alert"` so a screen reader announces it the moment
 * it appears, rather than the user tabbing back to find out why nothing saved.
 */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700"
    >
      <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

/**
 * Renders whichever outcome an action returned.
 *
 * Success messages here can carry a temporary password an owner must copy, so
 * the banner is deliberately persistent rather than a toast that disappears
 * after three seconds.
 */
export function ActionBanner({ state }: { state: ActionState }) {
  if (state.status === "idle" || !state.message) return null;

  if (state.status === "error") return <FormError message={state.message} />;

  return (
    <p
      role="status"
      className="rounded-lg bg-brand-100 px-3 py-2 text-[12.5px] font-medium text-[color:var(--color-status-ontrack)]"
    >
      {state.message}
    </p>
  );
}

export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return (
    <p className="mt-1 text-[11.5px] text-red-600" role="alert">
      {messages[0]}
    </p>
  );
}
