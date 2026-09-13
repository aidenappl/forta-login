"use client";

import { useEffect } from "react";
import { FortaLogo } from "@/components/FortaLogo";
import { reportError } from "@/services/monitor.service";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError("client.error.boundary", error);
  }, [error]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-neutral-950">
      <div className="bg-white dark:bg-neutral-900 rounded-xl p-8 shadow-sm border border-gray-100 dark:border-neutral-800 max-w-md w-full text-center">
        <div className="flex items-center justify-center gap-3">
          <FortaLogo className="w-10 h-10 shadow-md rounded-xl" />
          <span className="text-xl font-semibold tracking-tight dark:text-white">
            Forta
          </span>
        </div>

        <h1 className="text-xl font-semibold text-gray-900 dark:text-white mt-6">
          Sign-in hit an error
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          It has been reported. Try again, or reload the page if it keeps
          happening.
        </p>
        {error.digest && (
          <p className="text-xs font-mono text-gray-400 dark:text-neutral-500 mt-4">
            Reference: {error.digest}
          </p>
        )}

        <button
          type="button"
          onClick={reset}
          className="w-full inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors mt-6"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
