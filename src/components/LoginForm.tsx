"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Cookies from "js-cookie";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGoogle } from "@fortawesome/free-brands-svg-icons";
import {
  reqLoginLocal,
  reqLoginGoogle,
  reqOAuthComplete,
} from "@/services/auth.service";
import { useAuthStatus, useAppDispatch } from "@/store/hooks";
import { setCredentials } from "@/store/slices/authSlice";
import { useGoogleSignIn } from "@/hooks/useGoogleSignIn";
import { InlineLoading } from "@/components/InlineLoading";
import type { UserPublic } from "@/types/user.types";

const INHIBIT_REDIRECTS = process.env.NEXT_PUBLIC_INHIBIT_REDIRECTS === "true";
const DEFAULT_REDIRECT = "https://forta.appleby.cloud";

function setLoggedInCookie() {
  Cookies.set("logged_in", "1", {
    domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
    path: "/",
    expires: 365,
  });
}

function getOAuthErrorMessage(status: number, fallback?: string): string {
  if (status === 400) {
    return "Authorization request expired or invalid. Please return to the application and try again.";
  }
  return fallback || "Failed to complete authorization. Please try again.";
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const oauthRequestToken = searchParams.get("oauth_request_token");
  const redirectUri = searchParams.get("redirect_uri");
  const isOAuthFlow = !!oauthRequestToken;

  const { isLoggedIn, isLoading: authLoading } = useAuthStatus();
  const dispatch = useAppDispatch();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [oauthInProgress, setOauthInProgress] = useState(false);

  const isSubmitting = loading || googleLoading;

  const completeOAuth = useCallback(async () => {
    setStatusMessage("Completing authorization…");
    const res = await reqOAuthComplete({
      oauth_request_token: oauthRequestToken!,
    });

    if (!res.success) {
      setStatusMessage(null);
      setError(getOAuthErrorMessage(res.status, res.error_message));
      return;
    }

    if (INHIBIT_REDIRECTS) {
      setStatusMessage(`Would redirect to: ${res.data.redirect_url}`);
      setOauthInProgress(false);
      return;
    }

    setStatusMessage("Redirecting…");
    window.location.href = res.data.redirect_url;
  }, [oauthRequestToken]);

  const handleAuthSuccess = useCallback(
    async (user: UserPublic) => {
      setLoggedInCookie();
      dispatch(setCredentials({ user }));

      if (isOAuthFlow) {
        setLoading(false);
        setGoogleLoading(false);
        setOauthInProgress(true);
        await completeOAuth();
        setOauthInProgress(false);
      } else {
        const destination = redirectUri || DEFAULT_REDIRECT;
        if (INHIBIT_REDIRECTS) {
          setStatusMessage(`Would redirect to: ${destination}`);
          setLoading(false);
          setGoogleLoading(false);
          return;
        }
        setStatusMessage("Redirecting…");
        window.location.href = destination;
      }
    },
    [dispatch, isOAuthFlow, redirectUri, completeOAuth],
  );

  const handleGoogleSignIn = useCallback(
    async (credential: string) => {
      setError(null);
      setGoogleLoading(true);

      const res = await reqLoginGoogle({ id_token: credential });

      if (!res.success) {
        setError(
          res.error_message || "Google sign in failed. Please try again.",
        );
        setGoogleLoading(false);
        return;
      }

      await handleAuthSuccess(res.data.user);
    },
    [handleAuthSuccess],
  );

  const { promptGoogleSignIn } = useGoogleSignIn(handleGoogleSignIn);

  // Auto-redirect logged-in users
  useEffect(() => {
    if (INHIBIT_REDIRECTS || authLoading || !isLoggedIn) return;

    if (isOAuthFlow) {
      const tryAutoOAuth = async () => {
        setOauthInProgress(true);
        setStatusMessage("Authorizing application…");

        const oauthRes = await reqOAuthComplete({
          oauth_request_token: oauthRequestToken!,
        });

        if (!oauthRes.success) {
          setOauthInProgress(false);
          setStatusMessage(null);
          setError(
            getOAuthErrorMessage(oauthRes.status, oauthRes.error_message),
          );
          return;
        }

        setStatusMessage("Redirecting…");
        window.location.href = oauthRes.data.redirect_url;
      };

      tryAutoOAuth();
    } else {
      window.location.href = redirectUri || DEFAULT_REDIRECT;
    }
  }, [authLoading, isLoggedIn, isOAuthFlow, oauthRequestToken, redirectUri]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await reqLoginLocal({ email, password });

    if (!res.success) {
      setError(
        res.error_message || "Sign in failed. Please check your credentials.",
      );
      setLoading(false);
      return;
    }

    await handleAuthSuccess(res.data.user);
  };

  if (authLoading) {
    return <InlineLoading message="Checking session…" />;
  }

  if (!INHIBIT_REDIRECTS && (oauthInProgress || (isLoggedIn && !error))) {
    return <InlineLoading message={statusMessage || "Processing…"} />;
  }

  return (
    <div className="flex flex-col gap-5">
      {INHIBIT_REDIRECTS && (
        <DebugAlert
          isLoggedIn={isLoggedIn}
          isOAuthFlow={isOAuthFlow}
          statusMessage={statusMessage}
        />
      )}

      {isOAuthFlow && <OAuthAlert />}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <EmailField value={email} onChange={setEmail} />
        <PasswordField value={password} onChange={setPassword} />

        {error && <ErrorAlert message={error} />}

        <button
          type="submit"
          disabled={isSubmitting}
          className="cursor-pointer bg-black text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <Divider />

      <button
        type="button"
        disabled={isSubmitting}
        onClick={promptGoogleSignIn}
        className="cursor-pointer w-full flex items-center justify-center gap-2.5 border border-gray-300 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        <FontAwesomeIcon icon={faGoogle} className="w-4 h-4 text-[#4285F4]" />
        {googleLoading ? "Signing in…" : "Google"}
      </button>
    </div>
  );
}

// Sub-components

function DebugAlert({
  isLoggedIn,
  isOAuthFlow,
  statusMessage,
}: {
  isLoggedIn: boolean;
  isOAuthFlow: boolean;
  statusMessage: string | null;
}) {
  return (
    <div className="text-xs border border-yellow-200 bg-yellow-50 text-yellow-700 rounded p-3 font-mono">
      <div className="font-semibold mb-1">[DEBUG MODE] Redirects disabled</div>
      <div>isLoggedIn: {String(isLoggedIn)}</div>
      <div>isOAuthFlow: {String(isOAuthFlow)}</div>
      {statusMessage && (
        <div className="mt-1 text-yellow-800">{statusMessage}</div>
      )}
    </div>
  );
}

function OAuthAlert() {
  return (
    <div className="text-xs border border-blue-200 bg-blue-50 text-blue-700 rounded p-3">
      A third-party application is requesting access. Sign in to authorize.
    </div>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
      <svg
        className="w-4 h-4 mt-0.5 shrink-0"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clipRule="evenodd"
        />
      </svg>
      <span>{message}</span>
    </div>
  );
}

function EmailField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="email" className="text-sm font-medium text-gray-700">
        Email
      </label>
      <input
        id="email"
        type="email"
        placeholder="you@example.com"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-shadow"
        autoComplete="email"
        required
      />
    </div>
  );
}

function PasswordField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="password" className="text-sm font-medium text-gray-700">
        Password
      </label>
      <input
        id="password"
        type="password"
        placeholder="••••••••"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-shadow"
        autoComplete="current-password"
        required
      />
    </div>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-gray-200" />
      <span className="text-xs text-gray-400 uppercase tracking-wide">
        or continue with
      </span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );
}
