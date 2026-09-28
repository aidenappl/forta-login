/**
 * The Google OAuth client id forta-login signs in with, read from the
 * container environment at request time. A NEXT_PUBLIC_* value is only
 * inlined into the browser bundle at build time, so one set on the running
 * container never reaches the client — this is served by /api/config instead.
 *
 * Only NEXT_FORTA_PUBLIC_GOOGLE_CLIENT_ID is read: the plain
 * NEXT_PUBLIC_GOOGLE_CLIENT_ID Keyring key is shared with another app, and its
 * client id would make forta-api reject every Google sign-in. It must be the
 * same client id as forta-api's GOOGLE_CLIENT_ID, which validates the token.
 */
const RUNTIME_KEYS = ["NEXT_FORTA_PUBLIC_GOOGLE_CLIENT_ID"] as const;

export const runtimeGoogleClientId = (env: Record<string, string | undefined> = process.env): string | null => {
    for (const key of RUNTIME_KEYS) {
        const value = env[key]?.trim();
        if (value) return value;
    }
    return null;
};
