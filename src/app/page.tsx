"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Cookies from "js-cookie";
import {
  reqLoginLocal,
  reqOAuthComplete,
  reqRefreshToken,
} from "@/services/auth.service";
import { AuthResponseData } from "@/types";

const setLoggedInCookie = () => {
  Cookies.set("logged_in", "1", {
    domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
    path: "/",
    expires: 365,
  });
};

function LoginForm() {
  const searchParams = useSearchParams();
  const oauthRequestToken = searchParams.get("oauth_request_token");
  const isOAuthFlow = !!oauthRequestToken;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(
    isOAuthFlow && Cookies.get("logged_in") === "1",
  );

  // Auto-complete OAuth if already logged in
  useEffect(() => {
    if (!checkingSession) return;

    const tryAutoOAuth = async () => {
      const refreshRes = await reqRefreshToken();
      if (!refreshRes.success) {
        setCheckingSession(false);
        return;
      }

      const oauthRes = await reqOAuthComplete(
        { oauth_request_token: oauthRequestToken! },
        refreshRes.data.token,
      );

      if (!oauthRes.success) {
        setCheckingSession(false);
        setError(
          oauthRes.status === 400
            ? "Authorization request expired or invalid. Please return to the application and try again."
            : oauthRes.error_message,
        );
        return;
      }

      window.location.href = oauthRes.data.redirect_url;
    };

    tryAutoOAuth();
  }, [checkingSession, oauthRequestToken]);

  const completeOAuth = async (data: AuthResponseData) => {
    const res = await reqOAuthComplete(
      { oauth_request_token: oauthRequestToken! },
      data.authorization.access_token,
    );

    if (!res.success) {
      setError(
        res.status === 400
          ? "Authorization request expired or invalid. Please return to the application and try again."
          : res.error_message,
      );
      return;
    }

    window.location.href = res.data.redirect_url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await reqLoginLocal({ email, password });

    if (!res.success) {
      setError(res.error_message);
      setLoading(false);
      return;
    }

    setLoggedInCookie();

    if (isOAuthFlow) {
      await completeOAuth(res.data);
      setLoading(false);
    } else {
      window.location.href = "https://forta.appleby.cloud";
    }
  };

  if (checkingSession) {
    return <p className="text-sm text-gray-600">Checking session…</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      {isOAuthFlow && (
        <div className="text-xs border border-blue-200 bg-blue-50 text-blue-700 rounded p-3">
          A third-party application is requesting access. Sign in to authorize.
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded p-2 text-sm"
          autoComplete="email"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border rounded p-2 text-sm"
          autoComplete="current-password"
          required
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-black text-white rounded p-2 text-sm disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <h1 className="text-lg font-semibold mb-6">Sign in to Forta</h1>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
