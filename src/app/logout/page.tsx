"use client";

import { useEffect } from "react";
import Cookies from "js-cookie";
import { useAppDispatch } from "@/store/hooks";
import { clearAuth } from "@/store/slices/authSlice";

export default function Logout() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    // Clear Redux state
    dispatch(clearAuth());

    // Clear cookie
    Cookies.set("logged_in", "0", {
      domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
      path: "/",
      expires: 365,
    });

    // Redirect to login
    window.location.href = "/";
  }, [dispatch]);

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-sm text-center">
        <p className="text-sm text-gray-600">Signing out…</p>
      </div>
    </main>
  );
}
