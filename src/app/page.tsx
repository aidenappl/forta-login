"use client";

import { useState } from "react";
import { ApiResponse } from "@/types";
import {
  reqLoginLocal,
  reqRegister,
  reqGetSelf,
  reqLoginGoogle,
  reqIssueCode,
  reqExchangeCode,
  reqOAuthComplete,
} from "@/services/auth.service";

type Tab =
  | "login"
  | "register"
  | "google"
  | "self"
  | "issue_code"
  | "exchange"
  | "oauth_complete";

const TABS: { id: Tab; label: string }[] = [
  { id: "login", label: "Login" },
  { id: "register", label: "Register" },
  { id: "google", label: "Google" },
  { id: "self", label: "Get Self" },
  { id: "issue_code", label: "Issue Code" },
  { id: "exchange", label: "Exchange" },
  { id: "oauth_complete", label: "OAuth Complete" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("login");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<ApiResponse<any> | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async (fn: () => Promise<ApiResponse<unknown>>) => {
    setLoading(true);
    setResult(null);
    const res = await fn();
    setResult(res);
    setLoading(false);
  };

  // ── Login ────────────────────────────────────────────────────────────────
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // ── Register ─────────────────────────────────────────────────────────────
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  // ── Google ───────────────────────────────────────────────────────────────
  const [googleToken, setGoogleToken] = useState("");

  // ── Issue Code ───────────────────────────────────────────────────────────
  const [codeClientId, setCodeClientId] = useState("");
  const [codeRedirectUri, setCodeRedirectUri] = useState("");

  // ── Exchange ─────────────────────────────────────────────────────────────
  const [exchClientId, setExchClientId] = useState("");
  const [exchClientSecret, setExchClientSecret] = useState("");
  const [exchCode, setExchCode] = useState("");

  // ── OAuth Complete ────────────────────────────────────────────────────────
  const [oauthRequestToken, setOauthRequestToken] = useState("");

  return (
    <main className="p-8 max-w-2xl mx-auto font-mono">
      <h1 className="text-xl font-bold mb-1">Forta Auth — Dev Test</h1>
      <p className="text-xs text-gray-500 mb-6">forta.appleby.cloud</p>

      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => {
              setTab(id);
              setResult(null);
            }}
            className={`px-3 py-1 text-sm border rounded ${tab === id ? "bg-black text-white border-black" : "border-gray-300 hover:border-black"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Login */}
      {tab === "login" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() =>
              reqLoginLocal({ email: loginEmail, password: loginPassword }),
            );
          }}
          className="flex flex-col gap-3"
        >
          <input
            placeholder="Email"
            type="email"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            className="border p-2 rounded text-sm"
            required
          />
          <input
            placeholder="Password"
            type="password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            className="border p-2 rounded text-sm"
            required
          />
          <button
            type="submit"
            className="bg-black text-white p-2 rounded text-sm"
          >
            POST /auth/login
          </button>
        </form>
      )}

      {/* Register */}
      {tab === "register" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() =>
              reqRegister({
                name: regName,
                email: regEmail,
                password: regPassword,
              }),
            );
          }}
          className="flex flex-col gap-3"
        >
          <input
            placeholder="Name"
            value={regName}
            onChange={(e) => setRegName(e.target.value)}
            className="border p-2 rounded text-sm"
            required
          />
          <input
            placeholder="Email"
            type="email"
            value={regEmail}
            onChange={(e) => setRegEmail(e.target.value)}
            className="border p-2 rounded text-sm"
            required
          />
          <input
            placeholder="Password"
            type="password"
            value={regPassword}
            onChange={(e) => setRegPassword(e.target.value)}
            className="border p-2 rounded text-sm"
            required
          />
          <button
            type="submit"
            className="bg-black text-white p-2 rounded text-sm"
          >
            POST /auth/register
          </button>
        </form>
      )}

      {/* Google */}
      {tab === "google" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => reqLoginGoogle({ id_token: googleToken }));
          }}
          className="flex flex-col gap-3"
        >
          <textarea
            placeholder="Google ID Token"
            value={googleToken}
            onChange={(e) => setGoogleToken(e.target.value)}
            className="border p-2 rounded text-xs h-24 resize-none"
            required
          />
          <button
            type="submit"
            className="bg-black text-white p-2 rounded text-sm"
          >
            POST /auth/google
          </button>
        </form>
      )}

      {/* Get Self */}
      {tab === "self" && (
        <button
          onClick={() => run(reqGetSelf)}
          className="bg-black text-white px-4 py-2 rounded text-sm"
        >
          GET /auth/self
        </button>
      )}

      {/* Issue Code */}
      {tab === "issue_code" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() =>
              reqIssueCode({
                client_id: codeClientId,
                redirect_uri: codeRedirectUri,
              }),
            );
          }}
          className="flex flex-col gap-3"
        >
          <input
            placeholder="client_id"
            value={codeClientId}
            onChange={(e) => setCodeClientId(e.target.value)}
            className="border p-2 rounded text-sm"
            required
          />
          <input
            placeholder="redirect_uri"
            type="url"
            value={codeRedirectUri}
            onChange={(e) => setCodeRedirectUri(e.target.value)}
            className="border p-2 rounded text-sm"
            required
          />
          <button
            type="submit"
            className="bg-black text-white p-2 rounded text-sm"
          >
            POST /auth/code
          </button>
        </form>
      )}

      {/* Exchange */}
      {tab === "exchange" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() =>
              reqExchangeCode({
                client_id: exchClientId,
                client_secret: exchClientSecret,
                code: exchCode,
              }),
            );
          }}
          className="flex flex-col gap-3"
        >
          <input
            placeholder="client_id"
            value={exchClientId}
            onChange={(e) => setExchClientId(e.target.value)}
            className="border p-2 rounded text-sm"
            required
          />
          <input
            placeholder="client_secret"
            type="password"
            value={exchClientSecret}
            onChange={(e) => setExchClientSecret(e.target.value)}
            className="border p-2 rounded text-sm"
            required
          />
          <input
            placeholder="code"
            value={exchCode}
            onChange={(e) => setExchCode(e.target.value)}
            className="border p-2 rounded text-sm"
            required
          />
          <button
            type="submit"
            className="bg-black text-white p-2 rounded text-sm"
          >
            POST /auth/exchange
          </button>
        </form>
      )}

      {/* OAuth Complete */}
      {tab === "oauth_complete" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() =>
              reqOAuthComplete({ oauth_request_token: oauthRequestToken }),
            );
          }}
          className="flex flex-col gap-3"
        >
          <textarea
            placeholder="oauth_request_token (JWT)"
            value={oauthRequestToken}
            onChange={(e) => setOauthRequestToken(e.target.value)}
            className="border p-2 rounded text-xs h-24 resize-none"
            required
          />
          <button
            type="submit"
            className="bg-black text-white p-2 rounded text-sm"
          >
            POST /oauth/complete
          </button>
        </form>
      )}

      {/* Result */}
      {(loading || result) && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
              Response
            </span>
            {result && (
              <span
                className={`text-xs px-2 py-0.5 rounded ${result.success ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
              >
                {result.success
                  ? `${result.status} OK`
                  : `${result.status} Error`}
              </span>
            )}
          </div>
          {loading ? (
            <p className="text-xs text-gray-400">Loading…</p>
          ) : (
            <pre className="bg-gray-50 border p-4 rounded text-xs overflow-auto whitespace-pre-wrap">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </main>
  );
}
