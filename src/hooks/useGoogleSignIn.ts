"use client";

import { useEffect, useRef, useState } from "react";
import "@/types/google.types";
import { monitor, reportWarnOnce } from "@/services/monitor.service";

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

let scriptPromise: Promise<boolean> | null = null;

/** Loads Google Identity Services once per page; resolves false if it fails. */
const loadGsiScript = (): Promise<boolean> => {
    if (window.google?.accounts?.id) return Promise.resolve(true);
    scriptPromise ??= new Promise<boolean>((resolve) => {
        const script = document.createElement("script");
        script.src = GSI_SRC;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve(true);
        script.onerror = () => {
            // Blocked (ad/tracker blocker, CSP, offline) or Google unreachable.
            monitor?.warn("login.google.script_failed", { data: { src: GSI_SRC } });
            scriptPromise = null;
            script.remove();
            resolve(false);
        };
        document.body.appendChild(script);
    });
    return scriptPromise;
};

// initialize() may only run once per page: a second call aborts Google's
// in-flight FedCM credential request ("signal is aborted without reason").
let initialized = false;
let latestCallback: GoogleSignInCallback | null = null;

/**
 * Google sign-in through Google's own rendered button. It opens the account
 * chooser on every click, unlike One Tap's prompt(), which Chrome suppresses
 * for a cooldown after a dismissal. Attach `buttonRef` to an empty element;
 * `ready` turns true once the button is rendered into it.
 */
export function useGoogleSignIn(onSignIn: GoogleSignInCallback) {
    const buttonRef = useRef<HTMLDivElement>(null);
    const [ready, setReady] = useState(false);

    // The newest handler without re-running the effect: onSignIn changes on
    // most renders, and re-initializing would cancel a sign-in in progress.
    useEffect(() => {
        latestCallback = onSignIn;
    }, [onSignIn]);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            const clientId = await resolveGoogleClientId();
            if (cancelled) return;
            if (!clientId) {
                // Neither the build nor the container has a Google client id,
                // so Google sign-in can never work.
                reportWarnOnce("login.google.unconfigured");
                return;
            }
            if (!(await loadGsiScript()) || cancelled) return;

            const gsi = window.google?.accounts.id;
            const el = buttonRef.current;
            if (!gsi || !el) return;

            if (!initialized) {
                gsi.initialize({
                    client_id: clientId,
                    callback: (response) => latestCallback?.(response.credential),
                });
                initialized = true;
            }

            const dark = document.documentElement.classList.contains("dark");
            gsi.renderButton(el, {
                type: "standard",
                theme: dark ? "filled_black" : "outline",
                size: "large",
                text: "continue_with",
                shape: "rectangular",
                logo_alignment: "center",
                // GIS caps the width at 400px.
                width: Math.min(Math.max(Math.round(el.clientWidth), 200), 400),
            });
            setReady(true);
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    return { buttonRef, ready };
}
