"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Cookies from "js-cookie";
import {
  reqLoginLocal,
  reqRegister,
  reqOAuthComplete,
  reqOAuthRequestInfo,
  reqSignupMode,
  type SignupMode,
} from "@/services/auth.service";
import type { ApiError } from "@/types";
import { useAuthStatus, useAppDispatch } from "@/store/hooks";
import { setCredentials } from "@/store/slices/authSlice";
import { GoogleButton } from "@/components/GoogleButton";
import { InlineLoading } from "@/components/InlineLoading";
import type { UserPublic } from "@/types/user.types";
import {
  monitor,
  reportCaught,
  reportLoginFailed,
  reportOAuthCompleteFailed,
  reportUntrustedRedirect,
} from "@/services/monitor.service";

const INHIBIT_REDIRECTS = process.env.NEXT_PUBLIC_INHIBIT_REDIRECTS === "true";
const DEFAULT_REDIRECT = process.env.NEXT_PUBLIC_FORTA_HOME || "https://forta.appleby.cloud";

// forta-api error codes for the two sign-up refusals.
const ERR_ACCOUNT_PENDING = 4031;
const ERR_SIGNUP_CLOSED = 4032;

/**
 * A sentence a person can act on, for a failed password sign-in. The API's
 * strings ("invalid credentials", "account is not active") are written for
 * logs; this keeps their meaning without the jargon. The wrong-password case
 * stays deliberately vague — it must not reveal whether the account exists.
 */
function signInErrorMessage(res: ApiError): string {
  if (res.error_code === ERR_ACCOUNT_PENDING)
    return "Your account is waiting for an administrator to approve it. You'll be able to sign in once it's approved.";
  if (res.status === 401) return "That email and password don't match. Check them and try again.";
  if (res.status === 403) return "This account can't sign in right now — it may be suspended or disabled. Contact an administrator.";
  if (res.status === 429) return "Too many attempts. Wait a minute and try again.";
  if (res.status === 0 || res.status >= 500) return "Forta couldn't be reached. Try again in a moment.";
  return res.error_message || "Sign in failed. Please try again.";
}

/**
 * `url` when it is trusted, else DEFAULT_REDIRECT — reporting the fallback
 * (host only) so a misconfigured relying party shows up in Monitor.
 */
function trustedOrDefault(url: string, source: string): string {
  if (isTrustedRedirect(url)) return url;
  reportUntrustedRedirect(url, source);
  return DEFAULT_REDIRECT;
}

function isTrustedRedirect(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);
    // Allow relative paths
    if (parsed.origin === window.location.origin) return true;
    // Allow appleby.cloud subdomains
    if (parsed.hostname.endsWith('.appleby.cloud')) return true;
    return false;
  } catch {
    return false;
  }
}

function setLoggedInCookie() {
  Cookies.set("forta-logged-in", "1", {
    domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
    path: "/",
    expires: 365,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
}

/** Messages for the google_error codes forta-api's Google callback returns. */
const GOOGLE_ERRORS: Record<string, string> = {
  cancelled: "Google sign-in was cancelled.",
  expired: "Google sign-in took too long. Please try again.",
  forbidden: "This account can't sign in right now — it may be suspended or disabled. Contact an administrator.",
  pending_approval: "Your account is waiting for an administrator to approve it. You'll be able to sign in once it's approved.",
  signup_closed: "New accounts aren't being created right now. Ask an administrator to add you.",
  unverified_account:
    "An account with this email exists but hasn't been verified. Sign in with your password first.",
  unavailable: "Google sign-in is unavailable right now. Use your email and password.",
  failed: "Google sign-in failed. Please try again.",
};

function getOAuthErrorMessage(status: number, fallback?: string): string {
  if (status === 400) {
    return "Authorization request expired or invalid. Please return to the application and try again.";
  }
  return fallback || "Failed to complete authorization. Please try again.";
}

/**
 * false during SSR and the first client render, true after mount. The auth
 * store is a module singleton whose loading flag can already be settled on the
 * client's first render while the server rendered "Checking session…", which
 * made React discard the server HTML (a hydration mismatch). Until mounted,
 * both sides render the loading state.
 */
function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    // One flip after mount is the point; it cannot cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
  }, []);
  return hydrated;
}

