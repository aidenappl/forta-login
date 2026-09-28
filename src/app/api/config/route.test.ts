import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/config", () => {
    it("serves the container's Google client id at request time", async () => {
        vi.stubEnv("NEXT_FORTA_PUBLIC_GOOGLE_CLIENT_ID", "123-abc.apps.googleusercontent.com");
        const body = await GET().json();
        expect(body).toEqual({ google_client_id: "123-abc.apps.googleusercontent.com" });
    });

    it("serves null when nothing is configured", async () => {
        vi.stubEnv("NEXT_FORTA_PUBLIC_GOOGLE_CLIENT_ID", "");
        vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "");
        expect(await GET().json()).toEqual({ google_client_id: null });
    });
});
