import { ApiResponse } from "@/types";
import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import { attachMonitor, monitor, newClientRequestId, sessionFailureLevel, stripQuery } from "./monitor.service";

const BASE_API_URL = process.env.NEXT_PUBLIC_API_URL || "https://auth.appleby.cloud";

const axiosApi = axios.create({
    baseURL: BASE_API_URL,
    headers: {
        "Content-Type": "application/json",
    },
    validateStatus: () => true,
    withCredentials: true,
    timeout: 10000,
});

const REQUEST_ID_HEADER = "X-Request-ID";

// Every call carries an X-Request-ID, so a browser event — even a timeout that
// never got a response — can be matched to forta-api's request. Kept on
// config.meta for the Monitor reporter.
axiosApi.interceptors.request.use((config) => {
    const existing = config.headers.get(REQUEST_ID_HEADER);
    const requestId = typeof existing === "string" && existing !== "" ? existing : newClientRequestId();
    config.headers.set(REQUEST_ID_HEADER, requestId);
    config.meta = { ...config.meta, requestId, startTime: Date.now() };
    return config;
});

attachMonitor(axiosApi);

/**
 * Calls whose 401 is an answer, not an expired access token: wrong
 * credentials, a rejected Google token, no session to complete an OAuth
 * request with, or the refresh itself. Refreshing and retrying cannot change
 * the outcome, so they skip the refresh path.
 */
const NO_REFRESH_PATHS = new Set(["/auth/login", "/auth/google", "/auth/refresh", "/auth/logout", "/oauth/complete"]);

/**
 * Sign-in and session calls, where a 401/403 is expected and is reported at
 * info rather than warn. /auth/self is here because a signed-out visitor is
 * the normal case on a login page.
 */
const AUTH_FLOW_PATHS = new Set([...NO_REFRESH_PATHS, "/auth/self"]);

/** The path of a request URL relative to the API, without query or trailing slash. */
const pathOf = (url: string | undefined): string => {
    const path = stripQuery(url ?? "");
    const rel = path.startsWith(BASE_API_URL) ? path.slice(BASE_API_URL.length) : path;
    return rel.replace(/\/+$/, "") || "/";
};

export const fetchApi = async <T>(
    config: AxiosRequestConfig,
): Promise<ApiResponse<T>> => {
    const path = pathOf(config.url);
    const attemptConfig: AxiosRequestConfig = {
        ...config,
        meta: { ...config.meta, attempt: 1, authFlow: AUTH_FLOW_PATHS.has(path) },
    };
    try {
        const response = await executeRequest<T>(attemptConfig);

        if (response.status === 401 && !NO_REFRESH_PATHS.has(path)) {
            const refreshResult = await handle401Response<T>(attemptConfig);
            if (refreshResult) return refreshResult;
        }

        return response;
    } catch (err: unknown) {
        const axiosError = err instanceof AxiosError ? err : undefined;
        return {
            success: false,
            status: axiosError?.response?.status ?? 500,
            error: "request_failed",
            error_message: axiosError?.message ?? "Request failed unexpectedly",
            error_code: -1,
            request_id: axiosError?.config?.meta?.requestId,
        };
    }
};

// ─── Token refresh ──────────────────────────────────────────────────────────
// forta-api's /auth/refresh reads the forta-refresh-token cookie and answers
// by setting fresh HttpOnly auth cookies. Its body is an AuthResponse whose
// access token sits at data.authorization.access_token — there is no
// data.token — and the browser never needs it: the retried request
// authenticates with the new cookies, exactly like the first attempt.
//
// Concurrent 401s share one refresh through refreshPromise.

const MAX_REFRESH_ATTEMPTS = 2;

let refreshPromise: Promise<boolean> | null = null;

/** The outcome of one /auth/refresh attempt that did not succeed. */
type RefreshFailure = {
    requestId: string;
    status?: number;
    body?: { error?: unknown; error_message?: unknown; error_code?: unknown };
    error?: unknown;
};

/**
 * Reports a refresh that finally failed (after any retry). A 401/403 means the
 * session is genuinely over — expected, so info. A 5xx or no response at all
 * means the API could not refresh a session that may still be valid — an
 * error. Anything else (429, other 4xx) is a warning.
 */
