"use client";

import { useEffect } from "react";
import Cookies from "js-cookie";

export default function Logout() {
  useEffect(() => {
    Cookies.set("logged_in", "0", {
      domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
      path: "/",
      expires: 365,
    });
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-lg font-semibold mb-4">Signed out</h1>
        <p className="text-sm text-gray-600">You have been logged out.</p>
      </div>
    </main>
  );
}
