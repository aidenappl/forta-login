"use client";

import { useEffect, useCallback } from "react";
import "@/types/google.types";

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
        if (!clientId) return;

        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = () => {
            window.google?.accounts.id.initialize({
                client_id: clientId,
                callback: handleCredentialResponse,
            });
        };
        document.body.appendChild(script);

        return () => {
            document.body.removeChild(script);
        };
    }, [handleCredentialResponse]);

    const promptGoogleSignIn = useCallback(() => {
        window.google?.accounts.id.prompt();
    }, []);

    return { promptGoogleSignIn };
}