const reportRefreshFailure = (f: RefreshFailure, attempts: number): void => {
    if (!monitor) return;
    const body = f.body ?? {};
    const err = f.error instanceof Error ? f.error : undefined;
    monitor.emit("auth.refresh.failed", sessionFailureLevel(f.status), {
        requestId: f.requestId,
        data: {
            status_code: f.status,
            error: typeof body.error === "string" ? body.error : undefined,
            error_code:
                typeof body.error_code === "number"
                    ? body.error_code
                    : err instanceof AxiosError
                      ? err.code
                      : undefined,
            error_message:
                typeof body.error_message === "string" ? body.error_message : err ? err.message : undefined,
            attempts,
        },
    });
};

/** A response header by case-insensitive name, or undefined when absent or empty. */
const headerString = (headers: unknown, name: string): string | undefined => {
    if (typeof headers !== "object" || headers === null) return undefined;
    for (const [k, v] of Object.entries(headers)) {
        if (k.toLowerCase() === name && typeof v === "string" && v !== "") return v;
    }
    return undefined;
};

/** One refresh, retried once on a transient failure. true when the cookies were renewed. */
const doRefresh = async (): Promise<boolean> => {
    let failure: RefreshFailure | null = null;
    let attempts = 0;
    for (let attempt = 1; attempt <= MAX_REFRESH_ATTEMPTS; attempt++) {
        attempts = attempt;
        // A bare axios call, not axiosApi (whose 401 handling would recurse), so
        // it sets its own X-Request-ID.
        const requestId = newClientRequestId();
        try {
            const refreshResponse = await axios.post(
                `${BASE_API_URL}/auth/refresh`,
                {},
                {
                    withCredentials: true,
                    validateStatus: () => true,
                    timeout: 10000,
                    headers: { [REQUEST_ID_HEADER]: requestId },
                },
            );

            if (refreshResponse.status === 200 && refreshResponse.data?.success) {
                return true;
            }

            failure = {
                requestId: headerString(refreshResponse.headers, "x-request-id") ?? requestId,
                status: refreshResponse.status,
                body:
                    typeof refreshResponse.data === "object" && refreshResponse.data !== null
                        ? refreshResponse.data
                        : undefined,
            };

            // Definitive: no valid refresh token, or the account/grant refused.
            if (refreshResponse.status === 401 || refreshResponse.status === 403) {
                break;
            }
        } catch (err: unknown) {
            // Network error — retried below
            failure = { requestId, error: err };
        }

        // Transient error (429, 5xx, network) — retry once after a brief pause
        if (attempt < MAX_REFRESH_ATTEMPTS) {
            await new Promise((r) => setTimeout(r, 1000));
        }
    }
    if (failure) reportRefreshFailure(failure, attempts);
    return false;
};

/** Shared entry point — deduplicates concurrent refresh calls. */
const getRefreshPromise = (): Promise<boolean> => {
    if (!refreshPromise) {
        refreshPromise = doRefresh().finally(() => {
            refreshPromise = null;
        });
    }
    return refreshPromise;
};

const handle401Response = async <T>(
    originalConfig: AxiosRequestConfig,
): Promise<ApiResponse<T> | null> => {
    const refreshed = await getRefreshPromise();
    if (!refreshed) return null;
    // Retried on the renewed cookies — no Authorization header.
    return await executeRequest<T>({
        ...originalConfig,
        meta: { ...originalConfig.meta, attempt: (originalConfig.meta?.attempt ?? 1) + 1 },
    });
};

const executeRequest = async <T>(
    config: AxiosRequestConfig,
): Promise<ApiResponse<T>> => {
    const response: AxiosResponse = await axiosApi.request(config);

    if (response.data?.success) {
        return {
            success: true,
            status: response.status,
            message: response.data.message,
            data: response.data.data as T,
        };
    }

    const echoedId = headerString(response.headers, "x-request-id");
    return {
        success: false,
        status: response.status,
        error: response.data?.error ?? "unknown_error",
        error_message: response.data?.error_message ?? "An unexpected error occurred",
        error_code: response.data?.error_code ?? 0,
        request_id: echoedId ?? response.config?.meta?.requestId,
    };
};
