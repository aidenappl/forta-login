"use client";

import { Suspense } from "react";
import { FortaLogo } from "@/components/FortaLogo";
import { LoginForm } from "@/components/LoginForm";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-neutral-950">
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="flex items-center gap-3 mb-6">
          <FortaLogo className="w-10 h-10 shadow-md rounded-xl" />
          <span className="text-xl font-semibold tracking-tight dark:text-white">
            Forta
          </span>
          <span className="h-4 w-px bg-gray-300 dark:bg-neutral-600" />
          <span className="text-sm text-gray-500 dark:text-gray-400">
            ApplebyEstate
          </span>
        </div>

        <div className="w-full bg-white dark:bg-neutral-900 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-neutral-800">
          <p className="text-sm text-gray-500 dark:text-neutral-400 text-center mb-5">
            Sign in to continue
          </p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>

      <footer className="absolute bottom-6 text-xs text-gray-400 dark:text-neutral-500">
        © {new Date().getFullYear()} Appleby Cloud
      </footer>
    </main>
  );
}
