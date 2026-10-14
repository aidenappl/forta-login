import Link from "next/link";
import { FortaLogo } from "@/components/FortaLogo";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-neutral-950">
      <div className="bg-white dark:bg-neutral-900 rounded-xl p-8 shadow-sm border border-gray-100 dark:border-neutral-800 max-w-sm w-full text-center">
        <FortaLogo className="mx-auto w-10 h-10 shadow-md rounded-xl" />
        <p className="mt-6 text-sm font-medium text-gray-500 dark:text-neutral-400">404</p>
        <h1 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">This page doesn&apos;t exist</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-neutral-400">The link may be old or mistyped.</p>
        <Link
          href="/"
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
