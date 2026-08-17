/**
 * MODULE: Forgot-password page
 *
 * Purpose        Entry point for recovering an account.
 * Responsibility Layout only.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <main
      id="main"
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-10"
    >
      <ForgotPasswordForm />

      <Link href="/login" className="text-[12.5px] font-semibold text-brand-700 hover:underline">
        ← Back to sign in
      </Link>
    </main>
  );
}
