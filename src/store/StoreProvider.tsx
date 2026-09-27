"use client";

import { Provider } from "react-redux";
import { makeStore, AppStore } from "./index";
import Cookies from "js-cookie";
import {
  setIsLoading,
  setIsLogged,
  setUser,
  clearAuth,
} from "./slices/authSlice";
import { useEffect } from "react";
import { reqGetSelf } from "../services/auth.service";
import { monitor, sessionFailureLevel } from "../services/monitor.service";

interface StoreProviderProps {
  children: React.ReactNode;
}

let store: AppStore | null = null;

const getStore = () => {
  if (!store) {
    store = makeStore();
  }
  return store;
};

const getLoggedInCookie = () => {
  return Cookies.get("forta-logged-in") || null;
};

const clearLoggedInCookie = () => {
  Cookies.set("forta-logged-in", "0", {
    domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
    path: "/",
    expires: 365,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
};

const StoreProvider = ({ children }: StoreProviderProps) => {
  const storeInstance = getStore();

  useEffect(() => {
    const initAuth = async () => {
      if (getLoggedInCookie() !== "1") {
        storeInstance.dispatch(setIsLoading(false));
        return;
      }

      const res = await reqGetSelf();
      if (res.success) {
        storeInstance.dispatch(setIsLogged(true));
        storeInstance.dispatch(setUser(res.data));
        monitor?.setUser(String(res.data.id));
      } else {
        // The browser held the logged-in marker but the session is gone. A
        // 401/403 (after a failed refresh) is an ended session — expected, so
        // info. Other 4xx warn; 5xx or no response errors.
        monitor?.emit("session.bootstrap.failed", sessionFailureLevel(res.status), {
          requestId: res.request_id,
          data: {
            status_code: res.status,
            error: res.error,
            error_code: res.error_code,
            error_message: res.error_message,
          },
        });
        // Token invalid/expired - clear auth state and cookie
        storeInstance.dispatch(clearAuth());
        monitor?.clearUser();
        clearLoggedInCookie();
      }
      storeInstance.dispatch(setIsLoading(false));
    };

    initAuth();
  }, [storeInstance]);

  return <Provider store={storeInstance}>{children}</Provider>;
};

export default StoreProvider;
