/**
 * MODULE: Reset-password page
 *
 * Purpose        Land a reset link and collect the new password.
 * Responsibility Layout, plus handling a link that arrived without a token.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Choose a new password",
  // A reset link must never be indexed or followed by a crawler.
  robots: { index: false, follow: false },
};

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const { token } = await searchParams;

  return (
    <main
      id="main"
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-10"
    >
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="card w-full max-w-sm p-6 text-center shadow-sm">
          <h1 className="font-display text-lg font-bold text-ink">Link incomplete</h1>
          <p className="mt-1 text-[13px] text-gray-500">
            This reset link is missing its token. Email clients sometimes split long
            links — request a new one and open it in a single click.
          </p>
          <Link
            href="/forgot-password"
            className="mt-4 inline-block rounded-xl bg-brand-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
          >
            Request a new link
          </Link>
        </div>
      )}

      <Link href="/login" className="text-[12.5px] font-semibold text-brand-700 hover:underline">
        ← Back to sign in
      </Link>
    </main>
  );
}
