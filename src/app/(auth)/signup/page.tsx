/**
 * MODULE: Signup page
 *
 * Purpose        Let a new centre start using EduTrack without anyone seeding a
 *                database for them.
 * Responsibility Layout only.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = {
  title: "Create your centre",
  description: "Start tracking student progress at your tuition centre.",
};

export default function SignupPage() {
  return (
    <main
      id="main"
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-10"
    >
      <SignupForm />

      <p className="text-[12.5px] text-gray-500">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>

      <Link href="/" className="text-[12.5px] text-gray-400 hover:underline">
        ← Back to home
      </Link>
    </main>
  );
}
