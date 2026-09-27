import { Monitor, newRequestId, type EmitOptions, type LogLevel } from "@aidenappleby/monitor-js";
import type { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import type { ApiError, RequestMeta } from "@/types";
import { APP_VERSION } from "@/lib/version";

export const MONITOR_SERVICE = "forta-login";

/**
 * The build this bundle came from: CI passes the release tag (vX.Y.Z) or the
 * short commit SHA as NEXT_PUBLIC_APP_VERSION; "dev" for a local build.
 */
export const RELEASE = APP_VERSION;

/** A URL or path without its query string or fragment, which can carry tokens. */
export const stripQuery = (url: string): string => {
    const i = url.search(/[?#]/);
    return i === -1 ? url : url.slice(0, i);
};

/**
 * The route of a pathname: /logout/ → /logout. This app's routes carry no
 * record ids, so the pathname itself is the grouping key.
 */
export const normaliseRoute = (pathname: string): string => {
    const route = stripQuery(pathname).replace(/\/+$/, "");
    return route === "" ? "/" : route;
};

/**
 * Whether the page is part of a third-party OAuth authorization — decided by
 * the PRESENCE of oauth_request_token in the query. Its value is a credential
 * and is never read into an event.
 */
const isOAuthFlow = (): boolean => {
    try {
        return new URLSearchParams(window.location.search).has("oauth_request_token");
    } catch {
        return false;
    }
};

/** Fields merged into every browser event. An event's own data wins. */
const eventContext = (): Record<string, unknown> =>
    typeof window === "undefined"
        ? { release: RELEASE }
        : { release: RELEASE, route: normaliseRoute(window.location.pathname), oauth_flow: isOAuthFlow() };

/**
 * Monitor with `route`, `release` and `oauth_flow` on every event, including
 * the SDK's own uncaught-error and unhandled-rejection events (they go through
 * emit too). An event's `feature` (see reportCaught) is copied to
 * `source_func`, the field Monitor groups caught errors by.
 */
class FortaMonitor extends Monitor {
    override emit(name: string, level: LogLevel, opts: EmitOptions = {}): void {
        const data: Record<string, unknown> = { ...eventContext(), ...opts.data };
        if (typeof data.feature === "string" && data.source_func === undefined) {
            data.source_func = data.feature;
        }
        super.emit(name, level, { ...opts, data });
    }
}

/** An X-Request-ID for an API call. crypto.randomUUID needs a secure context. */
export const newClientRequestId = (): string =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : newRequestId();

/**
 * Browser telemetry. Events go to this app's own /api/monitor route, which adds
 * the ingest key server-side: a key compiled into the bundle is readable by
 * anyone who loads the page. null during server rendering.
 */
export const monitor: Monitor | null =
    typeof window !== "undefined"
        ? new FortaMonitor({
              service: MONITOR_SERVICE,
              ingestUrl: "/api/monitor",
              apiKey: "",
              env: process.env.NODE_ENV === "production" ? "production" : "development",
              ignoreErrors: [
                  // Thrown by browser extensions, not by this app.
                  /(chrome|moz|safari(-web)?)-extension:\/\//,
                  // A benign layout notification some browsers surface as an error.
                  /ResizeObserver loop/,
              ],
          })
        : null;

/** A response header by case-insensitive name ("" when absent). */
const headerValue = (headers: AxiosResponse["headers"] | undefined, name: string): string => {
    if (!headers) return "";
    for (const [k, v] of Object.entries(headers)) {
        if (k.toLowerCase() === name && typeof v === "string") return v;
    }
    return "";
};

const durationSince = (meta: RequestMeta | undefined): number | undefined =>
    meta?.startTime ? Date.now() - meta.startTime : undefined;

/**
 * The level for a failed session or sign-in check (/auth/refresh, the
 * bootstrap /auth/self, a login attempt): 401/403 is the expected "not signed
 * in / wrong credentials / session over" case, so info; other 4xx is a
 * warning; 5xx or no response is an error.
 */
export const sessionFailureLevel = (status: number | undefined): LogLevel => {
    if (status === undefined || status >= 500) return "error";
    if (status === 401 || status === 403) return "info";
    return "warn";
};

/**
 * Reports every failed API call: method, path (never the query string),
 * status, the API's error, error_message and numeric error_code, the attempt
 * and the X-Request-ID — never a body.
 *
 * This replaces monitor-js's attachAxiosMonitor (1.2.0), which cannot attach a
 * request id to network errors and drops the API's error_code. A 401/403 on a
 * sign-in or session call (meta.authFlow) is an expected answer and goes out
 * at info rather than warn.
 */
export const attachMonitor = (instance: AxiosInstance): void => {
    if (!monitor) return;
    const m = monitor;

    const report = (response: AxiosResponse): void => {
        const status = response.status ?? 0;
        if (status < 400) return;
        const meta = response.config?.meta;

        const body: unknown = response.data;
        const envelope = (typeof body === "object" && body !== null ? body : {}) as {
            error?: unknown;
            error_message?: unknown;
            error_code?: unknown;
        };
        const level: LogLevel = status >= 500 ? "error" : meta?.authFlow ? sessionFailureLevel(status) : "warn";
        m.emit(status >= 500 ? "api.request.server_error" : "api.request.client_error", level, {
            // The API echoes the id it used.
            requestId: headerValue(response.headers, "x-request-id") || meta?.requestId,
            traceId: headerValue(response.headers, "x-trace-id") || undefined,
            data: {
                method: (response.config?.method ?? "").toUpperCase(),
                url: stripQuery(response.config?.url ?? ""),
                status_code: status,
                error: typeof envelope.error === "string" ? envelope.error : undefined,
                error_message: typeof envelope.error_message === "string" ? envelope.error_message : undefined,
                error_code: typeof envelope.error_code === "number" ? envelope.error_code : undefined,
                attempts: meta?.attempt ?? 1,
                duration_ms: durationSince(meta),
            },
        });
    };

    instance.interceptors.response.use(
        (response) => {
            report(response);
            return response;
        },
        (error: AxiosError) => {
            if (error.response) {
                // Only reachable if a caller overrides validateStatus.
                report(error.response);
                return Promise.reject(error);
            }
            // No response: timeout, DNS failure, CORS refusal, abort.
            const config: InternalAxiosRequestConfig | undefined = error.config;
            const meta = config?.meta;
            m.error("api.request.network_error", {
                requestId: meta?.requestId,
                data: {
                    method: (config?.method ?? "").toUpperCase(),
                    url: stripQuery(config?.url ?? ""),
                    error_code: error.code,
                    error_message: error.message,
                    attempts: meta?.attempt ?? 1,
                    duration_ms: durationSince(meta),
                },
            });
            return Promise.reject(error);
        },
    );
};

type Reportable = { message?: unknown; stack?: unknown; digest?: unknown; name?: unknown };

/** Reports an error caught by an error boundary or a handler. */
export const reportError = (
    name: string,
    error: unknown,
    data: Record<string, unknown> = {},
): void => {
    if (!monitor) return;
    const e = (typeof error === "object" && error !== null ? error : {}) as Reportable;
    monitor.error(name, {
        data: {
            ...data,
            message: typeof e.message === "string" ? e.message : String(error),
            error_type: typeof e.name === "string" ? e.name : undefined,
            stack: typeof e.stack === "string" ? e.stack : undefined,
            digest: typeof e.digest === "string" ? e.digest : undefined,
            path: window.location.pathname,
        },
    });
};

/**
 * Reports an exception a handler caught and recovered from (it showed an
 * error, fell back to a default, …). `feature` names the place, e.g.
 * "login.local.complete".
 *
 * Only for exceptions: fetchApi never throws, and a failed API call (`!res.success`)
 * is already reported by the axios reporter above.
 */
export const reportCaught = (feature: string, error: unknown, data: Record<string, unknown> = {}): void =>
    reportError("client.error.caught", error, { ...data, feature });

/** Mirrors a condition the app otherwise only logs to the console. */
export const reportWarn = (name: string, data: Record<string, unknown> = {}): void => {
    monitor?.warn(name, { data });
};

const warnedOnce = new Set<string>();

/** Like reportWarn, but at most once per page load for the same name. */
export const reportWarnOnce = (name: string, data: Record<string, unknown> = {}): void => {
    if (!monitor || warnedOnce.has(name)) return;
    warnedOnce.add(name);
    monitor.warn(name, { data });
};

/** The host of a URL (relative URLs resolve against this page), or undefined. */
export const hostOf = (url: string): string | undefined => {
    try {
        return new URL(url, typeof window === "undefined" ? undefined : window.location.origin).host;
    } catch {
        return undefined;
    }
};

// ─── Sign-in flow ───────────────────────────────────────────────────────────
// None of these read anything the visitor typed or any token: only the status,
// the API's numeric error_code and the request id. Never the email, password,
// Google id_token, oauth_request_token, code, state or a full redirect URL.

export type LoginMethod = "local" | "google";

/** A sign-in attempt the API refused or could not answer. */
export const reportLoginFailed = (method: LoginMethod, res: ApiError): void => {
    monitor?.emit("auth.login.failed", sessionFailureLevel(res.status), {
        requestId: res.request_id,
        data: {
            method,
            status_code: res.status,
            error_code: res.error_code,
            request_id: res.request_id,
        },
    });
};

/**
 * /oauth/complete failed, after a sign-in (`auto: false`) or for an
 * already-signed-in visitor (`auto: true`). A 400 is an expired or reused
 * authorization request — the visitor's to retry — so warn; 401/403 info;
 * 5xx or no response error.
 */
export const reportOAuthCompleteFailed = (res: ApiError, auto: boolean): void => {
    monitor?.emit("oauth.complete.failed", sessionFailureLevel(res.status), {
        requestId: res.request_id,
        data: {
            status_code: res.status,
            error_code: res.error_code,
            request_id: res.request_id,
            auto,
        },
    });
};

/**
 * A redirect target failed isTrustedRedirect and the default was used instead.
 * Only the host is reported: the path and query can carry codes and tokens.
 */
export const reportUntrustedRedirect = (url: string, source: string): void => {
    reportWarn("login.redirect_untrusted", { host: hostOf(url), source });
};
