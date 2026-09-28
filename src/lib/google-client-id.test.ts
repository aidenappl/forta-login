import { describe, expect, it } from "vitest";
import { runtimeGoogleClientId } from "./google-client-id";

describe("runtimeGoogleClientId", () => {
    it.each([
        ["prefers the renamed Forta key", { NEXT_FORTA_PUBLIC_GOOGLE_CLIENT_ID: "forta-id", NEXT_PUBLIC_GOOGLE_CLIENT_ID: "other-id" }, "forta-id"],
        ["never reads the shared NEXT_PUBLIC key", { NEXT_PUBLIC_GOOGLE_CLIENT_ID: "other-app-id" }, null],
        ["ignores blank values", { NEXT_FORTA_PUBLIC_GOOGLE_CLIENT_ID: "  " }, null],
        ["is null when unset", {}, null],
    ])("%s", (_name, env, want) => {
        expect(runtimeGoogleClientId(env)).toBe(want);
    });
});
