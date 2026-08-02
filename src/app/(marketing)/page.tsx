/**
 * MODULE: Landing page
 *
 * Purpose        Explain the product to a centre owner in under a minute.
 * Responsibility Static presentation. No data access.
 *
 * The claims here describe what the application actually does. Marketing copy
 * that promises a feature the code does not have is how a pilot dies in week
 * two — the prototype's "22 parents notified" banner being the example.
 */

import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  ClipboardCheck,
  ShieldCheck,
  TrendingUp,
  UserCheck,
} from "lucide-react";

const FEATURES = [
  {
    icon: ClipboardCheck,
    title: "Log a whole batch in one pass",
    body: "Attendance defaults to present, homework and test scores are one tap per student. A tutor finishes the class and finishes the paperwork in the same minute.",
  },
  {
    icon: UserCheck,
    title: "It splits into each child's record",
    body: "One save becomes a private timeline entry for every student — and only their own guardians can see it. Nobody sees another family's child.",
  },
  {
    icon: BellRing,
    title: "Parents are actually told",
    body: "Every update is queued in a transactional outbox and delivered with retries. If the messaging provider is down, nothing is lost — it goes out when it recovers.",
  },
  {
    icon: TrendingUp,
    title: "The centre sees it roll up",
    body: "Attendance, homework and at-risk students are computed from what was logged, weighted by class size. No figure on the dashboard is decorative.",
  },
];

const FLOW = [
  "Teacher marks the batch",
  "Each child's record updates",
  "Parents are notified and acknowledge",
  "Centre sees the roll-up",
];

export default function LandingPage() {
  return (
    <>
      <section className="mx-auto w-full max-w-5xl px-4 py-14 text-center">
        <span className="inline-block rounded-full bg-brand-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-900">
          For tuition centres &amp; coaching classes
        </span>

        <h1 className="mx-auto mt-4 max-w-2xl font-display text-4xl font-extrabold leading-tight text-ink sm:text-5xl">
          Student progress your parents actually read
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-gray-600">
          Teachers log attendance, homework and test results for a whole batch in
          seconds. Every parent gets their own child&apos;s progress — live, private, and
          in a format they already know how to read.
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-900 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-800"
          >
            Sign in to your centre <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href="/plans"
            className="rounded-xl border border-hairline bg-white px-5 py-3 text-sm font-semibold text-ink hover:shadow-sm"
          >
            See plans
          </Link>
        </div>

        <ol className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-center gap-x-2 gap-y-2 text-[12.5px] text-gray-500">
          {FLOW.map((step, index) => (
            <li key={step} className="flex items-center gap-2">
              <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">{step}</span>
              {index < FLOW.length - 1 && (
                <ArrowRight size={13} className="text-gray-300" aria-hidden="true" />
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-hairline bg-white">
        <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-12 md:grid-cols-2">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="card p-5">
              <feature.icon
                size={20}
                className="mb-2 text-brand-700"
                aria-hidden="true"
              />
              <h2 className="font-display text-lg font-bold text-ink">{feature.title}</h2>
              <p className="mt-1 text-[13.5px] leading-relaxed text-gray-600">
                {feature.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-12">
        <div className="card flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center">
          <ShieldCheck size={22} className="shrink-0 text-brand-700" aria-hidden="true" />
          <div>
            <h2 className="font-display text-lg font-bold text-ink">
              Built for children&apos;s data from the first line
            </h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-gray-600">
              A parent can only ever see children linked to their account. Every change to
              a child&apos;s record is written to an append-only audit log with the staff
              member who made it. No photographs of minors are stored, and no behavioural
              tracking or advertising profile is ever built.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
