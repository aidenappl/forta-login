"use client";

import { useEffect } from "react";
import Cookies from "js-cookie";
import { useAppDispatch } from "@/store/hooks";
import { clearAuth } from "@/store/slices/authSlice";
import { reqLogout } from "@/services/auth.service";
import { FortaLogo } from "@/components/FortaLogo";
import { monitor, reportCaught } from "@/services/monitor.service";

export default function Logout() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    document.title = "Signing out… | Forta";
  }, []);

  useEffect(() => {
    const performLogout = async () => {
      try {
        // Call logout API (invalidates refresh token on server). fetchApi
        // never throws — a failure comes back as !res.success. Either way
        // the local sign-out below goes ahead.
        const res = await reqLogout();
        if (!res.success) {
          monitor?.warn("auth.logout.failed", {
            requestId: res.request_id,
            data: {
              status_code: res.status,
              error: res.error,
              error_code: res.error_code,
              request_id: res.request_id,
            },
          });
        }
      } catch (e) {
        console.error("Logout API error:", e);
        reportCaught("logout.request", e);
        // Continue with local logout even if API fails
      }

      // Clear Redux state
      dispatch(clearAuth());
      monitor?.clearUser();

      // Clear cookie
      Cookies.set("forta-logged-in", "0", {
        domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
        path: "/",
        expires: 365,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });

      // Small delay to show the UI, then redirect
      window.location.href = "/";
    };

    const timer = setTimeout(performLogout, 500);
    return () => clearTimeout(timer);
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
