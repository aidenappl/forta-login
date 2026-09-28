import { NextResponse } from "next/server";
import { runtimeGoogleClientId } from "@/lib/google-client-id";

// Read the environment per request, never at build time.
export const dynamic = "force-dynamic";

/** Public runtime config for the browser. Everything here is non-secret. */
export const GET = () =>
    NextResponse.json(
        { google_client_id: runtimeGoogleClientId() },
        { headers: { "Cache-Control": "public, max-age=300" } },
    );