export function LoginForm() {
  const hydrated = useHydrated();
  const searchParams = useSearchParams();
  const oauthRequestToken = searchParams.get("oauth_request_token");
  const redirectUri = searchParams.get("redirect_uri");
  const isOAuthFlow = !!oauthRequestToken;
  // prompt=login (OIDC): the relying party asked for a fresh sign-in, so a
  // signed-in visitor is NOT completed automatically.
  const forceLogin = searchParams.get("prompt") === "login";
  const googleError = searchParams.get("google_error");

  const { isLoggedIn, isLoading: authLoading } = useAuthStatus();
  const dispatch = useAppDispatch();

  // ?signup=1 opens straight on "Create account" (a link you can hand out).
  const [mode, setMode] = useState<"signin" | "signup">(searchParams.get("signup") === "1" ? "signup" : "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  // Set after a successful sign-up: the account exists but has no access yet.
  const [created, setCreated] = useState<UserPublic | null>(null);
  // Set after a sign-up that is waiting for approval (sign-up mode "approval").
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  // null until known; the Create-account link stays hidden while unknown.
  const [signupMode, setSignupMode] = useState<SignupMode | null>(null);
  const [error, setError] = useState<string | null>(
    googleError && googleError !== "pending_approval" ? (GOOGLE_ERRORS[googleError] ?? GOOGLE_ERRORS.failed) : null,
  );
  // Not an error: the account exists and is waiting for approval.
  const [notice, setNotice] = useState<string | null>(googleError === "pending_approval" ? GOOGLE_ERRORS.pending_approval : null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [oauthInProgress, setOauthInProgress] = useState(false);
  // The requesting application, from forta-api's view of the SIGNED request
  // token (never a URL parameter). null until known; the alert then stays generic.
  const [oauthApp, setOauthApp] = useState<{ name: string; is_first_party: boolean } | null>(null);

  useEffect(() => {
    if (!oauthRequestToken) return;
    let cancelled = false;
    reqOAuthRequestInfo(oauthRequestToken).then((res) => {
      if (!cancelled && res.success) setOauthApp(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [oauthRequestToken]);

  useEffect(() => {
    let cancelled = false;
    reqSignupMode().then((res) => {
      if (cancelled) return;
      // Unknown (an older API) behaves like "open" did before.
      setSignupMode(res.success ? res.data.signup_mode : "open");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const isSubmitting = loading;

  // ⚠️ /oauth/complete must run ONCE per page. A password sign-in sets the
  // logged-in state, which also fires the auto-redirect effect below; without
  // this guard both paths completed the flow, the browser followed two
  // redirects, and the app rejected the second as state_expired
  // ("Sign-in took too long").
  const oauthStartedRef = useRef(false);

  // Update document title based on current state
  useEffect(() => {
    if (authLoading) {
      document.title = "Checking session… | Forta";
    } else if (oauthInProgress) {
      document.title = "Authorizing… | Forta";
    } else if (loading) {
      document.title = "Signing in… | Forta";
    } else if (statusMessage?.includes("Redirecting")) {
      document.title = "Redirecting… | Forta";
    } else {
      document.title = "Sign in | Forta";
    }
  }, [authLoading, loading, oauthInProgress, statusMessage]);

  const completeOAuth = useCallback(async () => {
    if (oauthStartedRef.current) return;
    oauthStartedRef.current = true;
    setStatusMessage("Completing authorization…");
    const res = await reqOAuthComplete({
      oauth_request_token: oauthRequestToken!,
    });

    if (!res.success) {
      oauthStartedRef.current = false;
      reportOAuthCompleteFailed(res, false);
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
    const oauthRedirect = trustedOrDefault(res.data.redirect_url, "oauth_complete");
    window.location.href = oauthRedirect;
  }, [oauthRequestToken]);

  const handleAuthSuccess = useCallback(
    async (user: UserPublic) => {
      setLoggedInCookie();
      dispatch(setCredentials({ user }));
      monitor?.setUser(String(user.id));

      if (isOAuthFlow) {
        setLoading(false);
        setOauthInProgress(true);
        await completeOAuth();
        setOauthInProgress(false);
      } else {
        const destination = redirectUri ? trustedOrDefault(redirectUri, "login") : DEFAULT_REDIRECT;
        if (INHIBIT_REDIRECTS) {
          setStatusMessage(`Would redirect to: ${destination}`);
          setLoading(false);
          return;
        }
        setStatusMessage("Redirecting…");
        window.location.href = destination;
      }
    },
    [dispatch, isOAuthFlow, redirectUri, completeOAuth],
  );

  // Auto-redirect logged-in users
  useEffect(() => {
    // A just-created account stays on its "no access yet" panel.
    if (INHIBIT_REDIRECTS || authLoading || !isLoggedIn || forceLogin || created) return;

    if (isOAuthFlow) {
      const tryAutoOAuth = async () => {
        if (oauthStartedRef.current) return;
        oauthStartedRef.current = true;
        setOauthInProgress(true);
        setStatusMessage("Authorizing application…");

        const oauthRes = await reqOAuthComplete({
          oauth_request_token: oauthRequestToken!,
        });

        if (!oauthRes.success) {
          oauthStartedRef.current = false;
          reportOAuthCompleteFailed(oauthRes, true);
          setOauthInProgress(false);
          setStatusMessage(null);
          setError(
            getOAuthErrorMessage(oauthRes.status, oauthRes.error_message),
          );
          return;
        }

        setStatusMessage("Redirecting…");
        const autoOAuthRedirect = trustedOrDefault(oauthRes.data.redirect_url, "oauth_auto_complete");
        window.location.href = autoOAuthRedirect;
      };

      tryAutoOAuth().catch((err: unknown) => {
        reportCaught("login.oauth_auto_complete", err);
        setOauthInProgress(false);
        setStatusMessage(null);
        setError("An unexpected error occurred.");
      });
    } else {
      const destination = redirectUri ? trustedOrDefault(redirectUri, "already_signed_in") : DEFAULT_REDIRECT;
      window.location.href = destination;
    }
  }, [authLoading, isLoggedIn, isOAuthFlow, oauthRequestToken, redirectUri, forceLogin, created]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    const res = await reqLoginLocal({ email, password });

    if (!res.success) {
      reportLoginFailed("local", res);
      if (res.error_code === ERR_ACCOUNT_PENDING) setNotice(signInErrorMessage(res));
      else setError(signInErrorMessage(res));
      setLoading(false);
      return;
    }

    try {
      await handleAuthSuccess(res.data.user);
    } catch (err) {
      reportCaught("login.local.complete", err);
      setError("An unexpected error occurred.");
      setLoading(false);
    }
  };

  // Sign-up creates an account with ZERO grants (forta-api, Oct 2026): it can
  // sign in, but no app lets it in until an administrator grants access. Say so
  // instead of redirecting into a 403.
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8 || password.length > 72) {
      setError("Use a password between 8 and 72 characters.");
      return;
    }
    setLoading(true);
    const res = await reqRegister({ name: name.trim(), email, password });
    setLoading(false);
    if (!res.success) {
      // Approval mode: the account exists, waiting for an administrator. No
      // session was issued, so no logged-in marker either.
      if (res.error_code === ERR_ACCOUNT_PENDING) {
        setPassword("");
        setConfirm("");
        setPendingEmail(email);
        return;
      }
      reportLoginFailed("register", res);
      if (res.error_code === ERR_SIGNUP_CLOSED) {
        setSignupMode("closed");
        setMode("signin");
        setError("New accounts aren't being created right now. Ask an administrator to add you.");
        return;
      }
      setError(res.status === 409 ? "An account with that email already exists. Sign in instead." : res.error_message || "Could not create the account.");
      return;
    }
    setPassword("");
    setConfirm("");
    setLoggedInCookie();
    dispatch(setCredentials({ user: res.data.user }));
    monitor?.setUser(String(res.data.user.id));
    setCreated(res.data.user);
  };

  const switchMode = (next: "signin" | "signup") => {
    setMode(next);
    setError(null);
    setNotice(null);
    setPassword("");
    setConfirm("");
  };

  if (!hydrated || authLoading) {
    return <InlineLoading message="Checking session…" />;
  }

  if (pendingEmail) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-semibold">Account created — waiting for approval</p>
          <p className="mt-1">
            An administrator needs to approve <span className="font-medium">{pendingEmail}</span>{" "}
            before it can sign in.
            Try signing in again once you&apos;ve heard back.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setPendingEmail(null);
            switchMode("signin");
          }}
          className="cursor-pointer rounded-lg bg-black py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  if (created) {
    return (
      <div className="flex flex-col gap-4">
        <div className="text-sm border border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300 rounded-lg p-4">
          <p className="font-semibold">Account created for {created.email}.</p>
          <p className="mt-1">
            It doesn&apos;t have access to any apps yet. From your Forta dashboard you can request access to the apps
            you need.
          </p>
        </div>
        <a
          href={DEFAULT_REDIRECT}
          className="text-center bg-black text-white dark:bg-white dark:text-black rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 dark:hover:bg-neutral-200 transition-colors"
        >
          Continue to Forta
        </a>
      </div>
    );
  }

  if (!INHIBIT_REDIRECTS && mode === "signin" && (oauthInProgress || (isLoggedIn && !error && !forceLogin))) {
    return <InlineLoading message={statusMessage || "Processing…"} />;
  }

  const canSignUp = signupMode === "open" || signupMode === "approval";

  return (
    <div className="flex flex-col gap-5">
      <p className="-mt-1 text-center text-sm text-gray-500 dark:text-neutral-400">
        {mode === "signin" ? "Sign in to continue" : "Create your Forta account"}
      </p>
      {INHIBIT_REDIRECTS && (
        <DebugAlert
          isLoggedIn={isLoggedIn}
          isOAuthFlow={isOAuthFlow}
          statusMessage={statusMessage}
        />
      )}

      {isOAuthFlow && <OAuthAlert app={oauthApp} />}

      {mode === "signin" ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <EmailField value={email} onChange={setEmail} />
          <PasswordField value={password} onChange={setPassword} />

          {notice && <NoticeAlert message={notice} />}
          {error && <ErrorAlert message={error} />}

          <button
            type="submit"
            disabled={isSubmitting}
            className="cursor-pointer bg-black text-white dark:bg-white dark:text-black rounded-lg py-2.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 dark:hover:bg-neutral-200 transition-colors"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSignup} className="flex flex-col gap-4">
          <TextField id="name" label="Name" value={name} onChange={setName} autoComplete="name" placeholder="Your name" />
          <EmailField value={email} onChange={setEmail} />
          <PasswordField value={password} onChange={setPassword} autoComplete="new-password" />
          <PasswordField
            id="confirm-password"
            label="Confirm password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
          />

          {error && <ErrorAlert message={error} />}

          <button
            type="submit"
            disabled={isSubmitting}
            className="cursor-pointer bg-black text-white dark:bg-white dark:text-black rounded-lg py-2.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 dark:hover:bg-neutral-200 transition-colors"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
          <p className="text-xs text-gray-500 dark:text-neutral-400">
            {signupMode === "approval"
              ? "An administrator approves new accounts before they can sign in. New accounts have no access to any app until it's granted or requested."
              : "New accounts have no access to any app until an administrator grants it — you can request access from your dashboard."}
          </p>
        </form>
      )}

      {(canSignUp || mode === "signup") && (
      <p className="text-center text-sm text-gray-600 dark:text-neutral-400">
        {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
        <button
          type="button"
          onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
          className="cursor-pointer font-medium text-black underline-offset-2 hover:underline dark:text-white"
        >
          {mode === "signin" ? "Create one" : "Sign in"}
        </button>
      </p>
      )}

      <Divider />

      <GoogleButton disabled={isSubmitting} />
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
    <div className="text-xs border border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-300 rounded p-3 font-mono">
      <div className="font-semibold mb-1">[DEBUG MODE] Redirects disabled</div>
      <div>isLoggedIn: {String(isLoggedIn)}</div>
      <div>isOAuthFlow: {String(isOAuthFlow)}</div>
      {statusMessage && (
        <div className="mt-1 text-yellow-800 dark:text-yellow-200">
          {statusMessage}
        </div>
      )}
    </div>
  );
}

function OAuthAlert({ app }: { app: { name: string; is_first_party: boolean } | null }) {
  // First-party apps are ours: no consent framing, just where you're going.
  if (app?.is_first_party) {
    return (
      <div className="text-xs border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 rounded p-3">
        Sign in to continue to <span className="font-semibold">{app.name}</span>.
      </div>
    );
  }
  return (
    <div className="text-xs border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 rounded p-3">
      {app ? (
        <>
          <span className="font-semibold">{app.name}</span> is a third-party application requesting access. Sign in to
          authorize.
        </>
      ) : (
        "An application is requesting access. Sign in to authorize."
      )}
    </div>
  );
}

function NoticeAlert({ message }: { message: string }) {
  return (
    <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
      {message}
    </div>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-800 rounded-lg p-3">
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
      <label
        htmlFor="email"
        className="text-sm font-medium text-gray-700 dark:text-neutral-300"
      >
        Email
      </label>
      <input
        id="email"
        type="email"
        placeholder="you@example.com"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent transition-shadow"
        autoComplete="email"
        required
      />
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-gray-700 dark:text-neutral-300">
        {label}
      </label>
      <input
        id={id}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent transition-shadow"
        autoComplete={autoComplete}
        required
      />
    </div>
  );
}

function PasswordField({
  value,
  onChange,
  id = "password",
  label = "Password",
  autoComplete = "current-password",
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  label?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-sm font-medium text-gray-700 dark:text-neutral-300"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          placeholder="••••••••"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-gray-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-500 rounded-lg py-2.5 pl-3 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent transition-shadow"
          autoComplete={autoComplete}
          required
          minLength={8}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={show}
          className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded px-2 py-1 text-xs font-medium text-gray-500 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-white"
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-gray-200 dark:bg-neutral-700" />
      <span className="text-xs text-gray-400 dark:text-neutral-500 uppercase tracking-wide">
        or
      </span>
      <div className="flex-1 h-px bg-gray-200 dark:bg-neutral-700" />
    </div>
  );
}
