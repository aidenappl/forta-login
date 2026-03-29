"use client";

import { useEffect } from "react";
import Cookies from "js-cookie";
import { useAppDispatch } from "@/store/hooks";
import { clearAuth } from "@/store/slices/authSlice";
import { reqLogout } from "@/services/auth.service";
import { FortaLogo } from "@/components/FortaLogo";

export default function Logout() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    document.title = "Signing out… | Forta";
  }, []);

  useEffect(() => {
    const performLogout = async () => {
      try {
        // Call logout API (invalidates refresh token on server)
        await reqLogout();
      } catch (e) {
        console.error("Logout API error:", e);
        // Continue with local logout even if API fails
      }

      // Clear Redux state
      dispatch(clearAuth());

      // Clear cookie
      Cookies.set("logged_in", "0", {
        domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
        path: "/",
        expires: 365,
      });

      // Small delay to show the UI, then redirect
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    };

    performLogout();
  }, [dispatch]);

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
