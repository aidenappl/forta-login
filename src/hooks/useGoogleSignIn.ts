"use client";

import { useEffect, useCallback } from "react";
import "@/types/google.types";
import { monitor, reportWarn, reportWarnOnce } from "@/services/monitor.service";

const GSI_SRC = "https://accounts.google.com/gsi/client";

type GoogleSignInCallback = (credential: string) => void;

let clientIdPromise: Promise<string | null> | null = null;

/**
 * The Google client id: the build-time NEXT_PUBLIC value when the image was
 * built with one, else the container's runtime value from /api/config.
 * Fetched once per page load.
 */
export const resolveGoogleClientId = (): Promise<string | null> => {
    const built = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (built) return Promise.resolve(built);
    clientIdPromise ??= fetch("/api/config")
        .then((res) => (res.ok ? res.json() : null))
        .then((body: { google_client_id?: unknown } | null) =>
            typeof body?.google_client_id === "string" && body.google_client_id !== "" ? body.google_client_id : null,
        )
        .catch(() => {
            clientIdPromise = null;
            return null;
        });
    return clientIdPromise;
};

export function useGoogleSignIn(onSignIn: GoogleSignInCallback) {
    const handleCredentialResponse = useCallback(
        (response: { credential: string }) => {
            onSignIn(response.credential);
        },
        [onSignIn],
    );

    useEffect(() => {
        let cancelled = false;
        let script: HTMLScriptElement | null = null;

        resolveGoogleClientId().then((clientId) => {
            if (cancelled) return;
            if (!clientId) {
                // Neither the build nor the container has a Google client id,
                // so the Google button can never work.
                reportWarnOnce("login.google.unconfigured");
                return;
            }

            script = document.createElement("script");
            script.src = GSI_SRC;
            script.async = true;
            script.defer = true;
            script.onload = () => {
                window.google?.accounts.id.initialize({
                    client_id: clientId,
                    callback: handleCredentialResponse,
                });
            };
            script.onerror = () => {
                // Blocked (ad/tracker blocker, CSP, offline) or Google unreachable.
                monitor?.warn("login.google.script_failed", { data: { src: GSI_SRC } });
            };
            document.body.appendChild(script);
        });

        return () => {
            cancelled = true;
            if (script?.parentNode) script.parentNode.removeChild(script);
        };
    }, [handleCredentialResponse]);

    const promptGoogleSignIn = useCallback(() => {
        if (!window.google) {
            // The button was pressed but Google Identity Services never loaded
            // (unconfigured, blocked, or still loading), so nothing happens.
            reportWarn("login.google.prompt_unavailable", {
                configured_at_build: Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID),
            });
            return;
        }
        window.google.accounts.id.prompt();
    }, []);

    return { promptGoogleSignIn };
}
