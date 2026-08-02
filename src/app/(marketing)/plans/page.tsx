/**
 * MODULE: Plans page
 *
 * Purpose        Present pricing tiers.
 * Responsibility Static presentation.
 *
 * SCOPE NOTE (deliberate)
 *  This page has no subscription logic, seat enforcement or payment
 *  integration behind it. Billing is intentionally out of v1: the thing worth
 *  learning first is whether centres keep logging after week three, and
 *  building Razorpay plumbing before that is answered is expensive guesswork.
 *  Seat usage IS tracked and displayed on the dashboard, which is the input a
 *  pricing decision will need.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Plans",
  description:
    "EduTrack pricing for tutors, coaching centres and schools. Parents always join free.",
};

interface Plan {
  name: string;
  price: string;
  unit: string;
  audience: string;
  seats: string;
  features: string[];
  highlighted: boolean;
  cta: string;
}

const PLANS: Plan[] = [
  {
    name: "Solo Tutor",
    price: "₹499",
    unit: "/month",
    audience: "For individual tutors",
    seats: "Up to 25 students",
    features: [
      "One teacher account",
      "Attendance, homework and engagement",
      "Parent app (free for parents)",
      "Full progress timeline",
    ],
    highlighted: false,
    cta: "Start free trial",
  },
  {
    name: "Centre",
    price: "₹3,499",
    unit: "/month",
    audience: "For coaching centres",
    seats: "Up to 150 students",
    features: [
      "Unlimited teacher accounts",
      "Centre admin dashboard",
      "At-risk student alerts",
      "Batch and attendance reporting",
      "Audit log of every change",
    ],
    highlighted: true,
    cta: "Start free trial",
  },
  {
    name: "Institute",
    price: "Custom",
    unit: "",
    audience: "For schools and chains",
    seats: "Unlimited students",
    features: [
      "Multi-branch administration",
      "Role-based access control",
      "Data export and API access",
      "Priority support and onboarding",
      "SSO for staff",
    ],
    highlighted: false,
    cta: "Contact sales",
  },
];

export default function PlansPage() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-12">
      <header className="mb-8 text-center">
        <h1 className="font-display text-3xl font-bold text-ink">
          Plans for centres &amp; schools
        </h1>
        <p className="mt-2 text-[14px] text-gray-600">
          Centres pay per active student. <b>Parents always join free.</b> 14-day trial,
          no card required.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => (
          <article
            key={plan.name}
            className="relative flex flex-col rounded-2xl bg-white p-5 shadow-sm"
            style={{
              border: plan.highlighted
                ? "2px solid var(--color-brand-700)"
                : "1px solid var(--color-hairline)",
            }}
          >
            {plan.highlighted && (
              <span className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-brand-900 px-3 py-1 text-[10px] font-bold text-white">
                <Sparkles size={11} aria-hidden="true" /> MOST POPULAR
              </span>
            )}

            <h2 className="font-display text-lg font-bold text-ink">{plan.name}</h2>
            <p className="mb-3 text-[12px] text-gray-400">{plan.audience}</p>

            <p className="mb-1 flex items-baseline gap-1">
              <span className="font-display text-3xl font-bold text-ink">{plan.price}</span>
              <span className="text-sm text-gray-400">{plan.unit}</span>
            </p>

            <p className="mb-3 text-[12px] font-semibold text-brand-700">{plan.seats}</p>

            <ul className="mb-4 flex-1 space-y-2">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-[13px] text-gray-600">
                  <Check
                    size={15}
                    className="mt-0.5 shrink-0 text-brand-500"
                    aria-hidden="true"
                  />
                  {feature}
                </li>
              ))}
            </ul>

            <Link
              href="/login"
              className="w-full rounded-xl py-2.5 text-center text-sm font-semibold transition-colors"
              style={
                plan.highlighted
                  ? { background: "var(--color-brand-900)", color: "#fff" }
                  : { background: "#f1f1f1", color: "var(--color-ink)" }
              }
            >
              {plan.cta}
            </Link>
          </article>
        ))}
      </div>

      <p className="mt-6 text-center text-[12px] text-gray-400">
        Prices shown are indicative. Billing is not yet automated — centres are invoiced
        directly during the pilot.
      </p>
    </section>
  );
}
