"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
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
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(app: Appearance) {
  const resolved = app === "system" ? getSystemTheme() : app;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<Appearance>(() => {
    if (typeof window === "undefined") return "system";
    const c = Cookies.get(COOKIE_NAME) as Appearance | undefined;
    return c === "light" || c === "dark" || c === "system" ? c : "system";
  });

  useEffect(() => {
    applyTheme(appearance);
    if (appearance !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [appearance]);

  const setAppearance = useCallback((app: Appearance) => {
    setAppearanceState(app);
    Cookies.set(COOKIE_NAME, app, {
      domain: COOKIE_DOMAIN,
      path: "/",
      expires: 365,
    });
    applyTheme(app);
  }, []);

  const resolvedTheme: "light" | "dark" =
    appearance === "system"
      ? typeof window !== "undefined"
        ? getSystemTheme()
        : "light"
      : appearance;

  return (
    <AppearanceContext.Provider
      value={{ appearance, resolvedTheme, setAppearance }}
    >
      {children}
    </AppearanceContext.Provider>
  );
}

export const useAppearance = () => useContext(AppearanceContext);
