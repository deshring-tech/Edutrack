/**
 * MODULE: Server action results
 *
 * Purpose        Give every server action one return shape and one error path.
 * Responsibility Translate thrown errors into a value a form can render.
 * Dependencies   @/lib/errors.
 *
 * WHY A WRAPPER
 *  A Server Action that throws produces an opaque "An error occurred in the
 *  Server Components render" in production — useless to the user and to
 *  support. `runAction` converts every failure into a typed result the form
 *  displays inline, while the real cause is logged server-side by
 *  `presentError`.
 */

import { presentError } from "@/lib/errors";

export interface ActionState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export const IDLE_ACTION_STATE: ActionState = { status: "idle" };

export async function runAction(
  event: string,
  operation: () => Promise<string>,
): Promise<ActionState> {
  try {
    const message = await operation();
    return { status: "success", message };
  } catch (error) {
    const presented = presentError(error, event);
    return {
      status: "error",
      message: presented.message,
      fieldErrors: presented.fieldErrors,
    };
  }
}
