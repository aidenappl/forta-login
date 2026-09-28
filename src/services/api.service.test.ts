import axios, { AxiosError, AxiosHeaders, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import type { Monitor } from "@aidenappleby/monitor-js";
import type { RequestMeta } from "@/types";
import { fetchApi } from "./api.service";
import { monitor } from "./monitor.service";

type Outcome = { status: number; data?: unknown; headers?: Record<string, string> } | "network";

type Sent = { id: string; authorization: unknown; meta: RequestMeta | undefined };

/** An adapter that plays back one outcome per request and records what was sent. */
const playback = (outcomes: Outcome[], sent: Sent[]): AxiosAdapter => {
    let i = 0;
    return async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        sent.push({
            id: String(config.headers.get("X-Request-ID")),
            authorization: config.headers.get("Authorization"),
            meta: config.meta,
        });
        const outcome = outcomes[Math.min(i++, outcomes.length - 1)];
        if (outcome === "network") {
            throw new AxiosError("timeout of 10000ms exceeded", "ECONNABORTED", config);
        }
        return {
            data: outcome.data ?? {},
            status: outcome.status,
            statusText: "",
            headers: new AxiosHeaders(outcome.headers ?? {}),
            config,
        };
    };
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const OK = { status: 200, data: { success: true, message: "OK", data: {} } };
const UNAUTHORIZED = { status: 401, data: { success: false, error: "unauthorized", error_message: "invalid credentials", error_code: 401 } };

describe("fetchApi", () => {
    let emit: MockInstance<Monitor["emit"]>;
    let post: MockInstance<typeof axios.post>;

    beforeEach(() => {
        emit = vi.spyOn(monitor!, "emit").mockImplementation(() => {});
        post = vi.spyOn(axios, "post");
    });

    afterEach(() => {
        emit.mockRestore();
        post.mockRestore();
        vi.useRealTimers();
    });

    const apiEvents = () => emit.mock.calls.filter((c) => String(c[0]).startsWith("api.request."));
    const refreshEvents = () => emit.mock.calls.filter((c) => c[0] === "auth.refresh.failed");
    const sentRefreshIds = () =>
        post.mock.calls.map((c) => (c[2]?.headers as Record<string, string> | undefined)?.["X-Request-ID"]);

    describe("X-Request-ID", () => {
        it("sends a UUID and keeps it with the start time on config.meta", async () => {
            const sent: Sent[] = [];
            const res = await fetchApi({ method: "GET", url: "/auth/self", adapter: playback([OK], sent) });
            expect(res.success).toBe(true);
            expect(sent).toHaveLength(1);
            expect(sent[0].id).toMatch(UUID);
            expect(sent[0].meta?.requestId).toBe(sent[0].id);
            expect(typeof sent[0].meta?.startTime).toBe("number");
            expect(sent[0].meta?.attempt).toBe(1);
        });

        it("sends a different id on every call", async () => {
            const sent: Sent[] = [];
            await fetchApi({ method: "GET", url: "/auth/self", adapter: playback([OK], sent) });
            await fetchApi({ method: "GET", url: "/auth/self", adapter: playback([OK], sent) });
            expect(sent[0].id).not.toBe(sent[1].id);
        });

        it("keeps a caller-supplied X-Request-ID", async () => {
            const sent: Sent[] = [];
            const own = "0123456789abcdef0123456789abcdef";
            await fetchApi({ method: "POST", url: "/auth/login", headers: { "X-Request-ID": own }, adapter: playback([OK], sent) });
            expect(sent.map((s) => s.id)).toEqual([own]);
        });
    });

    describe("Monitor reporting", () => {
        it("reports a network error with the id it sent, and returns that id", async () => {
            const sent: Sent[] = [];
            const res = await fetchApi({ method: "POST", url: "/oauth/complete?oauth_request_token=secret", adapter: playback(["network"], sent) });
            expect(res.success).toBe(false);
            expect(!res.success && res.request_id).toBe(sent[0].id);
            const events = apiEvents();
            expect(events).toHaveLength(1);
            const [name, level, opts] = events[0];
            expect(name).toBe("api.request.network_error");
            expect(level).toBe("error");
            expect(opts?.requestId).toBe(sent[0].id);
            expect(opts?.data).toMatchObject({ method: "POST", url: "/oauth/complete", error_code: "ECONNABORTED", attempts: 1 });
            expect(JSON.stringify(opts)).not.toContain("secret");
        });

        it("reports a server error with the API's echoed ids and numeric error_code", async () => {
            const echoed = "fedcba9876543210fedcba9876543210";
            const trace = "0af7651916cd43dd8448eb211c80319c";
            const res = await fetchApi({
                method: "GET",
                url: "/auth/self",
                adapter: playback([{ status: 500, data: { success: false, error: "query_error", error_message: "boom", error_code: 5001 }, headers: { "X-Request-ID": echoed, "X-Trace-ID": trace } }], []),
            });
            expect(!res.success && res.request_id).toBe(echoed);
            const events = apiEvents();
            expect(events).toHaveLength(1);
            const [name, level, opts] = events[0];
            expect(name).toBe("api.request.server_error");
            expect(level).toBe("error");
            expect(opts?.requestId).toBe(echoed);
            expect(opts?.traceId).toBe(trace);
            expect(opts?.data).toMatchObject({ method: "GET", url: "/auth/self", status_code: 500, error: "query_error", error_message: "boom", error_code: 5001, attempts: 1 });
        });

        it("reports a client error outside the sign-in flow at warn", async () => {
            await fetchApi({ method: "POST", url: "/auth/code", adapter: playback([{ status: 400, data: { success: false, error: "bad_body", error_code: 4000 } }], []) });
            const events = apiEvents();
            expect(events).toHaveLength(1);
            expect(events[0][0]).toBe("api.request.client_error");
            expect(events[0][1]).toBe("warn");
        });
    });

    describe("a 401 from a sign-in call", () => {
        const paths = ["/auth/login", "/auth/google", "/auth/logout", "/auth/refresh", "/oauth/complete"];
        paths.forEach((url) => {
            it(`${url} does not trigger /auth/refresh and is reported at info`, async () => {
                const sent: Sent[] = [];
                const res = await fetchApi({ method: "POST", url, data: { email: "a@b.c", password: "hunter22" }, adapter: playback([UNAUTHORIZED], sent) });
                expect(res.status).toBe(401);
                expect(post).not.toHaveBeenCalled();
                expect(sent).toHaveLength(1);
                const events = apiEvents();
                expect(events).toHaveLength(1);
                expect(events[0][0]).toBe("api.request.client_error");
                expect(events[0][1]).toBe("info");
                expect(refreshEvents()).toHaveLength(0);
            });
        });
    });

    describe("after a 401 and a successful refresh", () => {
        // forta-api's real /auth/refresh body: an AuthResponse, no data.token.
        const refreshBody = {
            success: true,
            message: "OK",
            data: {
                user: { id: 1 },
                authorization: { access_token: "fresh-access", refresh_token: "fresh-refresh", token_type: "Bearer", expires_in: 900, expires_at: "" },
                is_new_user: false,
            },
        };

        it("retries on the renewed cookies without an Authorization header", async () => {
            post.mockResolvedValue({ status: 200, headers: {}, data: refreshBody });
            const sent: Sent[] = [];
            const res = await fetchApi({ method: "GET", url: "/auth/self", adapter: playback([UNAUTHORIZED, { status: 200, data: { success: true, data: { id: 1 } } }], sent) });
            expect(res.success).toBe(true);
            expect(post).toHaveBeenCalledTimes(1);
            expect(post.mock.calls[0][0]).toMatch(/\/auth\/refresh$/);
            expect(post.mock.calls[0][2]).toMatchObject({ withCredentials: true, timeout: 10000 });
            expect(sentRefreshIds()[0]).toMatch(UUID);
            expect(sent).toHaveLength(2);
            sent.forEach((s) => {
                expect(s.authorization).toBeUndefined();
                expect(String(s.authorization)).not.toContain("Bearer");
            });
            expect(sent[1].id).not.toBe(sent[0].id);
            expect(sent[1].meta?.attempt).toBe(2);
        });

        it("shares one /auth/refresh between concurrent 401s", async () => {
            let release: (v: unknown) => void = () => {};
            post.mockImplementation(() => new Promise((r) => (release = r)));
            const sentA: Sent[] = [];
            const sentB: Sent[] = [];
            const a = fetchApi({ method: "GET", url: "/auth/self", adapter: playback([UNAUTHORIZED, OK], sentA) });
            const b = fetchApi({ method: "GET", url: "/auth/self", adapter: playback([UNAUTHORIZED, OK], sentB) });
            await vi.waitFor(() => expect(post).toHaveBeenCalled());
            // Let the second 401 reach the refresh too.
            await new Promise((r) => setTimeout(r, 10));
            release({ status: 200, headers: {}, data: refreshBody });
            const [resA, resB] = await Promise.all([a, b]);
            expect(resA.success).toBe(true);
            expect(resB.success).toBe(true);
            expect(post).toHaveBeenCalledTimes(1);
            expect(sentA).toHaveLength(2);
            expect(sentB).toHaveLength(2);
        });
    });

    describe("when the refresh fails", () => {
        const run = async <T,>(promise: Promise<T>): Promise<T> => {
            await vi.runAllTimersAsync();
            return promise;
        };

        beforeEach(() => {
            vi.useFakeTimers({ toFake: ["setTimeout"] });
        });

        it("reports a 401 once at info, without retrying, with the id it sent", async () => {
            post.mockResolvedValue({ status: 401, headers: {}, data: { success: false, error: "unauthorized", error_code: 4010 } });
            const sent: Sent[] = [];
            const res = await run(fetchApi({ method: "GET", url: "/auth/self", adapter: playback([UNAUTHORIZED], sent) }));
            expect(res.status).toBe(401);
            expect(!res.success && res.request_id).toBe(sent[0].id);
            expect(post).toHaveBeenCalledTimes(1);
            const events = refreshEvents();
            expect(events).toHaveLength(1);
            const [, level, opts] = events[0];
            expect(level).toBe("info");
            expect(opts?.requestId).toBe(sentRefreshIds()[0]);
            expect(opts?.data).toMatchObject({ status_code: 401, error_code: 4010, attempts: 1 });
        });

        it("reports a 5xx after its retry as one error, with the API's echoed id", async () => {
            const echoed = "fedcba9876543210fedcba9876543210";
            post.mockResolvedValue({ status: 503, headers: { "x-request-id": echoed }, data: { success: false, error: "unavailable", error_code: 5030 } });
            await run(fetchApi({ method: "GET", url: "/auth/self", adapter: playback([UNAUTHORIZED], []) }));
            expect(post).toHaveBeenCalledTimes(2);
            const ids = sentRefreshIds();
            expect(ids[0]).not.toBe(ids[1]);
            const events = refreshEvents();
            expect(events).toHaveLength(1);
            const [, level, opts] = events[0];
            expect(level).toBe("error");
            expect(opts?.requestId).toBe(echoed);
            expect(opts?.data).toMatchObject({ status_code: 503, error_code: 5030, attempts: 2 });
        });

        it("reports a network failure as one error with the last id sent", async () => {
            post.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));
            await run(fetchApi({ method: "GET", url: "/auth/self", adapter: playback([UNAUTHORIZED], []) }));
            expect(post).toHaveBeenCalledTimes(2);
            const events = refreshEvents();
            expect(events).toHaveLength(1);
            const [, level, opts] = events[0];
            expect(level).toBe("error");
            expect(opts?.requestId).toBe(sentRefreshIds()[1]);
            expect(opts?.data).toMatchObject({ status_code: undefined, error_code: "ERR_NETWORK", error_message: "Network Error", attempts: 2 });
        });
    });
});
