/**
 * MODULE: Page guard
 *
 * Purpose        Translate the application's errors into Next.js navigation
 *                outcomes.
 * Responsibility Map thrown AppErrors to `notFound()` / `redirect()` so pages
 *                render the right screen instead of a generic crash.
 * Dependencies   next/navigation, @/lib/errors.
 *
 * WHY THIS EXISTS
 *  `rbac.ts` throws NotFoundError when a caller may not see a record. Without
 *  this adapter that reaches the error boundary as "Something went wrong",
 *  which is both alarming and misleading — nothing went wrong, the record
 *  simply is not theirs.
 *
 *  Forbidden is deliberately mapped to not-found as well. Rendering a distinct
 *  "you are not allowed to see this student" page would confirm that the
 *  student exists, which is precisely what the not-found mapping in `rbac.ts`
 *  is designed to avoid.
 */

import { notFound, redirect } from "next/navigation";
import {
  ForbiddenError,
  NotFoundError,
  UnauthenticatedError,
} from "@/lib/errors";

/**
 * Run a page's data loading with error mapping.
 *
 * Usage:
 *   const profile = await loadPage(() => getStudentProfile(session, studentId));
 */
export async function loadPage<T>(loader: () => Promise<T>): Promise<T> {
  try {
    return await loader();
  } catch (error) {
    // These throw Next.js control-flow signals, so they must be called from
    // outside the `try` — which is exactly where we are.
    if (error instanceof UnauthenticatedError) redirect("/login");
    if (error instanceof NotFoundError || error instanceof ForbiddenError) notFound();
    throw error;
  }
}
