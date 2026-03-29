"use client";

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  useCallback,
  ReactNode,
} from "react";
import Cookies from "js-cookie";

export type Appearance = "light" | "dark" | "system";

const COOKIE_NAME = "forta-appearance";
const COOKIE_DOMAIN = ".appleby.cloud";

interface AppearanceContextValue {
  appearance: Appearance;
  resolvedTheme: "light" | "dark";
  setAppearance: (a: Appearance) => void;
}

const AppearanceContext = createContext<AppearanceContextValue>({
  appearance: "system",
  resolvedTheme: "light",
  setAppearance: () => {},
});

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(app: Appearance) {
  if (typeof window === "undefined") return;
  const resolved = app === "system" ? getSystemTheme() : app;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

const VALID: Appearance[] = ["light", "dark", "system"];

function readCookie(): Appearance {
  if (typeof window === "undefined") return "system";
  const c = Cookies.get(COOKIE_NAME) as Appearance | undefined;
  return VALID.includes(c as Appearance) ? (c as Appearance) : "system";
}

function writeCookie(app: Appearance) {
  Cookies.set(COOKIE_NAME, app, {
    domain: COOKIE_DOMAIN,
    path: "/",
    expires: 365,
  });
}

// useSyncExternalStore wiring — the cookie is the external store.
// Listeners are notified when setAppearance is called (we manage the list manually
// since cookies have no native change event).
const listeners = new Set<() => void>();

function subscribeToAppearance(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notifyAppearanceListeners() {
  listeners.forEach((cb) => cb());
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  // useSyncExternalStore provides a server snapshot ("system") so React renders
  // consistently on both server and client, then hydrates without mismatch.
  // On the client it reads the real cookie value.
  const appearance = useSyncExternalStore(
    subscribeToAppearance,
    readCookie, // client snapshot
    () => "system" as Appearance, // server snapshot — must match initial server render
  );

  // Ensure the cookie is written on first load and apply theme / system listener.
  useEffect(() => {
    writeCookie(appearance);
    applyTheme(appearance);
    if (appearance !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [appearance]);

  const setAppearance = useCallback((app: Appearance) => {
    writeCookie(app);
    applyTheme(app);
    notifyAppearanceListeners();
  }, []);

  const resolvedTheme: "light" | "dark" =
    appearance === "system" ? getSystemTheme() : appearance;

  return (
    <AppearanceContext.Provider
      value={{ appearance, resolvedTheme, setAppearance }}
    >
      {children}
    </AppearanceContext.Provider>
  );
}

export const useAppearance = () => useContext(AppearanceContext);
