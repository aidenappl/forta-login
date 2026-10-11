"use client";

import { useState } from "react";
import { BASE_API_URL } from "@/services/api.service";
import { monitor } from "@/services/monitor.service";

/**
 * "Continue with Google" — a plain link into Forta's server-side Google
 * sign-in (authorization code + PKCE). No Google script runs on this page, so
 * the button is ours: same size, radius and states as the rest of the form,
 * using Google's standard four-colour mark and button colours (light: white
 * with a #747775 border; dark: #131314 with a #8E918F border) per its branding
 * guidelines.
 *
 * return_to is this page — still carrying any oauth_request_token — so after
 * Google, the page loads signed in and completes the relying party's
 * authorization like any other sign-in.
 */
export function GoogleButton({ disabled }: { disabled?: boolean }) {
  const [redirecting, setRedirecting] = useState(false);

  const start = () => {
    setRedirecting(true);
    monitor?.emit("auth.login.google_started", "info", {});
    const url = new URL("/auth/google/start", BASE_API_URL);
    url.searchParams.set("return_to", stripGoogleError(window.location.href));
    window.location.href = url.toString();
  };

  return (
    <button
      type="button"
      onClick={start}
      disabled={disabled || redirecting}
      aria-busy={redirecting}
      className="cursor-pointer flex w-full items-center justify-center gap-3 rounded-lg border border-[#747775] bg-white py-2.5 text-sm font-medium text-[#1F1F1F] transition-colors hover:bg-[#F8F9FA] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#8E918F] dark:bg-[#131314] dark:text-[#E3E3E3] dark:hover:bg-[#1F1F20]"
    >
      <GoogleMark />
      {redirecting ? "Redirecting to Google…" : "Continue with Google"}
    </button>
  );
}

/** Drops a previous attempt's error so it does not survive into the next one. */
function stripGoogleError(href: string): string {
  const u = new URL(href);
  u.searchParams.delete("google_error");
  return u.toString();
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-[18px] w-[18px] shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
