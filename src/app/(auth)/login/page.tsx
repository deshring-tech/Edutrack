/**
 * MODULE: Login page
 *
 * Purpose        The single entry point into the application.
 * Responsibility Layout and demo-credential hints in non-production builds.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { isProduction } from "@/lib/env";
import { googleClientId } from "@/lib/auth/google";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;

  return (
    <main
      id="main"
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-10"
    >
      {/* Read on the server so the Client ID never needs a NEXT_PUBLIC_ twin. */}
      <LoginForm next={next} googleClientId={googleClientId()} />

      {/* Demo accounts are never rendered in a production build. */}
      {!isProduction && (
        <div className="card w-full max-w-sm p-4 text-[12px] text-gray-600">
          <p className="mb-2 font-semibold text-ink">Demo accounts</p>
          <ul className="space-y-1">
            <li>
              <span className="font-medium">Centre owner</span> · priya@brightminds.in
            </li>
            <li>
              <span className="font-medium">Teacher</span> · rao@brightminds.in
            </li>
            <li>
              <span className="font-medium">Parent</span> · anita.sharma@example.in
            </li>
          </ul>
          <p className="mt-2 text-gray-400">Password for all: demo-password-123</p>
        </div>
      )}

      <p className="text-[12.5px] text-gray-500">
        New centre?{" "}
        <Link href="/signup" className="font-semibold text-brand-700 hover:underline">
          Create one
        </Link>
      </p>

      <Link href="/" className="text-[12.5px] text-gray-400 hover:underline">
        ← Back to home
      </Link>
    </main>
  );
}
