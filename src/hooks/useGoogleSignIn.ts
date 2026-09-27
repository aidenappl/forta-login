"use client";

import { useEffect, useCallback } from "react";
import "@/types/google.types";
import { monitor, reportWarn, reportWarnOnce } from "@/services/monitor.service";

const GSI_SRC = "https://accounts.google.com/gsi/client";

type GoogleSignInCallback = (credential: string) => void;

export function useGoogleSignIn(onSignIn: GoogleSignInCallback) {
    const handleCredentialResponse = useCallback(
        (response: { credential: string }) => {
            onSignIn(response.credential);
        },
        [onSignIn],
    );

    useEffect(() => {
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
        if (!clientId) {
            // The build was made without NEXT_PUBLIC_GOOGLE_CLIENT_ID, so the
            // Google button can never work.
            reportWarnOnce("login.google.unconfigured");
            return;
        }

        const script = document.createElement("script");
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

        return () => {
            document.body.removeChild(script);
        };
    }, [handleCredentialResponse]);

    const promptGoogleSignIn = useCallback(() => {
        if (!window.google) {
            // The button was pressed but Google Identity Services never loaded
            // (unconfigured, blocked, or still loading), so nothing happens.
            reportWarn("login.google.prompt_unavailable", {
                configured: Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID),
            });
            return;
        }
        window.google.accounts.id.prompt();
    }, []);

    return { promptGoogleSignIn };
}
