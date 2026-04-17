"use client";

import { useEffect } from "react";
import { FortaLogo } from "@/components/FortaLogo";

const FORTA_HOME = process.env.NEXT_PUBLIC_FORTA_HOME || "https://forta.appleby.cloud";

export default function OAuthLogout() {
  useEffect(() => {
    document.title = "Signing out… | Forta";
  }, []);

  useEffect(() => {
    // TODO: log the OAuth logout action

    // Redirect to Forta home without touching the Forta session
    const timer = setTimeout(() => {
      window.location.href = FORTA_HOME;
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-neutral-950">
      <div className="flex flex-col items-center gap-4">
        <FortaLogo className="w-12 h-12 shadow-md rounded-xl" />
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 dark:border-gray-600 dark:border-t-gray-300 rounded-full animate-spin" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Signing out…
          </p>
        </div>
      </div>
    </main>
  );
}
