import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useGoogleSignIn } from "./useGoogleSignIn";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Harness({ onSignIn }: { onSignIn: (c: string) => void }) {
    const { buttonRef } = useGoogleSignIn(onSignIn);
    return createElement("div", { ref: buttonRef });
}

afterEach(() => {
    vi.unstubAllEnvs();
    delete window.google;
});

describe("useGoogleSignIn", () => {
    // Re-initializing aborts Google's in-flight FedCM request, which is what
    // made the button do nothing: the sign-in callback changes on most renders.
    it("initializes Google once across re-renders and calls the newest callback", async () => {
        vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "123-abc.apps.googleusercontent.com");
        const initialize = vi.fn();
        const renderButton = vi.fn();
        window.google = { accounts: { id: { initialize, renderButton, prompt: vi.fn() } } };

        const first = vi.fn();
        const second = vi.fn();
        const root = createRoot(document.createElement("div"));
        await act(async () => root.render(createElement(Harness, { onSignIn: first })));
        await act(async () => root.render(createElement(Harness, { onSignIn: second })));
        await act(async () => root.render(createElement(Harness, { onSignIn: second })));

        expect(initialize).toHaveBeenCalledTimes(1);
        expect(initialize.mock.calls[0][0].client_id).toBe("123-abc.apps.googleusercontent.com");
        expect(renderButton).toHaveBeenCalled();

        const callback = initialize.mock.calls[0][0].callback as (r: { credential: string }) => void;
        callback({ credential: "id-token" });
        expect(second).toHaveBeenCalledWith("id-token");
        expect(first).not.toHaveBeenCalled();

        await act(async () => root.unmount());
    });
});
