/**
 * MODULE: Root layout
 *
 * Purpose        The HTML shell every page renders inside.
 * Responsibility Fonts, global metadata, and the single import of globals.css.
 *
 * Fonts are loaded with `next/font`, which self-hosts them at build time. The
 * prototype pulled them from Google Fonts with a CSS `@import`, which blocks
 * first paint on a third-party request — measurable on the mid-range Android
 * phones most parents in this market actually use.
 */

import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "800"],
  variable: "--font-bricolage",
  display: "swap",
});

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hanken",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "EduTrack — student progress your parents actually read",
    template: "%s · EduTrack",
  },
  description:
    "Teachers log attendance, homework and test results for a whole batch in seconds. Every parent sees their own child's progress, live.",
  applicationName: "EduTrack",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#075e54",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${bricolage.variable} ${hanken.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only-focusable focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:h-auto focus:w-auto focus:rounded-lg focus:bg-brand-900 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
