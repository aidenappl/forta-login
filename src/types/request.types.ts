/**
 * Per-request bookkeeping carried on the axios config. The request interceptor
 * in api.service.ts adds the request id and start time; fetchApi adds the
 * attempt and whether the call is part of the sign-in flow; the Monitor
 * reporter in monitor.service.ts reads all of it. Axios deep-merges unknown
 * config keys, so `meta` survives from the caller's config to
 * `response.config` / `error.config`.
 */
export type RequestMeta = {
    /** The X-Request-ID sent with this request. */
    requestId?: string;
    /** Date.now() when the request left the request interceptor. */
    startTime?: number;
    /** 1-based attempt number (2 for the retry after a token refresh). */
    attempt?: number;
    /**
     * A sign-in or session call (/auth/login, /auth/google, /auth/self,
     * /oauth/complete, …) where a 401/403 is an expected answer — bad
     * credentials, not signed in — rather than a fault, so it is reported at
     * info, not warn.
     */
    authFlow?: boolean;
};

declare module "axios" {
    interface AxiosRequestConfig {
        meta?: RequestMeta;
    }
}
