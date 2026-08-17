"use client";

/**
 * MODULE: Google sign-in button
 *
 * Purpose        Render Google's official button and hand the resulting ID
 *                token to the server.
 * Responsibility Widget lifecycle and submission. It performs no verification —
 *                the token is meaningless until `lib/auth/google.ts` checks its
 *                signature and audience server-side.
 * Dependencies   Google Identity Services, loaded from accounts.google.com.
 *
 * WHY GOOGLE'S OWN BUTTON
 *  Google's branding terms require it, and it handles the popup, the account
 *  chooser and every locale for us. A hand-rolled button would be a
 *  worse-looking way to break the terms.
 *
 * The component renders nothing when `clientId` is null, so a deployment with
 * Google unconfigured simply shows the password form on its own.
 */

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { FormError } from "@/components/ui/Forms";
import { IDLE_ACTION_STATE } from "@/server/action-result";
import { googleSignInAction } from "@/app/(auth)/login/actions";
import { googleRegisterAction } from "@/app/(auth)/signup/actions";

/** Minimal shape of the parts of Google Identity Services we use. */
interface GoogleIdentityServices {
  accounts: {
    id: {
      initialize(options: {
        client_id: string;
        callback: (response: { credential?: string }) => void;
        auto_select?: boolean;
      }): void;
      renderButton(
        parent: HTMLElement,
        options: {
          theme?: string;
          size?: string;
          text?: string;
          shape?: string;
          width?: number;
          logo_alignment?: string;
        },
      ): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

interface GoogleAuthButtonProps {
  clientId: string | null;
  mode: "signin" | "signup";
  /** Where to return to after signing in. Ignored for signup. */
  next?: string;
}

export function GoogleAuthButton({ clientId, mode, next }: GoogleAuthButtonProps) {
  const action = mode === "signin" ? googleSignInAction : googleRegisterAction;
  const [state, submit] = useActionState(action, IDLE_ACTION_STATE);

  const containerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const credentialRef = useRef<HTMLInputElement>(null);
  const centreNameRef = useRef<HTMLInputElement>(null);

  const [scriptReady, setScriptReady] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleCredential = useCallback(
    (response: { credential?: string }) => {
      if (!response.credential) {
        setLocalError("Google did not return a sign-in token. Please try again.");
        return;
      }

      // Registering needs a centre name, which lives in the sibling form. Read
      // it at submit time so the user can type it in either order.
      if (mode === "signup") {
        const field = document.querySelector<HTMLInputElement>('input[name="centreName"]');
        const centreName = field?.value.trim() ?? "";

        if (centreName.length < 2) {
          setLocalError("Enter your centre's name first, then continue with Google.");
          field?.focus();
          return;
        }

        if (centreNameRef.current) centreNameRef.current.value = centreName;
      }

      setLocalError(null);
      if (credentialRef.current) credentialRef.current.value = response.credential;
      formRef.current?.requestSubmit();
    },
    [mode],
  );

  useEffect(() => {
    if (!scriptReady || !clientId || !containerRef.current) return;
    if (!window.google) return;

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredential,
    });

    window.google.accounts.id.renderButton(containerRef.current, {
      theme: "outline",
      size: "large",
      shape: "pill",
      text: mode === "signup" ? "signup_with" : "signin_with",
      logo_alignment: "center",
      width: 320,
    });
  }, [scriptReady, clientId, handleCredential, mode]);

  if (!clientId) return null;

  return (
    <div className="w-full">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />

      <div className="my-3 flex items-center gap-3">
        <span className="h-px flex-1 bg-hairline" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          or
        </span>
        <span className="h-px flex-1 bg-hairline" />
      </div>

      <div ref={containerRef} className="flex justify-center" />

      <form ref={formRef} action={submit} className="hidden">
        <input ref={credentialRef} type="hidden" name="credential" />
        {mode === "signup" && <input ref={centreNameRef} type="hidden" name="centreName" />}
        {mode === "signin" && next && <input type="hidden" name="next" value={next} />}
      </form>

      {(localError || state.status === "error") && (
        <div className="mt-3">
          <FormError message={localError ?? state.message} />
        </div>
      )}
    </div>
  );
}
