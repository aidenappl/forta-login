import { describe, expect, it } from "vitest";
import { isSensitiveKey, scrubEvent } from "./monitor-scrub";

describe("scrubEvent", () => {
    it("strips oauth_request_token, redirect_uri and every query from URL-like strings", () => {
        const out = scrubEvent({
            name: "client.navigation",
            level: "info",
            request_id: "fedcba9876543210",
            data: {
                url: "/?oauth_request_token=tok-SECRET&redirect_uri=https%3A%2F%2Fapp.example.com",
                path: "/logout?x=1",
                from: "/oauth/logout#frag",
                href: "https://login.appleby.cloud/?oauth_request_token=tok-SECRET",
                page: "https://login.appleby.cloud/?redirect_uri=https://x.example.com/cb",
                relative: "/?oauth_request_token=tok-SECRET",
                message: "Failed to fetch https://auth.appleby.cloud/oauth/complete?oauth_request_token=tok-SECRET at step 2",
                status_code: 401,
            },
        });
        const serialized = JSON.stringify(out);
        expect(serialized).not.toContain("tok-SECRET");
        expect(serialized).not.toContain("redirect_uri");
        expect(serialized).not.toContain("x.example.com");
        expect(out).toEqual({
            name: "client.navigation",
            level: "info",
            request_id: "fedcba9876543210",
            data: {
                url: "/",
                path: "/logout",
                from: "/oauth/logout",
                href: "https://login.appleby.cloud/",
                page: "https://login.appleby.cloud/",
                relative: "/",
                message: "Failed to fetch https://auth.appleby.cloud/oauth/complete at step 2",
                status_code: 401,
            },
        });
    });

    it("redacts sensitive keys at any depth, case-insensitively", () => {
        const out = scrubEvent({
            name: "x",
            data: {
                Email: "someone@example.com",
                body: {
                    password: "hunter22",
                    ID_TOKEN: "eyJ...",
                    nested: [{ oauth_request_token: "tok" }, { redirect_uri: "https://app.example.com/cb" }],
                },
                credential: "g-cred",
                client_secret: "shh",
                code: "auth-code",
                state: "csrf-state",
                token: "t",
                access_token: "a",
                refresh_token: "r",
                new_password: "p",
                status_code: 401,
                error_code: 4010,
                request_id: "fedcba9876543210",
                oauth_flow: true,
                source_func: "login.local.complete",
            },
        });
        expect(out.data).toEqual({
            Email: "[redacted]",
            body: {
                password: "[redacted]",
                ID_TOKEN: "[redacted]",
                nested: [{ oauth_request_token: "[redacted]" }, { redirect_uri: "[redacted]" }],
            },
            credential: "[redacted]",
            client_secret: "[redacted]",
            code: "[redacted]",
            state: "[redacted]",
            token: "[redacted]",
            access_token: "[redacted]",
            refresh_token: "[redacted]",
            new_password: "[redacted]",
            status_code: 401,
            error_code: 4010,
            request_id: "fedcba9876543210",
            oauth_flow: true,
            source_func: "login.local.complete",
        });
    });

    it("keeps status_code, error_code and similar keys", () => {
        const keep = ["status_code", "error_code", "request_id", "trace_id", "oauth_flow", "method", "host", "encoded"];
        keep.forEach((k) => expect(isSensitiveKey(k)).toBe(false));
    });
});
