"use client";

import Link from "next/link";
import { FortaLogo } from "@/components/FortaLogo";

const FORTA_HOME = process.env.NEXT_PUBLIC_FORTA_HOME || "https://forta.appleby.cloud";

export default function UnauthorizedPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-neutral-950">
      <div className="bg-white dark:bg-neutral-900 rounded-xl p-8 shadow-sm border border-gray-100 dark:border-neutral-800 max-w-md w-full text-center">
        <div className="flex items-center justify-center gap-3">
          <FortaLogo className="w-10 h-10 shadow-md rounded-xl" />
          <span className="text-xl font-semibold tracking-tight dark:text-white">
            Forta
          </span>
        </div>

        <div className="mt-6 flex justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-10 h-10 text-gray-400 dark:text-gray-500"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            <circle cx="12" cy="16" r="1" />
          </svg>
        </div>

        <h1 className="text-xl font-semibold text-gray-900 dark:text-white mt-4">
          Unauthorized
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          You don&apos;t have access to the requested application. Your access
          may have been revoked, or it hasn&apos;t been granted yet.
        </p>

        <a
          href={`${FORTA_HOME}/?tab=request`}
          className="w-full inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-black hover:bg-gray-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 text-sm font-medium transition-colors mt-6"
        >
          Request access
        </a>
        <a
          href={FORTA_HOME}
          className="w-full inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors mt-2"
        >
          Go to your Forta dashboard
        </a>
        <Link
          href="/"
          className="w-full inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors mt-2"
        >
          Sign in with a different account
        </Link>

        <p className="text-xs text-gray-400 dark:text-neutral-500 mt-6">
          Some apps can be requested from your dashboard; for others, contact an administrator.
        </p>
      </div>
    </main>
  );
}
