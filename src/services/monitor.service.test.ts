import { Monitor } from "@aidenappleby/monitor-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApiError } from "@/types";
import {
    hostOf,
    monitor,
    normaliseRoute,
    RELEASE,
    reportCaught,
    reportLoginFailed,
    reportOAuthCompleteFailed,
    reportUntrustedRedirect,
    sessionFailureLevel,
} from "./monitor.service";

afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, "", "/");
});

const baseEmit = () => vi.spyOn(Monitor.prototype, "emit").mockImplementation(() => {});

describe("normaliseRoute", () => {
    const cases: [string, string][] = [
        ["/", "/"],
        ["", "/"],
        ["/logout", "/logout"],
        ["/logout/", "/logout"],
        ["/oauth/logout?x=1#y", "/oauth/logout"],
    ];
    cases.forEach(([path, want]) => {
        it(`${JSON.stringify(path)} → ${want}`, () => {
            expect(normaliseRoute(path)).toBe(want);
        });
    });
});

describe("event context", () => {
    it("adds route, release and oauth_flow to every event, keeping the event's own data", () => {
        const base = baseEmit();
        window.history.replaceState(null, "", "/logout?next=secret");
        monitor!.warn("test.event", { requestId: "abc", data: { foo: 1 } });
        expect(base).toHaveBeenCalledWith("test.event", "warn", {
            requestId: "abc",
            data: { release: RELEASE, route: "/logout", oauth_flow: false, foo: 1 },
        });
    });

    it("sets oauth_flow from the presence of oauth_request_token, never its value", () => {
        const base = baseEmit();
        window.history.replaceState(null, "", "/?oauth_request_token=tok-SECRET&redirect_uri=https%3A%2F%2Fapp.example.com%2Fcb%3Fcode%3Dx");
        monitor!.info("test.event");
        const data = base.mock.calls[0][2]?.data;
        expect(data).toMatchObject({ route: "/", oauth_flow: true });
        expect(JSON.stringify(base.mock.calls[0])).not.toContain("tok-SECRET");
        expect(JSON.stringify(base.mock.calls[0])).not.toContain("app.example.com");
    });

    it("lets an event override route", () => {
        const base = baseEmit();
        monitor!.info("test.event", { data: { route: "/custom" } });
        expect(base.mock.calls[0][2]?.data).toMatchObject({ route: "/custom" });
    });

    it("copies feature into source_func", () => {
        const base = baseEmit();
        reportCaught("login.local.complete", new Error("boom"));
        const [name, level, opts] = base.mock.calls[0];
        expect(name).toBe("client.error.caught");
        expect(level).toBe("error");
        expect(opts?.data).toMatchObject({ feature: "login.local.complete", source_func: "login.local.complete", message: "boom" });
    });
});

describe("sessionFailureLevel", () => {
    const cases: [number | undefined, string][] = [
        [401, "info"],
        [403, "info"],
        [400, "warn"],
        [429, "warn"],
        [500, "error"],
        [503, "error"],
        [undefined, "error"],
    ];
    cases.forEach(([status, want]) => {
        it(`${status} → ${want}`, () => {
            expect(sessionFailureLevel(status)).toBe(want);
        });
    });
});

const failure = (status: number, extra: Partial<ApiError> = {}): ApiError => ({
    success: false,
    status,
    error: "unauthorized",
    error_message: "no account for someone@example.com with password hunter22",
    error_code: status === 500 ? -1 : 4010,
    request_id: "fedcba9876543210fedcba9876543210",
    ...extra,
});

describe("reportLoginFailed", () => {
    const cases: { method: "local" | "google"; status: number; want: string }[] = [
        { method: "local", status: 401, want: "info" },
        { method: "google", status: 401, want: "info" },
        { method: "local", status: 429, want: "warn" },
        { method: "local", status: 500, want: "error" },
        { method: "google", status: 502, want: "error" },
    ];
    cases.forEach(({ method, status, want }) => {
        it(`${method} ${status} → ${want}, with only status, error_code and request id`, () => {
            const base = baseEmit();
            reportLoginFailed(method, failure(status));
            expect(base).toHaveBeenCalledTimes(1);
            const [name, level, opts] = base.mock.calls[0];
            expect(name).toBe("auth.login.failed");
            expect(level).toBe(want);
            expect(opts?.requestId).toBe("fedcba9876543210fedcba9876543210");
            expect(opts?.data).toMatchObject({
                method,
                status_code: status,
                error_code: status === 500 ? -1 : 4010,
                request_id: "fedcba9876543210fedcba9876543210",
            });
            const serialized = JSON.stringify(base.mock.calls[0]);
            expect(serialized).not.toContain("someone@example.com");
            expect(serialized).not.toContain("hunter22");
            expect(serialized).not.toMatch(/"(email|password|id_token|credential)"/);
        });
    });
});

describe("reportOAuthCompleteFailed", () => {
    it("reports auto and the ids, never a token", () => {
        const base = baseEmit();
        window.history.replaceState(null, "", "/?oauth_request_token=tok-SECRET");
        reportOAuthCompleteFailed(failure(400), true);
        const [name, level, opts] = base.mock.calls[0];
        expect(name).toBe("oauth.complete.failed");
        expect(level).toBe("warn");
        expect(opts?.data).toMatchObject({ status_code: 400, error_code: 4010, auto: true, oauth_flow: true });
        expect(JSON.stringify(base.mock.calls[0])).not.toContain("tok-SECRET");
    });
});

describe("reportUntrustedRedirect", () => {
    it("reports only the host", () => {
        const base = baseEmit();
        reportUntrustedRedirect("https://evil.example.com/cb?code=abc&state=xyz", "login");
        const [name, level, opts] = base.mock.calls[0];
        expect(name).toBe("login.redirect_untrusted");
        expect(level).toBe("warn");
        expect(opts?.data).toMatchObject({ host: "evil.example.com", source: "login" });
        const serialized = JSON.stringify(base.mock.calls[0]);
        expect(serialized).not.toContain("/cb");
        expect(serialized).not.toContain("code=abc");
    });

    it("hostOf is undefined for garbage", () => {
        expect(hostOf("http://")).toBeUndefined();
    });
});
